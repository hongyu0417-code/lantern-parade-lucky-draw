import { useEffect } from 'react';
import type { DrawAction } from '../draw/reducer';
import type { DrawPhase } from '../draw/types';

const PHASE_DELAYS: Partial<Record<DrawPhase, number>> = {
  preparing: 320,
  eliminating: 2500,
  finalists3: 1500,
  eliminatingToTwo: 800,
  finalists2: 1200,
  eliminatingToOne: 800,
  finalist1: 650,
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
