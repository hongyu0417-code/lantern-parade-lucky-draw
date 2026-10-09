import { describe, expect, it } from 'vitest';
import { createDrawState, drawReducer } from './reducer';
import { createDefaultRecord } from './persistence';
import type { Participant, PersistedDrawRecord } from './types';

function startThreeFinalistSequence() {
  const record = createDefaultRecord();
  let state = createDrawState(record);
  state = drawReducer(state, { type: 'START_DRAW' });
  state = drawReducer(state, { type: 'ADVANCE_PHASE' });

  const winner = { number: '001', round: 1, drawnAt: '2026-10-09T00:00:00.000Z' };
  const drawnRecord: PersistedDrawRecord = {
    ...record,
    activeWinner: winner,
    winnerHistory: [winner],
    availableNumbers: record.availableNumbers.slice(1),
  };
  const finalists: Participant[] = [{ number: '001' }, { number: '002' }, { number: '003' }];
  state = drawReducer(state, { type: 'BEGIN_ELIMINATION', record: drawnRecord, animationFinalists: finalists });
  return state;
}

describe('draw reducer finale', () => {
  it('moves from the moving finalist three directly to the moving winner sequence', () => {
    let state = startThreeFinalistSequence();
    expect(state.phase).toBe('eliminating');

    state = drawReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.phase).toBe('finalists3');

    state = drawReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.phase).toBe('eliminatingLosers');

    state = drawReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.phase).toBe('finalist1');
  });
});
