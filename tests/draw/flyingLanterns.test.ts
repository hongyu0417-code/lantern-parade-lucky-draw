import { describe, expect, it } from 'vitest';
import { createCandidateLanterns, createFinalistLanterns } from '../../src/draw/flyingLanterns';
import type { Participant } from '../../src/draw/types';

const participants = (count: number): Participant[] => Array.from({ length: count }, (_, index) => ({
  number: String(index + 1).padStart(3, '0'),
  name: `Guest ${index + 1}`,
}));

describe('numbered lantern candidates', () => {
  it('includes the saved winner in a random, unique roster of 20–36 eligible numbers', () => {
    const eligible = participants(80);
    const winner = eligible[51];
    const roster = createCandidateLanterns(eligible, winner, (max) => max - 1);
    const numbers = roster.map(({ number }) => number);

    expect(roster).toHaveLength(28);
    expect(numbers).toContain('052');
    expect(new Set(numbers).size).toBe(28);
    expect(numbers.every((number) => eligible.some((person) => person.number === number))).toBe(true);
  });

  it('clamps requested sizes to the promised visible range for a large pool', () => {
    const eligible = participants(50);
    expect(createCandidateLanterns(eligible, eligible[0], () => 0, 5)).toHaveLength(20);
    expect(createCandidateLanterns(eligible, eligible[0], () => 0, 90)).toHaveLength(36);
  });

  it('uses each real participant once when fewer than 20 people are eligible', () => {
    const eligible = participants(6);
    const roster = createCandidateLanterns(eligible, eligible[4], () => 0);

    expect(roster.map(({ number }) => number).sort()).toEqual(['001', '002', '003', '004', '005', '006']);
    expect(new Set(roster.map(({ number }) => number)).size).toBe(6);
  });

  it('rejects a winner that was not in the eligible pool', () => {
    expect(() => createCandidateLanterns(participants(4), { number: '999' }, () => 0)).toThrow(/winner.*eligible/i);
  });

  it('rejects an out-of-range random index instead of silently choosing an invalid number', () => {
    const eligible = participants(40);
    expect(() => createCandidateLanterns(eligible, eligible[0], () => 999)).toThrow(/random index/i);
  });

  it('picks three distinct real finalists in random positions and always includes the saved winner', () => {
    const candidates = participants(24);
    const winner = candidates[12];
    const winnerFirst = createFinalistLanterns(candidates, winner, () => 0);
    const winnerLast = createFinalistLanterns(candidates, winner, (max) => max - 1);

    for (const finalists of [winnerFirst, winnerLast]) {
      expect(finalists).toHaveLength(3);
      expect(new Set(finalists.map(({ number }) => number)).size).toBe(3);
      expect(finalists).toContainEqual(winner);
      expect(finalists.every(({ number }) => candidates.some((candidate) => candidate.number === number))).toBe(true);
    }
    expect(winnerFirst[0]).toEqual(winner);
    expect(winnerLast[2]).toEqual(winner);
  });

  it('uses every real entry when fewer than three candidates are available', () => {
    const candidates = [{ number: '013' }, { number: '022' }];
    expect(createFinalistLanterns(candidates, candidates[0], () => 0).map(({ number }) => number).sort())
      .toEqual(candidates.map(({ number }) => number).sort());
  });

  it('rejects a finalist winner that is missing from the flight roster', () => {
    expect(() => createFinalistLanterns(participants(4), { number: '999' }, () => 0)).toThrow(/winner.*roster/i);
  });
});
