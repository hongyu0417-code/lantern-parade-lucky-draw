import { describe, expect, it, vi } from 'vitest';
import { buildNumericPool, parseParticipantsCsv, selectWinner } from '../../src/draw/pool';

describe('buildNumericPool', () => {
  it('creates an inclusive zero-padded range', () => {
    expect(buildNumericPool('007', '010')).toEqual([
      { number: '007' }, { number: '008' }, { number: '009' }, { number: '010' },
    ]);
  });

  it.each([
    ['', '3'], ['x', '3'], ['1', 'x'], ['1.2', '3'], ['-1', '3'], ['1', ''],
  ])('rejects invalid ranges %j through %j', (start, end) => {
    expect(() => buildNumericPool(start, end)).toThrow();
  });

  it('rejects a reversed range', () => {
    expect(() => buildNumericPool('10', '2')).toThrow(/end/i);
  });

  it('rejects a range above 10,000 before constructing participants', () => {
    expect(buildNumericPool('1', '10000')).toHaveLength(10000);
    expect(() => buildNumericPool('1', '10001')).toThrow(/10,?000/);
  });
});

describe('parseParticipantsCsv', () => {
  it('parses rows with a number/name header and quoted commas', () => {
    expect(parseParticipantsCsv('number,name\n001,"Lee, Mei"\n002,Sam')).toEqual({
      participants: [{ number: '001', name: 'Lee, Mei' }, { number: '002', name: 'Sam' }],
      errors: [],
    });
  });

  it('parses rows without a header and ignores blank rows', () => {
    expect(parseParticipantsCsv('\n001,Ada\n\n002,Ben\n')).toEqual({
      participants: [{ number: '001', name: 'Ada' }, { number: '002', name: 'Ben' }],
      errors: [],
    });
  });

  it('collects malformed-row and duplicate-number errors while keeping valid rows', () => {
    const parsed = parseParticipantsCsv('number,name\n001,Ada\nbroken\n001,Other\n002,Ben,Extra');
    expect(parsed.participants).toEqual([{ number: '001', name: 'Ada' }]);
    expect(parsed.errors).toHaveLength(3);
    expect(parsed.errors.join(' ')).toMatch(/row 3/i);
    expect(parsed.errors.join(' ')).toMatch(/duplicate/i);
    expect(parsed.errors.join(' ')).toMatch(/row 5/i);
  });

  it('accepts a number-only row', () => {
    expect(parseParticipantsCsv('number\n003')).toEqual({
      participants: [{ number: '003' }],
      errors: [],
    });
  });

  it('reports an unclosed quoted field instead of swallowing following participant rows', () => {
    const parsed = parseParticipantsCsv('number,name\n001,"Ada\n002,Ben');
    expect(parsed.participants).toEqual([]);
    expect(parsed.errors).toEqual([expect.stringMatching(/row 2.*quote/i)]);
  });

  it('reports misplaced quote characters in a field', () => {
    const parsed = parseParticipantsCsv('number,name\n001,Ad"a');
    expect(parsed.participants).toEqual([]);
    expect(parsed.errors).toEqual(['Row 2: malformed quote syntax.']);
  });

  it('rejects more than 10,000 imported participants without returning a partial pool', () => {
    const input = Array.from({ length: 10001 }, (_, index) => String(index + 1)).join('\n');
    const parsed = parseParticipantsCsv(input);
    expect(parsed.participants).toEqual([]);
    expect(parsed.errors.join(' ')).toMatch(/10,?000/);
  });
});

describe('selectWinner', () => {
  const eligible = [{ number: '001', name: 'Ada' }, { number: '002', name: 'Ben' }];

  it('selects by the injected random index and removes the winner when duplicates are prevented', () => {
    const randomIndex = vi.fn(() => 1);
    expect(selectWinner(eligible, true, randomIndex)).toEqual({
      winner: { number: '002', name: 'Ben' },
      availableNumbers: [{ number: '001', name: 'Ada' }],
    });
    expect(randomIndex).toHaveBeenCalledWith(2);
  });

  it('keeps the eligible pool unchanged when repeats are enabled', () => {
    expect(selectWinner(eligible, false, () => 0)).toEqual({
      winner: { number: '001', name: 'Ada' },
      availableNumbers: eligible,
    });
  });

  it('rejects an empty pool and invalid random index results', () => {
    expect(() => selectWinner([], true, () => 0)).toThrow(/empty/i);
    expect(() => selectWinner(eligible, true, () => -1)).toThrow(/random/i);
    expect(() => selectWinner(eligible, true, () => 2)).toThrow(/random/i);
    expect(() => selectWinner(eligible, true, () => 0.5)).toThrow(/random/i);
  });
});
