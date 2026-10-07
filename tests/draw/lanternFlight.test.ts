import { describe, expect, it } from 'vitest';
import { createLanternFlightPlans } from '../../src/draw/lanternFlight';
import type { Participant } from '../../src/draw/types';

const participants = (count: number): Participant[] => Array.from({ length: count }, (_, index) => ({
  number: String(index + 1).padStart(3, '0'),
}));

function steppingRandom() {
  let value = 1_234_567;
  return (max: number) => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value % max;
  };
}

describe('lantern upward flight plans', () => {
  it('organically staggers launches, shares the wind, and keeps the protected trio moving for eight and a half seconds', () => {
    const candidates = participants(28);
    const finalists = [{ number: '013' }, { number: '007' }, { number: '021' }];
    const plans = createLanternFlightPlans(candidates, finalists, finalists[1], steppingRandom());
    const ordinary = plans.filter(({ finalistRole }) => finalistRole === null);
    const protectedNumbers = plans.filter(({ finalistRole }) => finalistRole !== null).map(({ number }) => number);

    expect(plans).toHaveLength(28);
    expect(new Set(plans.map(({ number }) => number)).size).toBe(28);
    expect(new Set(plans.map(({ launchDelayMs }) => launchDelayMs)).size).toBeGreaterThan(20);
    expect(new Set(plans.map(({ curveOneVw, curveTwoVw }) => `${curveOneVw}:${curveTwoVw}`)).size).toBeGreaterThan(20);
    expect(new Set(plans.map(({ depth }) => depth))).toEqual(new Set(['background', 'midground', 'foreground']));
    expect(ordinary).toHaveLength(25);
    expect(ordinary.every(({ exitAtMs, flightDurationMs, launchDelayMs }) => exitAtMs !== null && exitAtMs >= 3500 && exitAtMs <= 6900 && launchDelayMs <= 1500 && flightDurationMs === exitAtMs - launchDelayMs)).toBe(true);
    expect(new Set(protectedNumbers)).toEqual(new Set(['013', '007', '021']));
    expect(plans.find(({ number }) => number === '007')?.finalistRole).toBe('winner');
    expect(plans.filter(({ finalistRole }) => finalistRole !== null).every(({ exitAtMs, flightDurationMs, launchDelayMs }) => exitAtMs === null && flightDurationMs + launchDelayMs === 8_500)).toBe(true);
    expect(plans.every(({ curveOneVw, curveTwoVw }) => curveOneVw >= -4 && curveOneVw <= 7 && curveTwoVw >= -4 && curveTwoVw <= 7)).toBe(true);
  });

  it('keeps every entry alive when the pool contains fewer than three participants', () => {
    const candidates = participants(2);
    const plans = createLanternFlightPlans(candidates, candidates, candidates[0], () => 0);

    expect(plans).toHaveLength(2);
    expect(plans.every(({ finalistRole, exitAtMs }) => finalistRole !== null && exitAtMs === null)).toBe(true);
  });
});
