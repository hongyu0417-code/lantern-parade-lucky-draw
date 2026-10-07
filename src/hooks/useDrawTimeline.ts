import { useEffect } from 'react';
import type { DrawAction } from '../draw/reducer';
import type { DrawPhase } from '../draw/types';

const PHASE_DELAYS: Partial<Record<DrawPhase, number>> = {
  preparing: 320,
  awakening: 2500,
  ascending: 3000,
  narrowing: 1500,
  finalists: 1500,
  separating: 1200,
  magnifying: 1000,
  charging: 500,
  burst: 200,
  revealing: 600,
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
      preparing: 'awakening',
      awakening: 'ascending',
      ascending: 'narrowing',
      narrowing: 'finalists',
      finalists: 'separating',
      separating: 'magnifying',
      magnifying: 'charging',
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
