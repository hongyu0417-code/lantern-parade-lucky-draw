import { updateDrawSettings } from './persistence';
import type { DrawPhase, Participant, PersistedDrawRecord } from './types';

export type DrawOverlay = 'admin' | 'history';

export type DrawState = {
  record: PersistedDrawRecord;
  phase: DrawPhase;
  overlay: DrawOverlay | null;
  animationCandidates: Participant[];
  animationFinalists: Participant[];
};

export type DrawAction =
  | { type: 'RESERVE_DRAW'; record: PersistedDrawRecord; animationCandidates: Participant[]; animationFinalists: Participant[] }
  | { type: 'ADVANCE_PHASE'; phase: DrawPhase }
  | { type: 'SKIP_TO_WINNER' }
  | { type: 'RETURN_TO_IDLE' }
  | { type: 'OPEN_OVERLAY'; overlay: DrawOverlay }
  | { type: 'CLOSE_OVERLAY' }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'UPDATE_RECORD'; record: PersistedDrawRecord };

const NEXT_PHASE: Partial<Record<DrawPhase, DrawPhase>> = {
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
};

export function createDrawState(record: PersistedDrawRecord): DrawState {
  return {
    record,
    phase: record.activeWinner ? 'winner' : 'idle',
    overlay: null,
    animationCandidates: [],
    animationFinalists: [],
  };
}

export function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case 'RESERVE_DRAW': {
      const winnerNumber = action.record.activeWinner?.number;
      const candidateNumbers = new Set(action.animationCandidates.map(({ number }) => number));
      const finalistNumbers = new Set(action.animationFinalists.map(({ number }) => number));
      const expectedFinalists = Math.min(3, candidateNumbers.size);
      if (state.phase !== 'idle' || state.record.activeWinner || !winnerNumber
        || !candidateNumbers.has(winnerNumber) || !finalistNumbers.has(winnerNumber)
        || candidateNumbers.size !== action.animationCandidates.length
        || finalistNumbers.size !== action.animationFinalists.length
        || finalistNumbers.size !== expectedFinalists
        || action.animationFinalists.some(({ number }) => !candidateNumbers.has(number))) return state;
      return {
        record: action.record,
        phase: 'preparing',
        overlay: null,
        animationCandidates: action.animationCandidates,
        animationFinalists: action.animationFinalists,
      };
    }
    case 'ADVANCE_PHASE':
      if (NEXT_PHASE[state.phase] !== action.phase) return state;
      return action.phase === 'winner'
        ? { ...state, phase: action.phase, animationCandidates: [], animationFinalists: [] }
        : { ...state, phase: action.phase };
    case 'SKIP_TO_WINNER':
      if (state.phase === 'idle' || state.phase === 'winner' || !state.record.activeWinner) return state;
      return { ...state, phase: 'winner', animationCandidates: [], animationFinalists: [] };
    case 'RETURN_TO_IDLE':
      if (state.phase !== 'winner') return state;
      return {
        record: { ...state.record, activeWinner: null },
        phase: 'idle',
        overlay: null,
        animationCandidates: [],
        animationFinalists: [],
      };
    case 'OPEN_OVERLAY':
      if (state.phase !== 'idle' && state.phase !== 'winner') return state;
      return { ...state, overlay: action.overlay };
    case 'CLOSE_OVERLAY':
      return state.overlay ? { ...state, overlay: null } : state;
    case 'TOGGLE_SOUND':
      return {
        ...state,
        record: updateDrawSettings(state.record, {
          soundEnabled: !state.record.settings.soundEnabled,
        }),
      };
    case 'UPDATE_RECORD':
      if (state.phase !== 'idle' && state.phase !== 'winner') return state;
      return {
        ...state,
        record: action.record,
        phase: action.record.activeWinner ? 'winner' : 'idle',
        animationCandidates: [],
        animationFinalists: [],
      };
    default:
      return state;
  }
}
