import { describe, expect, it } from 'vitest';
import { createDefaultRecord, reserveDraw } from '../../src/draw/persistence';
import { createDrawState, drawReducer } from '../../src/draw/reducer';

describe('draw reducer', () => {
  it('rehydrates an active winner into the winner phase', () => {
    const record = reserveDraw(createDefaultRecord(), () => 0, 'first');
    expect(createDrawState(record).phase).toBe('winner');
  });

  it('starts only once and advances in order', () => {
    const first = reserveDraw(createDefaultRecord(), () => 0, 'first');
    const candidates = [{ number: first.activeWinner!.number }];
    let state = drawReducer(createDrawState(createDefaultRecord()), { type: 'RESERVE_DRAW', record: first, animationCandidates: candidates });
    expect(state.phase).toBe('awakening');
    expect(state.animationCandidates).toEqual(candidates);
    expect(drawReducer(state, { type: 'RESERVE_DRAW', record: first, animationCandidates: candidates })).toBe(state);
    expect(drawReducer(state, { type: 'OPEN_OVERLAY', overlay: 'admin' })).toBe(state);
    expect(drawReducer(state, { type: 'ADVANCE_PHASE', phase: 'revealing' })).toBe(state);
    for (const phase of ['searching', 'selecting', 'finalists', 'locking', 'charging', 'burst', 'revealing', 'winner'] as const) {
      state = drawReducer(state, { type: 'ADVANCE_PHASE', phase });
      expect(state.phase).toBe(phase);
    }
    state = drawReducer(state, { type: 'RETURN_TO_IDLE' });
    expect(state.phase).toBe('idle');
    expect(state.record.activeWinner).toBeNull();
    expect(state.animationCandidates).toEqual([]);
  });

  it('rejects a candidate roster that does not contain the already-saved winner', () => {
    const first = reserveDraw(createDefaultRecord(), () => 0, 'first');
    const state = createDrawState(createDefaultRecord());

    expect(drawReducer(state, { type: 'RESERVE_DRAW', record: first, animationCandidates: [{ number: '999' }] })).toBe(state);
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
