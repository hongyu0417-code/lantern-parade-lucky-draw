export const MOTION_POOL_CAPACITY = 28;
export const MIN_ACTIVE_LANTERNS = 18;
export const MAX_ACTIVE_LANTERNS = 28;
export const MIN_SPAWN_INTERVAL_MS = 120;
export const MAX_SPAWN_INTERVAL_MS = 450;
export const MAX_FRAME_DELTA_SECONDS = 0.033;

export type LanternMotion = {
  x: number;
  y: number;
  baseX: number;
  targetBaseX: number;
  windDistance: number;
  velocityY: number;
  targetVelocityY: number;
  windSpeed: number;
  swayAmplitude: number;
  swayFrequency: number;
  swayPhase: number;
  rotation: number;
  rotationAmplitude: number;
  scale: number;
  targetScale: number;
  targetY: number | null;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function checkedRandomIndex(randomIndex: (exclusiveMax: number) => number, max: number): number {
  const index = randomIndex(max);
  if (!Number.isInteger(index) || index < 0 || index >= max) {
    throw new Error(`Random index must be an integer between 0 and ${max - 1}.`);
  }
  return index;
}

export function clampFrameDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.min(deltaSeconds, MAX_FRAME_DELTA_SECONDS);
}

export function getTargetLanternCount(width: number, height: number): number {
  const area = Math.max(1, width) * Math.max(1, height);
  const referenceArea = 1280 * 720;
  return clamp(Math.round(22 * Math.sqrt(area / referenceArea)), MIN_ACTIVE_LANTERNS, MAX_ACTIVE_LANTERNS);
}

export function getNextSpawnIntervalMs(
  activeCount: number,
  targetCount: number,
  randomIndex: (exclusiveMax: number) => number,
): number {
  const jitter = checkedRandomIndex(randomIndex, 121) - 60;
  const deficit = targetCount - activeCount;
  const base = 235 - deficit * 12;
  return clamp(Math.round(base + jitter), MIN_SPAWN_INTERVAL_MS, MAX_SPAWN_INTERVAL_MS);
}

/** Advances one lantern with frame-rate-independent easing and bounded motion. */
export function advanceLanternMotion(
  motion: LanternMotion,
  deltaSeconds: number,
  elapsedSeconds: number,
): LanternMotion {
  const delta = clampFrameDelta(deltaSeconds);
  if (delta === 0) return motion;

  const velocityBlend = 1 - Math.exp(-2.8 * delta);
  const scaleBlend = 1 - Math.exp(-4.2 * delta);
  const positionBlend = 1 - Math.exp(-1.65 * delta);
  const previousVelocityY = motion.velocityY;
  motion.velocityY += (motion.targetVelocityY - motion.velocityY) * velocityBlend;
  motion.windDistance += motion.windSpeed * delta;
  if (motion.targetY === null) {
    motion.y += (previousVelocityY + motion.velocityY) * 0.5 * delta;
  } else {
    motion.y += (previousVelocityY + motion.velocityY) * 0.5 * delta;
    motion.y += (motion.targetY - motion.y) * positionBlend;
  }
  motion.baseX += (motion.targetBaseX - motion.baseX) * positionBlend;
  motion.scale += (motion.targetScale - motion.scale) * scaleBlend;
  motion.x = motion.baseX + motion.windDistance + Math.sin(elapsedSeconds * motion.swayFrequency + motion.swayPhase) * motion.swayAmplitude;
  motion.rotation = Math.sin(elapsedSeconds * motion.swayFrequency + motion.swayPhase) * motion.rotationAmplitude;
  return motion;
}
