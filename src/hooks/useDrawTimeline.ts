import { useEffect } from 'react';
import type { DrawAction } from '../draw/reducer';
import type { DrawPhase } from '../draw/types';

const PHASE_DELAYS: Partial<Record<DrawPhase, number>> = {
  awakening: 1500,
  searching: 2500,
  selecting: 2000,
  finalists: 2000,
  locking: 1000,
  charging: 700,
  burst: 600,
  revealing: 700,
};

export function useDrawTimeline(
  phase: DrawPhase,
  dispatch: React.Dispatch<DrawAction>,
  reducedMotion: boolean,
): void {
  useEffect(() => {
    if (phase === 'idle' || phase === 'winner') return;
    if (reducedMotion) {
      dispatch({ type: 'SKIP_TO_WINNER' });
      return;
    }

    const nextPhase = ({
      awakening: 'searching',
      searching: 'selecting',
      selecting: 'finalists',
      finalists: 'locking',
      locking: 'charging',
      charging: 'burst',
      burst: 'revealing',
      revealing: 'winner',
    } as const)[phase];
    const delay = PHASE_DELAYS[phase];
    if (!nextPhase || delay === undefined) return;

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'ADVANCE_PHASE', phase: nextPhase });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [dispatch, phase, reducedMotion]);
}
