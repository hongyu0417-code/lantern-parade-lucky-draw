import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlyingNumberLanterns } from '../../src/components/FlyingNumberLanterns';
import type { DrawPhase, Participant, WinnerRecord } from '../../src/draw/types';

const candidates: Participant[] = Array.from({ length: 24 }, (_, index) => ({ number: String(index + 1).padStart(3, '0') }));
const finalists = [candidates[7], candidates[12], candidates[20]];
const winner: WinnerRecord = { number: '013', name: 'Amina', round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
const renderAt = (phase: DrawPhase, roster = candidates, finalRoster = finalists) => render(
  <FlyingNumberLanterns phase={phase} candidates={roster} finalists={finalRoster} winner={winner} />,
);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FlyingNumberLanterns', () => {
  it('shows each real candidate number inside a staggered upward-moving lantern', () => {
    const { container } = renderAt('awakening');
    const lanterns = screen.getAllByRole('listitem');

    expect(lanterns).toHaveLength(24);
    for (const lantern of lanterns) {
      expect(lantern.querySelector('.flying-number-lantern__paper .flying-number-lantern__number'))
        .toHaveTextContent(lantern.getAttribute('data-number')!);
      expect(lantern).toHaveAttribute('data-motion', 'up');
      expect(lantern.style.getPropertyValue('--flight-duration')).toMatch(/ms$/);
      expect(lantern.style.getPropertyValue('--launch-delay')).toMatch(/ms$/);
      expect(lantern.style.getPropertyValue('--curve-one-vw')).not.toBe('');
    }
    expect(container.querySelector('.flying-number-lantern__selector')).not.toBeInTheDocument();
    expect(container.querySelector('.flying-number-lantern--selected')).not.toBeInTheDocument();
  });

  it('gradually removes candidates through upward exits and leaves only the predetermined three at seven seconds', () => {
    vi.useFakeTimers();
    const { container } = renderAt('ascending');
    const initialNumbers = new Set(screen.getAllByRole('listitem').map((lantern) => lantern.getAttribute('data-number')));

    act(() => vi.advanceTimersByTime(4_500));
    const middle = screen.getAllByRole('listitem');
    expect(middle.length).toBeLessThan(24);
    expect(middle.length).toBeGreaterThan(3);
    expect(middle.every((lantern) => initialNumbers.has(lantern.getAttribute('data-number')))).toBe(true);
    expect(middle.every((lantern) => lantern.getAttribute('data-motion') === 'up')).toBe(true);

    act(() => vi.advanceTimersByTime(2_500));
    expect(screen.getAllByRole('listitem').map((lantern) => lantern.getAttribute('data-number')).sort())
      .toEqual(finalists.map(({ number }) => number).sort());
    expect(container.querySelectorAll('.flying-number-lantern--selected')).toHaveLength(0);
  });

  it('lets the final three keep rising before the two non-winners leave through the top', () => {
    vi.useFakeTimers();
    const { container } = renderAt('separating', candidates);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    const leaving = container.querySelectorAll('.flying-number-lantern--finalist-leaving');
    expect(leaving).toHaveLength(2);
    expect([...leaving].every((lantern) => lantern.getAttribute('data-motion') === 'up')).toBe(true);
    expect(container.querySelector('.flying-number-lantern--winner-gliding')).toHaveAttribute('data-number', winner.number);
    expect(container.querySelectorAll('.flying-number-lantern--locked, .flying-number-lantern__selector')).toHaveLength(0);

    act(() => vi.advanceTimersByTime(1_200));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveAttribute('data-number', winner.number);
  });

  it('slowly magnifies only the saved winner without leaving the stage', () => {
    const { container } = renderAt('magnifying');

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveAttribute('data-number', winner.number);
    expect(container.querySelector('.flying-number-lantern--winner-focus')).toBeInTheDocument();
    expect(container.querySelector('.flying-number-lantern__selector')).not.toBeInTheDocument();
  });

  it('bursts the winner lantern into festival fragments while releasing its number', () => {
    const { container } = renderAt('burst');

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveAttribute('data-number', winner.number);
    expect(container.querySelector('.flying-number-lanterns__shockwave')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="lantern-burst-fragment"]').length).toBeGreaterThanOrEqual(16);
    expect(screen.getByRole('status', { name: /中奖号码/ })).toHaveTextContent(winner.number);
  });

  it('settles the released number under the existing Lucky Number terminology', () => {
    const { container } = renderAt('revealing');
    const emergence = screen.getByRole('status', { name: /中奖号码/ });

    expect(emergence).toHaveTextContent(winner.number);
    expect(emergence).toHaveTextContent('中奖号码');
    expect(emergence).toHaveTextContent('恭喜！');
    expect(container.querySelector('.flying-number-lantern__selector')).not.toBeInTheDocument();
  });

  it('keeps every available real candidate when fewer than three are eligible', () => {
    vi.useFakeTimers();
    const smallPool = [{ number: '013' }, { number: '022' }];
    renderAt('finalists', smallPool, smallPool);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('clears candidate exit timers when the animation is unmounted', () => {
    vi.useFakeTimers();
    const { unmount } = renderAt('ascending');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
