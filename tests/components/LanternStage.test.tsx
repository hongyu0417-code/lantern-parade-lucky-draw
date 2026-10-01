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
    render(<LanternStage phase="idle" activeWinner={null} onDraw={onDraw} onNext={vi.fn()} onHistory={vi.fn()} reducedMotion />);

    expect(screen.getByRole('heading', { name: 'LUCKY DRAW' })).toBeInTheDocument();
    expect(screen.queryByText('LIGHT THE NIGHT')).not.toBeInTheDocument();
    expect(screen.queryByText('FOLLOW YOUR FORTUNE')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DRAW A LUCKY LANTERN' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'DRAW A LUCKY LANTERN' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'DRAW A LUCKY LANTERN' }));
    expect(onDraw).toHaveBeenCalledOnce();
  });

  it('shows a stable winner with the next draw and history actions', () => {
    const onNext = vi.fn();
    const onHistory = vi.fn();
    render(<LanternStage phase="winner" activeWinner={{ number: '007', name: 'Amina', round: 2, drawnAt: '2026-10-01T00:00:00.000Z' }} onDraw={vi.fn()} onNext={onNext} onHistory={onHistory} reducedMotion />);

    expect(screen.getByText('007')).toBeInTheDocument();
    expect(screen.getByText('Amina')).toBeInTheDocument();
    expect(screen.getByText('CONGRATULATIONS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'NEXT DRAW' }));
    fireEvent.click(screen.getByRole('button', { name: 'VIEW WINNERS' }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onHistory).toHaveBeenCalledOnce();
  });

  it('keeps draw controls out of reach during animation', () => {
    render(<LanternStage phase="searching" activeWinner={{ number: '008', round: 1, drawnAt: '2026-10-01T00:00:00.000Z' }} onDraw={vi.fn()} onNext={vi.fn()} onHistory={vi.fn()} reducedMotion />);
    expect(screen.queryByRole('button', { name: 'DRAW A LUCKY LANTERN' })).not.toBeInTheDocument();
    expect(screen.queryByText('008')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Searching the lanterns');
  });
});
