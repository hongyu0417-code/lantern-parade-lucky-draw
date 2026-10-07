import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlyingNumberLanterns } from '../../src/components/FlyingNumberLanterns';
import type { DrawPhase, Participant, WinnerRecord } from '../../src/draw/types';

const candidates: Participant[] = Array.from({ length: 24 }, (_, index) => ({ number: String(index + 1).padStart(3, '0') }));
const finalists = [candidates[7], candidates[12], candidates[20]];
const winner: WinnerRecord = { number: '013', name: 'Amina', round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
const renderAt = (phase: DrawPhase, roster = candidates, finalRoster = finalists, activeWinner = winner) => render(
  <FlyingNumberLanterns phase={phase} candidates={roster} finalists={finalRoster} winner={activeWinner} />,
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

  it('shortens only lantern labels while retaining each full username as its identity', () => {
    const roster = [
      { number: '@abc' },
      { number: '@hongyu814__' },
      { number: '@thisisaverylongusername' },
      { number: '@123456789012345678901234567890' },
    ];
    const longWinner = { number: roster[2].number, round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
    renderAt('awakening', roster, roster.slice(1, 4), longWinner);

    const labels = screen.getAllByRole('listitem').map((lantern) => ({
      identity: lantern.getAttribute('data-number'),
      label: lantern.querySelector('.flying-number-lantern__number')?.textContent,
      accessibleName: lantern.getAttribute('aria-label'),
    }));
    expect(labels).toEqual([
      { identity: '@abc', label: '@abc', accessibleName: '号码 @abc' },
      { identity: '@hongyu814__', label: '@hongyu81…', accessibleName: '号码 @hongyu81…' },
      { identity: '@thisisaverylongusername', label: '@thisisav…', accessibleName: '号码 @thisisav…' },
      { identity: '@123456789012345678901234567890', label: '@12345678…', accessibleName: '号码 @12345678…' },
    ]);
  });

  it('keeps the original font treatment for short numeric IDs and marks longer labels for compact sizing', () => {
    const roster = [{ number: '007' }, { number: '1234' }, { number: '@abc' }];
    const activeWinner = { number: '@abc', round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
    renderAt('awakening', roster, roster, activeWinner);
    const labels = screen.getAllByRole('listitem').map((lantern) => lantern.querySelector('.flying-number-lantern__number'));

    expect(labels[0]).not.toHaveAttribute('data-username');
    expect(labels[1]).toHaveAttribute('data-username', 'true');
    expect(labels[2]).toHaveAttribute('data-username', 'true');
  });

  it('keeps distinct participants distinct when their visible lantern labels collide', () => {
    const roster = [
      { number: '@abcdefgh111' },
      { number: '@abcdefgh222' },
      { number: '@winner' },
    ];
    const activeWinner = { number: '@winner', round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
    renderAt('awakening', roster, roster, activeWinner);

    const lanterns = screen.getAllByRole('listitem');
    expect(lanterns[0].querySelector('.flying-number-lantern__number')).toHaveTextContent('@abcdefgh…');
    expect(lanterns[1].querySelector('.flying-number-lantern__number')).toHaveTextContent('@abcdefgh…');
    expect(lanterns[0]).toHaveAttribute('data-flight-number', '@abcdefgh111');
    expect(lanterns[1]).toHaveAttribute('data-flight-number', '@abcdefgh222');
  });

  it('keeps all finalist lantern labels compact', () => {
    const roster = [{ number: '@hongyu814__' }, { number: '@jason_tan03' }, { number: '@meowmeowforever' }];
    const activeWinner = { number: '@hongyu814__', round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
    renderAt('finalists', roster, roster, activeWinner);

    expect(screen.getAllByRole('listitem').map((lantern) => lantern.querySelector('.flying-number-lantern__number')?.textContent))
      .toEqual(['@hongyu81…', '@jason_ta…', '@meowmeow…']);
    expect(screen.queryByText('@hongyu814__')).not.toBeInTheDocument();
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

  it('keeps the full username hidden while the winning lantern bursts', () => {
    const longUsername = '@thisisaverylongusername';
    const roster = [{ number: longUsername }];
    const activeWinner = { number: longUsername, round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
    const { container } = renderAt('burst', roster, roster, activeWinner);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveAttribute('data-number', longUsername);
    expect(screen.getByRole('listitem').querySelector('.flying-number-lantern__number')).toHaveTextContent('@thisisav…');
    expect(container.querySelector('.flying-number-lanterns__shockwave')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="lantern-burst-fragment"]').length).toBeGreaterThanOrEqual(16);
    expect(screen.queryByText(longUsername)).not.toBeInTheDocument();
  });

  it('reveals the complete username after the burst while the lamp label stays compact', () => {
    const longUsername = '@thisisaverylongusername';
    const roster = [{ number: longUsername }];
    const activeWinner = { number: longUsername, round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
    const { container } = renderAt('revealing', roster, roster, activeWinner);
    const emergence = screen.getByRole('status', { name: /中奖者/ });

    expect(emergence).toHaveTextContent(longUsername);
    expect(emergence).toHaveTextContent('中奖者');
    expect(emergence).toHaveTextContent('恭喜！');
    expect(screen.getByRole('listitem').querySelector('.flying-number-lantern__number')).toHaveTextContent('@thisisav…');
    expect(container.querySelector('.flying-number-lantern__selector')).not.toBeInTheDocument();
  });

  it('auto-fits a long digit-only identifier during the full reveal', () => {
    const longIdentifier = '1234567890';
    const roster = [{ number: longIdentifier }];
    const activeWinner = { number: longIdentifier, round: 1, drawnAt: '2026-10-02T00:00:00.000Z' };
    renderAt('revealing', roster, roster, activeWinner);

    const emergence = screen.getByTestId('flying-number-lanterns__emergence');
    expect(emergence).toHaveAttribute('data-username', 'true');
    expect(emergence).toHaveStyle({ '--winner-character-count': '10' });
    expect(emergence).toHaveTextContent(longIdentifier);
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
