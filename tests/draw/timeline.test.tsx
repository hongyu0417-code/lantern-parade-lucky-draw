import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDrawTimeline } from '../../src/hooks/useDrawTimeline';

afterEach(() => vi.useRealTimers());

describe('draw timeline', () => {
  it('waits for actual motion events during preparation, running, and eliminations', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { rerender } = renderHook(({ phase }) => useDrawTimeline(phase, dispatch), { initialProps: { phase: 'preparing' as const } });

    act(() => vi.advanceTimersByTime(60_000));
    expect(dispatch).not.toHaveBeenCalled();
    rerender({ phase: 'running' });
    act(() => vi.advanceTimersByTime(60_000));
    expect(dispatch).not.toHaveBeenCalled();
    rerender({ phase: 'eliminating' });
    act(() => vi.advanceTimersByTime(60_000));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('uses short holds between the event-driven elimination milestones', () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const durations = [
      ['finalists3', 1_700],
      ['finalists2', 1_500],
      ['finalist1', 1_000],
      ['magnifying', 1_200],
      ['charging', 550],
      ['burst', 200],
      ['revealing', 600],
    ] as const;

    for (const [phase, duration] of durations) {
      const hook = renderHook(() => useDrawTimeline(phase, dispatch));
      act(() => vi.advanceTimersByTime(duration - 1));
      expect(dispatch).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(dispatch).toHaveBeenLastCalledWith({ type: 'ADVANCE_PHASE' });
      dispatch.mockClear();
      hook.unmount();
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});
