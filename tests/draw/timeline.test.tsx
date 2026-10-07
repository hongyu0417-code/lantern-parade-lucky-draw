import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDrawTimeline } from '../../src/hooks/useDrawTimeline';

afterEach(() => vi.useRealTimers());

describe('draw timeline', () => {
  it('advances through the full suspense sequence with the requested stage timings', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const transitions = [
      ['preparing', 320, 'awakening'],
      ['awakening', 2500, 'ascending'],
      ['ascending', 3000, 'narrowing'],
      ['narrowing', 1500, 'finalists'],
      ['finalists', 1500, 'separating'],
      ['separating', 1200, 'magnifying'],
      ['magnifying', 1000, 'charging'],
      ['charging', 500, 'burst'],
      ['burst', 200, 'revealing'],
      ['revealing', 600, 'winner'],
    ] as const;
    const { rerender, unmount } = renderHook(
      ({ phase }: { phase: (typeof transitions)[number][0] }) => useDrawTimeline(phase, dispatch, false),
      { initialProps: { phase: 'preparing' as const } },
    );

    let elapsed = 0;
    for (const [phase, duration, nextPhase] of transitions) {
      act(() => vi.advanceTimersByTime(duration - 1));
      expect(dispatch).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      elapsed += duration;
      expect(dispatch).toHaveBeenLastCalledWith({ type: 'ADVANCE_PHASE', phase: nextPhase });
      dispatch.mockClear();
      if (nextPhase !== 'winner') rerender({ phase: nextPhase });
    }

    expect(elapsed).toBe(12_320);
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
