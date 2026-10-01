import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDrawTimeline } from '../../src/hooks/useDrawTimeline';

afterEach(() => vi.useRealTimers());

describe('draw timeline', () => {
  it('advances after the phase delay and clears the pending timer on unmount', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ phase }: { phase: 'awakening' | 'searching' }) => useDrawTimeline(phase, dispatch, false),
      { initialProps: { phase: 'awakening' as const } },
    );

    act(() => vi.advanceTimersByTime(1099));
    expect(dispatch).not.toHaveBeenCalled();
    rerender({ phase: 'searching' });
    act(() => vi.advanceTimersByTime(2199));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADVANCE_PHASE', phase: 'selecting' });

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skips the animation sequence when reduced motion is active', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    renderHook(() => useDrawTimeline('selecting', dispatch, true));

    expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_TO_WINNER' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
