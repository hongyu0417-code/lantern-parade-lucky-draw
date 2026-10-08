import { describe, expect, it } from 'vitest';
import { createDefaultRecord, reserveDraw } from '../../src/draw/persistence';
import { createDrawState, drawReducer } from '../../src/draw/reducer';

describe('draw reducer', () => {
  it('rehydrates an active winner into the winner phase', () => {
    const record = reserveDraw(createDefaultRecord(), () => 0, 'first');
    expect(createDrawState(record).phase).toBe('winner');
  });

  it('starts once, waits for the manual stop, and advances the elimination sequence', () => {
    const initial = createDrawState(createDefaultRecord());
    const first = reserveDraw(initial.record, () => 0, 'first');
    const candidates = initial.record.availableNumbers;
    const finalists = [candidates[0], candidates[1], candidates[2]];
    let state = drawReducer(initial, { type: 'START_DRAW' });
    expect(state.phase).toBe('preparing');
    expect(state.animationPool).toEqual(candidates);
    expect(drawReducer(state, { type: 'START_DRAW' })).toBe(state);
    expect(drawReducer(state, { type: 'OPEN_OVERLAY', overlay: 'admin' })).toBe(state);

    state = drawReducer(state, { type: 'ADVANCE_PHASE' });
    expect(state.phase).toBe('running');
    expect(drawReducer(state, { type: 'BEGIN_ELIMINATION', record: first, animationFinalists: finalists })).not.toBe(state);
    state = drawReducer(state, { type: 'BEGIN_ELIMINATION', record: first, animationFinalists: finalists });
    expect(state.phase).toBe('eliminating');
    expect(state.animationFinalists).toEqual(finalists);

    const phases = ['finalists3', 'eliminatingToTwo', 'finalists2', 'eliminatingToOne', 'finalist1', 'magnifying', 'charging', 'burst', 'revealing', 'winner'] as const;
    for (const phase of phases) {
      state = drawReducer(state, { type: 'ADVANCE_PHASE' });
      expect(state.phase).toBe(phase);
    }
    state = drawReducer(state, { type: 'RETURN_TO_IDLE' });
    expect(state.phase).toBe('idle');
    expect(state.record.activeWinner).toBeNull();
    expect(state.animationPool).toEqual([]);
    expect(state.animationFinalists).toEqual([]);
  });

  it('rejects a stop when the finalized pool or finalist set omits the saved winner', () => {
    const initial = createDrawState(createDefaultRecord());
    const first = reserveDraw(initial.record, () => 0, 'first');
    const started = drawReducer(drawReducer(initial, { type: 'START_DRAW' }), { type: 'ADVANCE_PHASE' });
    expect(drawReducer(started, { type: 'BEGIN_ELIMINATION', record: first, animationFinalists: [{ number: '999' }] })).toBe(started);
    expect(drawReducer(started, { type: 'BEGIN_ELIMINATION', record: first, animationFinalists: [{ number: '002' }, { number: '003' }, { number: '004' }] })).toBe(started);
  });

  it('opens and closes overlays and toggles sound', () => {
    let state = createDrawState(createDefaultRecord());
    state = drawReducer(state, { type: 'OPEN_OVERLAY', overlay: 'admin' });
    expect(state.overlay).toBe('admin');
    state = drawReducer(state, { type: 'CLOSE_OVERLAY' });
    expect(state.overlay).toBeNull();
    state = drawReducer(state, { type: 'TOGGLE_SOUND' });
    expect(state.record.settings.soundEnabled).toBe(false);
  });
});
