import { useEffect } from 'react';
import type { DrawAction } from '../draw/reducer';
import type { DrawPhase } from '../draw/types';

const PHASE_DELAYS: Partial<Record<DrawPhase, number>> = {
  finalists3: 1_700,
  finalists2: 1_500,
  finalist1: 1_000,
  magnifying: 1200,
  charging: 550,
  burst: 200,
  revealing: 600,
};

export function useDrawTimeline(
  phase: DrawPhase,
  dispatch: React.Dispatch<DrawAction>,
): void {
  useEffect(() => {
    const delay = PHASE_DELAYS[phase];
    if (delay === undefined) return;

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'ADVANCE_PHASE' });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [dispatch, phase]);
}
