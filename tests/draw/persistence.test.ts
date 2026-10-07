import { describe, expect, it, vi } from 'vitest';
import { createDefaultRecord, readDrawRecord, reserveDraw, resetDrawHistory, undoLastDraw, updateDrawSettings, writeDrawRecord } from '../../src/draw/persistence';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('persisted draw records', () => {
  it('starts at version 1 with the inclusive 001–300 pool', () => {
    const record = createDefaultRecord();
    expect(record.version).toBe(1);
    expect(record.availableNumbers).toHaveLength(300);
    expect(record.availableNumbers[0].number).toBe('001');
    expect(record.availableNumbers.at(-1)?.number).toBe('300');
  });

  it('reserves a winner and records it before presentation', () => {
    const original = createDefaultRecord();
    const next = reserveDraw(original, () => 0, '2026-10-01T12:00:00Z');
    expect(next.activeWinner).toEqual({ number: '001', round: 1, drawnAt: '2026-10-01T12:00:00Z' });
    expect(next.winnerHistory).toEqual([next.activeWinner]);
    expect(next.availableNumbers).toHaveLength(299);
    expect(original.winnerHistory).toHaveLength(0);
  });

  it('stores the complete winning username in active draw state and winner history', () => {
    const storage = memoryStorage();
    const usernames = [{ number: '@abcdefgh111' }, { number: '@abcdefgh222' }];
    const imported = updateDrawSettings(createDefaultRecord(), { participants: usernames });
    const drawn = reserveDraw(imported, () => 1, '2026-10-07T12:00:00Z');
    writeDrawRecord(storage, drawn);

    expect(drawn.activeWinner?.number).toBe('@abcdefgh222');
    expect(drawn.winnerHistory.map(({ number }) => number)).toEqual(['@abcdefgh222']);
    expect(readDrawRecord(storage).winnerHistory.map(({ number }) => number)).toEqual(['@abcdefgh222']);
    expect(readDrawRecord(storage).availableNumbers).toEqual([{ number: '@abcdefgh111' }]);
  });

  it('allows repeats only when requested', () => {
    const record = updateDrawSettings(createDefaultRecord(), { preventDuplicates: false });
    const first = reserveDraw(record, () => 0, 'first');
    const second = reserveDraw(first, () => 0, 'second');
    expect(first.availableNumbers).toHaveLength(300);
    expect(second.winnerHistory.map((winner) => winner.number)).toEqual(['001', '001']);
  });

  it('rejects a draw from an exhausted pool', () => {
    const record = updateDrawSettings(createDefaultRecord(), { startNumber: '001', endNumber: '001' });
    const first = reserveDraw(record, () => 0, 'first');
    expect(() => reserveDraw(first, () => 0, 'second')).toThrow(/empty/i);
  });

  it('undoes the latest winner and restores eligibility', () => {
    const record = reserveDraw(createDefaultRecord(), () => 0, 'first');
    const undone = undoLastDraw(record);
    expect(undone.winnerHistory).toEqual([]);
    expect(undone.activeWinner).toBeNull();
    expect(undone.availableNumbers).toHaveLength(300);
    expect(undone.availableNumbers[0].number).toBe('001');
  });

  it('keeps history but excludes previous winners when the source changes', () => {
    const first = reserveDraw(createDefaultRecord(), () => 0, 'first');
    const range = updateDrawSettings(first, { startNumber: '001', endNumber: '002' });
    expect(range.winnerHistory).toHaveLength(1);
    expect(range.availableNumbers.map((person) => person.number)).toEqual(['002']);
    const imported = updateDrawSettings(range, { participants: [{ number: '001', name: 'Ada' }, { number: '003', name: 'Ben' }] });
    expect(imported.availableNumbers.map((person) => person.number)).toEqual(['003']);
    expect(resetDrawHistory(imported).availableNumbers).toEqual(imported.settings.participants);
  });

  it('round trips through storage and recovers a corrupt record with defaults', () => {
    const storage = memoryStorage();
    const record = reserveDraw(createDefaultRecord(), () => 0, 'first');
    writeDrawRecord(storage, record);
    expect(readDrawRecord(storage)).toEqual(record);
    storage.setItem('lantern-parade-draw-v1', '{bad');
    expect(readDrawRecord(storage)).toEqual(createDefaultRecord());
    const invalid = { ...record, settings: { ...record.settings, startNumber: 'invalid' } };
    storage.setItem('lantern-parade-draw-v1', JSON.stringify(invalid));
    expect(readDrawRecord(storage)).toEqual(createDefaultRecord());
  });

  it('rebuilds eligibility when saved pool data conflicts with the source or winner history', () => {
    const storage = memoryStorage();
    const fresh = createDefaultRecord();
    storage.setItem('lantern-parade-draw-v1', JSON.stringify({ ...fresh, availableNumbers: [] }));
    expect(readDrawRecord(storage).availableNumbers).toHaveLength(300);

    const drawn = reserveDraw(fresh, () => 0, 'first');
    storage.setItem('lantern-parade-draw-v1', JSON.stringify({ ...drawn, availableNumbers: fresh.availableNumbers }));
    const restored = readDrawRecord(storage);
    expect(restored.winnerHistory).toEqual(drawn.winnerHistory);
    expect(restored.availableNumbers).toHaveLength(299);
    expect(restored.availableNumbers.some(({ number }) => number === '001')).toBe(false);
  });

  it('propagates storage write failure so draw presentation can be stopped', () => {
    const storage = memoryStorage();
    storage.setItem = vi.fn(() => { throw new Error('Quota exceeded'); });
    expect(() => writeDrawRecord(storage, createDefaultRecord())).toThrow('Quota exceeded');
  });

  it('recovers from saved ranges, imported lists, and available pools above the cap', () => {
    const storage = memoryStorage();
    const base = createDefaultRecord();
    const oversized = Array.from({ length: 10001 }, (_, index) => ({ number: String(index) }));
    for (const invalid of [
      { ...base, settings: { ...base.settings, endNumber: '10001' } },
      { ...base, settings: { ...base.settings, participants: oversized } },
      { ...base, availableNumbers: oversized },
    ]) {
      storage.setItem('lantern-parade-draw-v1', JSON.stringify(invalid));
      expect(readDrawRecord(storage)).toEqual(createDefaultRecord());
    }
  });
});
