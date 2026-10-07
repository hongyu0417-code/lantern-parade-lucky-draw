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
    const candidates = [{ number: first.activeWinner!.number }, { number: '002' }, { number: '003' }];
    const finalists = [candidates[2], candidates[0], candidates[1]];
    const reserveAction = { type: 'RESERVE_DRAW' as const, record: first, animationCandidates: candidates, animationFinalists: finalists };
    let state = drawReducer(createDrawState(createDefaultRecord()), reserveAction);
    expect(state.phase).toBe('preparing');
    expect(state.animationCandidates).toEqual(candidates);
    expect(state.animationFinalists).toEqual(finalists);
    expect(drawReducer(state, reserveAction)).toBe(state);
    expect(drawReducer(state, { type: 'OPEN_OVERLAY', overlay: 'admin' })).toBe(state);
    expect(drawReducer(state, { type: 'ADVANCE_PHASE', phase: 'revealing' })).toBe(state);
    for (const phase of ['awakening', 'ascending', 'narrowing', 'finalists', 'separating', 'magnifying', 'charging', 'burst', 'revealing', 'winner'] as const) {
      state = drawReducer(state, { type: 'ADVANCE_PHASE', phase });
      expect(state.phase).toBe(phase);
    }
    state = drawReducer(state, { type: 'RETURN_TO_IDLE' });
    expect(state.phase).toBe('idle');
    expect(state.record.activeWinner).toBeNull();
    expect(state.animationCandidates).toEqual([]);
    expect(state.animationFinalists).toEqual([]);
  });

  it('rejects a candidate roster that does not contain the already-saved winner', () => {
    const first = reserveDraw(createDefaultRecord(), () => 0, 'first');
    const state = createDrawState(createDefaultRecord());

    expect(drawReducer(state, { type: 'RESERVE_DRAW', record: first, animationCandidates: [{ number: '999' }], animationFinalists: [{ number: first.activeWinner!.number }] })).toBe(state);
  });

  it('rejects a finalist set that does not contain the already-saved winner', () => {
    const first = reserveDraw(createDefaultRecord(), () => 0, 'first');
    const state = createDrawState(createDefaultRecord());
    const candidates = [{ number: first.activeWinner!.number }, { number: '002' }, { number: '003' }];

    expect(drawReducer(state, { type: 'RESERVE_DRAW', record: first, animationCandidates: candidates, animationFinalists: [{ number: '002' }, { number: '003' }] })).toBe(state);
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
