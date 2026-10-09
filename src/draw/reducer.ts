import { updateDrawSettings } from './persistence';
import type { DrawPhase, Participant, PersistedDrawRecord } from './types';

export type DrawOverlay = 'admin' | 'history';

export type DrawState = {
  record: PersistedDrawRecord;
  phase: DrawPhase;
  overlay: DrawOverlay | null;
  animationPool: Participant[];
  animationFinalists: Participant[];
};

export type DrawAction =
  | { type: 'START_DRAW' }
  | { type: 'BEGIN_ELIMINATION'; record: PersistedDrawRecord; animationFinalists: Participant[] }
  | { type: 'ADVANCE_PHASE' }
  | { type: 'RETURN_TO_IDLE' }
  | { type: 'OPEN_OVERLAY'; overlay: DrawOverlay }
  | { type: 'CLOSE_OVERLAY' }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'UPDATE_RECORD'; record: PersistedDrawRecord };

function nextPhase(state: DrawState): DrawPhase | null {
  switch (state.phase) {
    case 'preparing': return 'running';
    case 'eliminating':
      return state.animationFinalists.length >= 3 ? 'finalists3'
        : state.animationFinalists.length === 2 ? 'finalists3'
          : state.animationFinalists.length === 1 ? 'finalist1' : null;
    case 'finalists3': return 'eliminatingLosers';
    case 'eliminatingLosers': return 'finalist1';
    case 'finalist1': return 'magnifying';
    case 'magnifying': return 'charging';
    case 'charging': return 'burst';
    case 'burst': return 'revealing';
    case 'revealing': return 'winner';
    default: return null;
  }
}

export function createDrawState(record: PersistedDrawRecord): DrawState {
  return {
    record,
    phase: record.activeWinner ? 'winner' : 'idle',
    overlay: null,
    animationPool: [],
    animationFinalists: [],
  };
}

export function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case 'START_DRAW':
      if (state.phase !== 'idle' || state.record.activeWinner || state.record.availableNumbers.length === 0) return state;
      return {
        ...state,
        phase: 'preparing',
        overlay: null,
        animationPool: state.record.availableNumbers,
        animationFinalists: [],
      };
    case 'BEGIN_ELIMINATION': {
      const winnerNumber = action.record.activeWinner?.number;
      const eligibleNumbers = new Set(state.animationPool.map(({ number }) => number));
      const finalistNumbers = new Set(action.animationFinalists.map(({ number }) => number));
      const expectedFinalists = Math.min(3, eligibleNumbers.size);
      if ((state.phase !== 'running' && state.phase !== 'preparing') || state.record.activeWinner || !winnerNumber
        || !eligibleNumbers.has(winnerNumber) || !finalistNumbers.has(winnerNumber)
        || finalistNumbers.size !== action.animationFinalists.length
        || finalistNumbers.size !== expectedFinalists
        || action.animationFinalists.some(({ number }) => !eligibleNumbers.has(number))) return state;
      return {
        record: action.record,
        phase: 'eliminating',
        overlay: null,
        animationPool: state.animationPool,
        animationFinalists: action.animationFinalists,
      };
    }
    case 'ADVANCE_PHASE':
      {
        const phase = nextPhase(state);
        if (!phase) return state;
        return phase === 'winner'
          ? { ...state, phase, animationPool: [], animationFinalists: [] }
          : { ...state, phase };
      }
    case 'RETURN_TO_IDLE':
      if (state.phase !== 'winner') return state;
      return {
        record: { ...state.record, activeWinner: null },
        phase: 'idle',
        overlay: null,
        animationPool: [],
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
        animationPool: [],
        animationFinalists: [],
      };
    default:
      return state;
  }
}
