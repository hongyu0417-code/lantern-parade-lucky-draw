import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlyingNumberLanterns } from '../../src/components/FlyingNumberLanterns';
import type { DrawPhase, Participant, WinnerRecord } from '../../src/draw/types';

const candidates: Participant[] = Array.from({ length: 32 }, (_, index) => ({ number: `@guest${String(index + 1).padStart(2, '0')}` }));
const finalists = [candidates[7], candidates[12], candidates[20]];
const winner: WinnerRecord = { number: finalists[1].number, name: 'Amina', round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };

let pendingFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
let originalWidth = 0;
let originalHeight = 0;

beforeEach(() => {
  pendingFrames = new Map();
  nextFrameId = 1;
  originalWidth = window.innerWidth;
  originalHeight = window.innerHeight;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1080 });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrameId++;
    pendingFrames.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { pendingFrames.delete(id); });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
});

function step(time: number): void {
  const frames = [...pendingFrames.values()];
  pendingFrames.clear();
  act(() => frames.forEach((callback) => callback(time)));
}

function advance(durationMs: number, stepMs = 16): void {
  for (let time = 0; time <= durationMs; time += stepMs) step(time);
}

function view(phase: DrawPhase, stopRequested = { current: false }, onAdvancePhase = vi.fn()) {
  return <FlyingNumberLanterns
    phase={phase}
    eligible={candidates}
    finalists={finalists}
    winner={winner}
    reducedMotion={false}
    stopRequested={stopRequested}
    onAdvancePhase={onAdvancePhase}
    onMotionEvent={vi.fn()}
  />;
}

describe('FlyingNumberLanterns', () => {
  it('uses a fixed pool and starts each new carrier below the viewport', () => {
    const { container } = render(view('running'));
    const pool = [...container.querySelectorAll<HTMLElement>('.flying-number-lantern')];
    expect(pool).toHaveLength(36);
    expect(pool.every((lantern) => lantern.dataset.active === 'false')).toBe(true);

    step(0);
    const first = container.querySelector<HTMLElement>('.flying-number-lantern[data-active="true"]');
    expect(first).not.toBeNull();
    const y = Number(first!.style.transform.match(/px,\s*(-?[\d.]+)px/)?.[1]);
    expect(y).toBeGreaterThan(window.innerHeight);
    expect(first).toHaveAttribute('data-motion', 'up');
  });

  it('builds a dense stream without increasing the number of DOM carriers', () => {
    const { container } = render(view('running'));
    const originalNodes = new Map([...container.querySelectorAll<HTMLElement>('.flying-number-lantern')]
      .map((lantern) => [lantern.dataset.instanceId!, lantern]));
    advance(8_000);

    expect(container.querySelectorAll('.flying-number-lantern')).toHaveLength(36);
    expect(container.querySelectorAll('.flying-number-lantern[data-active="true"]').length).toBeGreaterThanOrEqual(24);
    for (const lantern of container.querySelectorAll<HTMLElement>('.flying-number-lantern')) {
      expect(originalNodes.get(lantern.dataset.instanceId!)).toBe(lantern);
    }
  });

  it('stops the scheduler on Space while active carriers keep moving and exit naturally', () => {
    const stopRequested = { current: false };
    const onAdvancePhase = vi.fn();
    const { container, rerender } = render(view('running', stopRequested, onAdvancePhase));
    advance(5_000);
    const activeBeforeStop = container.querySelectorAll('.flying-number-lantern[data-active="true"]').length;
    const movingBeforeStop = container.querySelector<HTMLElement>('.flying-number-lantern[data-active="true"]')!;
    const previousTransform = movingBeforeStop.style.transform;

    stopRequested.current = true;
    rerender(view('eliminating', stopRequested, onAdvancePhase));
    let largestActiveCount = activeBeforeStop;
    for (let time = 5_016; time <= 14_000; time += 16) {
      step(time);
      largestActiveCount = Math.max(largestActiveCount, container.querySelectorAll('.flying-number-lantern[data-active="true"]').length);
    }

    expect(largestActiveCount).toBeLessThanOrEqual(activeBeforeStop);
    expect(movingBeforeStop.style.transform).not.toBe(previousTransform);
    expect(onAdvancePhase).toHaveBeenCalledOnce();
    expect(container.querySelectorAll('.flying-number-lantern')).toHaveLength(36);
  });

  it('keeps all three finalists moving through the finalist hold', () => {
    const stopRequested = { current: false };
    const onAdvancePhase = vi.fn();
    const { container, rerender } = render(view('running', stopRequested, onAdvancePhase));
    advance(6_000);

    stopRequested.current = true;
    rerender(view('eliminating', stopRequested, onAdvancePhase));
    for (let time = 6_016; time <= 13_000; time += 16) step(time);
    expect(onAdvancePhase).toHaveBeenCalledOnce();

    rerender(view('finalists3', stopRequested, onAdvancePhase));
    step(13_016);
    const finalistsNow = [...container.querySelectorAll<HTMLElement>('.flying-number-lantern[data-active="true"][data-finalist="true"]')];
    const before = finalistsNow.map((lantern) => lantern.style.transform);
    expect(finalistsNow).toHaveLength(3);

    step(13_032);
    const after = finalistsNow.map((lantern) => lantern.style.transform);
    expect(after.every((transform, index) => transform !== before[index])).toBe(true);
  });

  it('waits until the opening finalists have entered before making RUNNING stoppable', () => {
    const onAdvancePhase = vi.fn();
    const { container } = render(view('preparing', { current: false }, onAdvancePhase));
    advance(1_600);
    expect(onAdvancePhase).toHaveBeenCalledOnce();
    expect(container.querySelectorAll('.flying-number-lantern[data-active="true"]').length).toBeGreaterThanOrEqual(3);
    expect([...container.querySelectorAll<HTMLElement>('.flying-number-lantern[data-active="true"]')]
      .filter((lantern) => Number(lantern.style.transform.match(/px,\s*(-?[\d.]+)px/)?.[1]) <= window.innerHeight).length)
      .toBeGreaterThanOrEqual(3);
  });

  it('keeps username truncation on the lantern and reveals the full winner after the burst', () => {
    const longUsername = '@thisisaverylongusername';
    const longCandidates = [{ number: longUsername }];
    const longWinner: WinnerRecord = { number: longUsername, round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
    render(<FlyingNumberLanterns phase="revealing" eligible={longCandidates} finalists={longCandidates} winner={longWinner}
      reducedMotion stopRequested={{ current: true }} onAdvancePhase={vi.fn()} onMotionEvent={vi.fn()} />);

    expect(screen.getByRole('status', { name: /中奖者/ })).toHaveTextContent(longUsername);
    expect(screen.getByRole('status', { name: /中奖者/ })).toHaveTextContent('恭喜！');
    expect(screen.queryByText(longUsername, { selector: '.flying-number-lantern__number' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid="lantern-burst-fragment"]')).toHaveLength(20);
  });
});
