import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WinnerReveal } from '../../src/components/WinnerReveal';
import { WinnerHistory } from '../../src/components/WinnerHistory';

afterEach(cleanup);

describe('WinnerReveal', () => {
  it('announces the exact winner number and optional name with next actions', () => {
    const onNext = vi.fn();
    const onHistory = vi.fn();
    render(<WinnerReveal winner={{ number: '007', name: 'Amina', round: 2, drawnAt: '2026-10-01T00:00:00.000Z' }} onNext={onNext} onHistory={onHistory} />);

    expect(screen.getByRole('region', { name: '幸运抽奖结果' })).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('007')).toBeInTheDocument();
    expect(screen.getByText('Amina')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一轮抽奖' }));
    fireEvent.click(screen.getByRole('button', { name: '查看中奖名单' }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onHistory).toHaveBeenCalledOnce();
  });

  it('shows the complete long username and gives it a length-based fit size', () => {
    const longUsername = '@thisisaverylongusername';
    render(<WinnerReveal winner={{ number: longUsername, round: 1, drawnAt: '2026-10-01T00:00:00.000Z' }} onNext={vi.fn()} onHistory={vi.fn()} />);

    const fullWinner = screen.getByText(longUsername);
    expect(fullWinner).toBeInTheDocument();
    expect(fullWinner).toHaveAttribute('data-username', 'true');
    expect(fullWinner).toHaveStyle({ '--winner-character-count': String(longUsername.length) });
    expect(screen.getByText('中奖者')).toBeInTheDocument();
  });

  it('omits the name when none was supplied', () => {
    render(<WinnerReveal winner={{ number: '011', round: 1, drawnAt: '2026-10-01T00:00:00.000Z' }} onNext={vi.fn()} onHistory={vi.fn()} />);
    expect(screen.getByText('011')).toBeInTheDocument();
    expect(screen.queryByTestId('winner-name')).not.toBeInTheDocument();
  });
});

describe('WinnerHistory', () => {
  it('shows round, number, and optional name in the history overlay', () => {
    const longUsername = '@meowmeowforever';
    const onClose = vi.fn();
    render(<WinnerHistory winnerHistory={[
      { number: longUsername, name: 'Amina', round: 1, drawnAt: '2026-10-01T00:00:00.000Z' },
      { number: '008', round: 2, drawnAt: '2026-10-01T00:01:00.000Z' },
    ]} onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: '今晚的幸运得主' })).toBeInTheDocument();
    expect(screen.getByText(longUsername)).toBeInTheDocument();
    expect(screen.getByText('008')).toBeInTheDocument();
    expect(screen.getByText('Amina')).toBeInTheDocument();
    expect(screen.getByText('第 1 轮')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭中奖记录' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('explains an empty history', () => {
    render(<WinnerHistory winnerHistory={[]} onClose={vi.fn()} />);
    expect(screen.getByText(/还没有中奖记录/i)).toBeInTheDocument();
  });
});
