import { describe, expect, it } from 'vitest';
import {
  advanceLanternMotion,
  clampFrameDelta,
  getNextSpawnIntervalMs,
  getTargetLanternCount,
  type LanternMotion,
} from '../../src/draw/lanternMotion';

function makeMotion(): LanternMotion {
  return {
    x: 480,
    y: 900,
    baseX: 480,
    targetBaseX: 480,
    windDistance: 0,
    velocityY: -180,
    targetVelocityY: -180,
    windSpeed: 12,
    windVariation: 1,
    swayAmplitude: 18,
    swayFrequency: 0.6,
    swayPhase: 0.4,
    rotation: 0,
    rotationAmplitude: 2,
    scale: 0.9,
    targetScale: 0.9,
    targetY: null,
  };
}

describe('continuous lantern motion', () => {
  it('clamps long frame gaps so suspended tabs never teleport', () => {
    expect(clampFrameDelta(0.5)).toBe(0.033);
    expect(clampFrameDelta(-1)).toBe(0);
    expect(clampFrameDelta(0.016)).toBe(0.016);
  });

  it('scales the active target with viewport area while staying between 24 and 36', () => {
    expect(getTargetLanternCount(390, 844)).toBe(24);
    expect(getTargetLanternCount(1280, 720)).toBe(24);
    expect(getTargetLanternCount(1920, 1080)).toBe(32);
    expect(getTargetLanternCount(2560, 1440)).toBe(36);
  });

  it('shortens spawn intervals when density is low and bounds natural jitter', () => {
    const fastest = getNextSpawnIntervalMs(12, 32, () => 0);
    const steady = getNextSpawnIntervalMs(32, 32, () => 50);
    const slowest = getNextSpawnIntervalMs(36, 32, () => 60);
    expect(fastest).toBeGreaterThanOrEqual(120);
    expect(fastest).toBeLessThan(steady);
    expect(slowest).toBeGreaterThan(steady);
    expect([fastest, steady, slowest].every((interval) => interval >= 120 && interval <= 450)).toBe(true);
  });

  it('moves at comparable speed at 30Hz and 60Hz', () => {
    const at30 = makeMotion();
    const at60 = makeMotion();
    for (let frame = 1; frame <= 30; frame += 1) advanceLanternMotion(at30, 1 / 30, frame / 30);
    for (let frame = 1; frame <= 60; frame += 1) advanceLanternMotion(at60, 1 / 60, frame / 60);
    expect(Math.abs(at30.y - at60.y)).toBeLessThan(2);
    expect(Math.abs(at30.x - at60.x)).toBeLessThan(2);
  });

  it('eases toward new speed and scale targets without an instant jump', () => {
    const motion = makeMotion();
    motion.targetVelocityY = -420;
    motion.targetScale = 1.8;
    advanceLanternMotion(motion, 1 / 60, 1 / 60);
    expect(motion.velocityY).toBeGreaterThan(-420);
    expect(motion.velocityY).toBeLessThan(-180);
    expect(motion.scale).toBeGreaterThan(0.9);
    expect(motion.scale).toBeLessThan(1.8);
  });

  it('uses a shared rightward drift with a constrained, slow sway', () => {
    const motion = makeMotion();
    advanceLanternMotion(motion, 1 / 30, 2);
    expect(motion.x).toBeGreaterThan(motion.baseX - motion.swayAmplitude);
    expect(motion.x).toBeLessThan(motion.baseX + motion.windDistance + motion.swayAmplitude);
    expect(Math.abs(motion.rotation)).toBeLessThanOrEqual(2);
  });
});
