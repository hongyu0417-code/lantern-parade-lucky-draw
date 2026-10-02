import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDrawTimeline } from '../../src/hooks/useDrawTimeline';

afterEach(() => vi.useRealTimers());

describe('draw timeline', () => {
  it('advances through the full suspense sequence with the requested stage timings', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const transitions = [
      ['awakening', 1500, 'searching'],
      ['searching', 2500, 'selecting'],
      ['selecting', 2000, 'finalists'],
      ['finalists', 2000, 'locking'],
      ['locking', 1000, 'charging'],
      ['charging', 700, 'burst'],
      ['burst', 600, 'revealing'],
      ['revealing', 700, 'winner'],
    ] as const;
    const { rerender, unmount } = renderHook(
      ({ phase }: { phase: (typeof transitions)[number][0] }) => useDrawTimeline(phase, dispatch, false),
      { initialProps: { phase: 'awakening' as const } },
    );

    for (const [phase, duration, nextPhase] of transitions) {
      act(() => vi.advanceTimersByTime(duration - 1));
      expect(dispatch).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(dispatch).toHaveBeenLastCalledWith({ type: 'ADVANCE_PHASE', phase: nextPhase });
      dispatch.mockClear();
      if (nextPhase !== 'winner') rerender({ phase: nextPhase });
    }

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skips the animation sequence when reduced motion is active', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    renderHook(() => useDrawTimeline('finalists', dispatch, true));

    expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_TO_WINNER' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
