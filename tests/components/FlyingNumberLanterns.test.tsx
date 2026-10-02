import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlyingNumberLanterns } from '../../src/components/FlyingNumberLanterns';
import type { DrawPhase, Participant, WinnerRecord } from '../../src/draw/types';

const candidates: Participant[] = Array.from({ length: 24 }, (_, index) => ({ number: String(index + 1).padStart(3, '0') }));
const winner: WinnerRecord = { number: '013', name: 'Amina', round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
const renderAt = (phase: DrawPhase, roster = candidates) => render(
  <FlyingNumberLanterns phase={phase} candidates={roster} winner={winner} onSelectorTick={vi.fn()} />,
);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FlyingNumberLanterns', () => {
  it('shows every candidate number inside a lantern while the lanterns rush', () => {
    renderAt('searching');

    expect(screen.getByRole('list', { name: /draw candidates/i })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(24);
    for (const lantern of screen.getAllByRole('listitem')) {
      expect(lantern.querySelector('.flying-number-lantern__paper .flying-number-lantern__number'))
        .toHaveTextContent(lantern.getAttribute('data-number')!);
    }
    expect(screen.getByText('013')).toBeInTheDocument();
    expect(screen.getByText('013').closest('.flying-number-lantern__paper')).toBeInTheDocument();
  });

  it('moves the golden selector between real candidates, with a tick at each stop', () => {
    vi.useFakeTimers();
    const onSelectorTick = vi.fn();
    const { container } = render(<FlyingNumberLanterns phase="selecting" candidates={candidates} winner={winner} onSelectorTick={onSelectorTick} />);

    expect(container.querySelector('.flying-number-lantern--selected')).toHaveAttribute('data-number', '001');
    act(() => vi.advanceTimersByTime(110));
    expect(container.querySelector('.flying-number-lantern--selected')).toHaveAttribute('data-number', '002');
    expect(onSelectorTick).toHaveBeenCalledOnce();
  });

  it('reduces to the winner and two distinct real finalists before lock', () => {
    renderAt('finalists');
    const lanterns = screen.getAllByRole('listitem');

    expect(lanterns).toHaveLength(3);
    expect(lanterns.map((lantern) => lantern.getAttribute('data-number'))).toContain('013');
    expect(new Set(lanterns.map((lantern) => lantern.getAttribute('data-number'))).size).toBe(3);
  });

  it('shows available finalists without inventing entries when the pool has fewer than three', () => {
    renderAt('finalists', [{ number: '013' }, { number: '022' }]);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('locks the winner and sends the other two lanterns flying away', () => {
    const { container } = renderAt('locking');

    expect(container.querySelectorAll('.flying-number-lantern--flying-away')).toHaveLength(2);
    expect(container.querySelector('.flying-number-lantern--locked')).toHaveAttribute('data-number', '013');
  });

  it('bursts into a shockwave and fragments while the number emerges', () => {
    const { container } = renderAt('burst');

    expect(container.querySelector('.flying-number-lanterns__shockwave')).toBeInTheDocument();
    expect(container.querySelector('.flying-number-lanterns__water-ripple')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="lantern-burst-particle"]').length).toBeGreaterThanOrEqual(16);
    expect(screen.getByRole('status', { name: /winning number/i })).toHaveTextContent('013');
  });

  it('settles on a large congratulatory reveal before the existing winner screen', () => {
    renderAt('revealing');
    expect(screen.getByRole('status', { name: /winning number/i })).toHaveTextContent('013');
    expect(screen.getByRole('status', { name: /winning number/i }).querySelector('p')).toHaveTextContent('CONGRATULATIONS');
  });
});
