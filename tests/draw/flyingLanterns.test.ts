import { describe, expect, it } from 'vitest';
import { createCandidateLanterns } from '../../src/draw/flyingLanterns';
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
});
