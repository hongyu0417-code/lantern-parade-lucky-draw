import { describe, expect, it } from 'vitest';
import {
  getNextSpawnIntervalMs,
  getTargetLanternCount,
  LANTERN_SPEED_MULTIPLIER,
  LOSER_EXIT_OFFSET_MS,
  MAX_ACTIVE_LANTERNS,
  MIN_ACTIVE_LANTERNS,
  MOTION_POOL_CAPACITY,
} from './lanternMotion';

describe('continuous lantern field motion', () => {
  it('keeps enough pooled lanterns for a 30 lantern 1080p field', () => {
    expect(MOTION_POOL_CAPACITY).toBeGreaterThanOrEqual(36);
    expect(MAX_ACTIVE_LANTERNS).toBe(36);
    expect(MIN_ACTIVE_LANTERNS).toBe(24);
    expect(getTargetLanternCount(1920, 1080)).toBe(32);
    expect(LANTERN_SPEED_MULTIPLIER).toBe(1.2);
    expect(LOSER_EXIT_OFFSET_MS).toBeGreaterThanOrEqual(200);
    expect(LOSER_EXIT_OFFSET_MS).toBeLessThanOrEqual(400);
  });

  it('rolls the spawn interval against the current lantern count', () => {
    const noJitter = () => 60;
    const belowTarget = getNextSpawnIntervalMs(20, 30, noJitter);
    const atTarget = getNextSpawnIntervalMs(30, 30, noJitter);
    const aboveTarget = getNextSpawnIntervalMs(35, 30, noJitter);

    expect(belowTarget).toBeLessThan(atTarget);
    expect(atTarget).toBeLessThan(aboveTarget);
    expect(belowTarget).toBeGreaterThanOrEqual(120);
    expect(aboveTarget).toBeLessThanOrEqual(450);
  });
});
