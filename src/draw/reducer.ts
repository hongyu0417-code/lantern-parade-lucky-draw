import { updateDrawSettings } from './persistence';
import type { DrawPhase, Participant, PersistedDrawRecord } from './types';

export type DrawOverlay = 'admin' | 'history';

export type DrawState = {
  record: PersistedDrawRecord;
  phase: DrawPhase;
  overlay: DrawOverlay | null;
  animationCandidates: Participant[];
};

export type DrawAction =
  | { type: 'RESERVE_DRAW'; record: PersistedDrawRecord; animationCandidates: Participant[] }
  | { type: 'ADVANCE_PHASE'; phase: DrawPhase }
  | { type: 'SKIP_TO_WINNER' }
  | { type: 'RETURN_TO_IDLE' }
  | { type: 'OPEN_OVERLAY'; overlay: DrawOverlay }
  | { type: 'CLOSE_OVERLAY' }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'UPDATE_RECORD'; record: PersistedDrawRecord };

const NEXT_PHASE: Partial<Record<DrawPhase, DrawPhase>> = {
  awakening: 'searching',
  searching: 'selecting',
  selecting: 'finalists',
  finalists: 'locking',
  locking: 'charging',
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
  };
}

export function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case 'RESERVE_DRAW':
      if (state.phase !== 'idle' || state.record.activeWinner || !action.record.activeWinner
        || !action.animationCandidates.some(({ number }) => number === action.record.activeWinner?.number)) return state;
      return { record: action.record, phase: 'awakening', overlay: null, animationCandidates: action.animationCandidates };
    case 'ADVANCE_PHASE':
      if (NEXT_PHASE[state.phase] !== action.phase) return state;
      return { ...state, phase: action.phase, animationCandidates: action.phase === 'winner' ? [] : state.animationCandidates };
    case 'SKIP_TO_WINNER':
      if (state.phase === 'idle' || state.phase === 'winner' || !state.record.activeWinner) return state;
      return { ...state, phase: 'winner', animationCandidates: [] };
    case 'RETURN_TO_IDLE':
      if (state.phase !== 'winner') return state;
      return {
        record: { ...state.record, activeWinner: null },
        phase: 'idle',
        overlay: null,
        animationCandidates: [],
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
      };
    default:
      return state;
  }
}
