import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanternStage } from '../../src/components/LanternStage';
import type { DrawPhase, Participant, WinnerRecord } from '../../src/draw/types';

const participants: Participant[] = Array.from({ length: 4 }, (_, index) => ({ number: `@guest${index + 1}` }));
const activeWinner: WinnerRecord = { number: '@guest2', name: 'Amina', round: 2, drawnAt: '2026-10-01T00:00:00.000Z' };

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderStage(phase: DrawPhase, overrides: Partial<React.ComponentProps<typeof LanternStage>> = {}) {
  return render(<LanternStage
    phase={phase}
    activeWinner={null}
    animationPool={[]}
    animationFinalists={[]}
    stopRequested={{ current: false }}
    onAdvancePhase={vi.fn()}
    onMotionEvent={vi.fn()}
    onDraw={vi.fn()}
    onNext={vi.fn()}
    onHistory={vi.fn()}
    reducedMotion
    emptyPool={false}
    notice={null}
    {...overrides}
  />);
}

describe('LanternStage', () => {
  it('uses the existing generated backdrop', () => {
    const stageCss = readFileSync('src/styles/stage.css', 'utf8');
    expect(stageCss).toContain("url('/lantern-lake-stage.png')");
    expect(existsSync('public/lantern-lake-stage.png')).toBe(true);
  });

  it('shows the exact event title above the existing draw hierarchy', () => {
    const onDraw = vi.fn();
    renderStage('idle', { onDraw });

    expect(screen.getByText('第二十六届马大灯笼节 · 灯笼游行')).toBeInTheDocument();
    expect(screen.queryByText('月色如画 · 灯火相逢')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '幸运抽奖' })).toBeInTheDocument();
    expect(screen.getByText('寻找属于你的幸运灯笼')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始抽奖' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '开始抽奖' }));
    expect(onDraw).toHaveBeenCalledOnce();
  });

  it('shows the saved winner and keeps the existing next-draw and history actions', () => {
    const onNext = vi.fn();
    const onHistory = vi.fn();
    const { container } = renderStage('winner', { activeWinner, onNext, onHistory });

    expect(screen.getByText('@guest2')).toBeInTheDocument();
    expect(screen.getByText('Amina')).toBeInTheDocument();
    expect(screen.getByText('恭喜！')).toBeInTheDocument();
    expect(container.querySelector('.lantern-field--winner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一轮抽奖' }));
    fireEvent.click(screen.getByRole('button', { name: '查看中奖名单' }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onHistory).toHaveBeenCalledOnce();
  });

  it('hides the intro and operator toolbar during the live stream', () => {
    const { container } = renderStage('running', {
      activeWinner,
      animationPool: participants,
      animationFinalists: participants.slice(0, 3),
    });

    expect(screen.queryByRole('button', { name: '开始抽奖' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '抽奖设置' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('.flying-number-lantern')).toHaveLength(28);
    expect(container.querySelector('.lantern-stage__content')).toBeInTheDocument();
  });

  it('fades the intro while the draw prepares its opening lanterns', () => {
    const { container } = renderStage('preparing', {
      activeWinner,
      animationPool: participants,
      animationFinalists: participants.slice(0, 3),
    });
    expect(container.querySelector('h1')).toHaveTextContent('幸运抽奖');
    expect(container.querySelector('.stage-intro button')).toBeDisabled();
    expect(container.querySelector('[data-testid="flying-number-lanterns"]')).toBeInTheDocument();
    expect(container.querySelector('.stage-intro--fading')).toBeInTheDocument();
  });
});
