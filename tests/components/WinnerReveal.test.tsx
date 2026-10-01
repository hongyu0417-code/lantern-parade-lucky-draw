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

    expect(screen.getByRole('region', { name: 'Lucky draw winner' })).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('007')).toBeInTheDocument();
    expect(screen.getByText('Amina')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'NEXT DRAW' }));
    fireEvent.click(screen.getByRole('button', { name: 'VIEW WINNERS' }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onHistory).toHaveBeenCalledOnce();
  });

  it('omits the name when none was supplied', () => {
    render(<WinnerReveal winner={{ number: '011', round: 1, drawnAt: '2026-10-01T00:00:00.000Z' }} onNext={vi.fn()} onHistory={vi.fn()} />);
    expect(screen.getByText('011')).toBeInTheDocument();
    expect(screen.queryByTestId('winner-name')).not.toBeInTheDocument();
  });
});

describe('WinnerHistory', () => {
  it('shows round, number, and optional name in the history overlay', () => {
    const onClose = vi.fn();
    render(<WinnerHistory winnerHistory={[
      { number: '007', name: 'Amina', round: 1, drawnAt: '2026-10-01T00:00:00.000Z' },
      { number: '008', round: 2, drawnAt: '2026-10-01T00:01:00.000Z' },
    ]} onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: 'Winner history' })).toBeInTheDocument();
    expect(screen.getByText('007')).toBeInTheDocument();
    expect(screen.getByText('008')).toBeInTheDocument();
    expect(screen.getByText('Amina')).toBeInTheDocument();
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close winner history' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('explains an empty history', () => {
    render(<WinnerHistory winnerHistory={[]} onClose={vi.fn()} />);
    expect(screen.getByText(/No winners yet/i)).toBeInTheDocument();
  });
});
