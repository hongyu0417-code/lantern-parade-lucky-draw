import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanternStage } from '../../src/components/LanternStage';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LanternStage', () => {
  it('uses the locally generated backdrop', () => {
    const stageCss = readFileSync('src/styles/stage.css', 'utf8');
    expect(stageCss).toContain("url('/lantern-lake-stage.png')");
    expect(existsSync('public/lantern-lake-stage.png')).toBe(true);
  });

  it('presents the event and one primary draw action at rest', () => {
    const onDraw = vi.fn();
    render(<LanternStage phase="idle" activeWinner={null} animationCandidates={[]} animationFinalists={[]} onDraw={onDraw} onNext={vi.fn()} onHistory={vi.fn()} reducedMotion />);

    expect(screen.getByRole('heading', { name: '幸运抽奖' })).toBeInTheDocument();
    expect(screen.queryByText('LIGHT THE NIGHT')).not.toBeInTheDocument();
    expect(screen.queryByText('FOLLOW YOUR FORTUNE')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始抽奖' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '开始抽奖' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '开始抽奖' }));
    expect(onDraw).toHaveBeenCalledOnce();
  });

  it('shows a stable winner with the next draw and history actions', () => {
    const onNext = vi.fn();
    const onHistory = vi.fn();
    const { container } = render(<LanternStage phase="winner" activeWinner={{ number: '007', name: 'Amina', round: 2, drawnAt: '2026-10-01T00:00:00.000Z' }} animationCandidates={[]} animationFinalists={[]} onDraw={vi.fn()} onNext={onNext} onHistory={onHistory} reducedMotion />);

    expect(screen.getByText('007')).toBeInTheDocument();
    expect(screen.getByText('Amina')).toBeInTheDocument();
    expect(screen.getByText('恭喜！')).toBeInTheDocument();
    expect(container.querySelector('.lantern-field--winner')).toBeInTheDocument();
    expect(container.querySelectorAll('.floating-lantern--chosen')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '下一轮抽奖' }));
    fireEvent.click(screen.getByRole('button', { name: '查看中奖名单' }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onHistory).toHaveBeenCalledOnce();
  });

  it('fades the public controls before the flight and leaves the animation screen free of text', () => {
    const { container } = render(<LanternStage phase="ascending" activeWinner={{ number: '008', round: 1, drawnAt: '2026-10-01T00:00:00.000Z' }} animationCandidates={[{ number: '008' }, { number: '014' }]} animationFinalists={[{ number: '008' }, { number: '014' }]} onDraw={vi.fn()} onNext={vi.fn()} onHistory={vi.fn()} reducedMotion />);
    expect(screen.queryByRole('button', { name: '开始抽奖' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '抽奖设置' })).not.toBeInTheDocument();
    expect(screen.getByText('008').closest('.flying-number-lantern__paper')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('每个号码都在夜空中前行');
    expect(container.querySelector('.flying-number-lanterns__prompt')).not.toBeInTheDocument();
  });

  it('keeps the title visible but fading while the first lanterns wait below the screen', () => {
    const { container } = render(<LanternStage phase="preparing" activeWinner={{ number: '008', round: 1, drawnAt: '2026-10-01T00:00:00.000Z' }} animationCandidates={[{ number: '008' }]} animationFinalists={[{ number: '008' }]} onDraw={vi.fn()} onNext={vi.fn()} onHistory={vi.fn()} reducedMotion />);
    expect(container.querySelector('h1')).toHaveTextContent('幸运抽奖');
    expect(container.querySelector('.stage-intro button')).toBeDisabled();
    expect(container.querySelector('[data-testid="flying-number-lanterns"]')).not.toBeInTheDocument();
    expect(container.querySelector('.stage-intro--fading')).toBeInTheDocument();
  });
});
