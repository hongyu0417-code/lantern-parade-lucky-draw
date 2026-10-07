import type { Participant } from './types';

export type LanternDepth = 'background' | 'midground' | 'foreground';
export type LanternFlightPlan = {
  number: string;
  launchDelayMs: number;
  exitAtMs: number | null;
  flightDurationMs: number;
  depth: LanternDepth;
  depthScale: number;
  depthOpacity: number;
  prevailingWindVw: number;
  launchLeftPercent: number;
  launchTopVh: number;
  curveOneVw: number;
  curveTwoVw: number;
  finalistShiftVw: number;
  finalistRole: 'winner' | 'other' | null;
};

const FINALIST_ARRIVAL_MS = 8_500;
const MAX_STAGGER_MS = 1_500;
const DEPTHS: LanternDepth[] = ['background', 'midground', 'foreground'];

function checkedIndex(randomIndex: (exclusiveMax: number) => number, exclusiveMax: number): number {
  const index = randomIndex(exclusiveMax);
  if (!Number.isInteger(index) || index < 0 || index >= exclusiveMax) {
    throw new Error(`Random index must be an integer between 0 and ${exclusiveMax - 1}.`);
  }
  return index;
}

function depthScale(depth: LanternDepth, randomIndex: (max: number) => number): number {
  if (depth === 'background') return 0.56 + checkedIndex(randomIndex, 20) / 100;
  if (depth === 'foreground') return 1.05 + checkedIndex(randomIndex, 22) / 100;
  return 0.8 + checkedIndex(randomIndex, 20) / 100;
}

function depthOpacity(depth: LanternDepth, randomIndex: (max: number) => number): number {
  if (depth === 'background') return 0.62 + checkedIndex(randomIndex, 14) / 100;
  if (depth === 'foreground') return 0.9 + checkedIndex(randomIndex, 9) / 100;
  return 0.82 + checkedIndex(randomIndex, 13) / 100;
}

function exitTime(index: number, count: number, randomIndex: (max: number) => number, depth: LanternDepth): number {
  const progress = count <= 1 ? 0 : (index + 0.5) / count;
  const window = progress < 0.32 ? [3_450, 3_900]
    : progress < 0.64 ? [4_150, 4_600]
      : progress < 0.84 ? [4_950, 5_450]
        : progress < 0.92 ? [5_700, 6_050]
          : [6_400, 6_900];
  const time = window[0] + checkedIndex(randomIndex, window[1] - window[0] + 1);
  const speedAdjustment = depth === 'foreground' ? -80 : depth === 'background' ? 80 : 0;
  return Math.max(3_500, Math.min(6_900, time + speedAdjustment));
}

/** Builds presentation-only paths and timing; the saved winner is selected elsewhere. */
export function createLanternFlightPlans(
  candidates: Participant[],
  finalists: Participant[],
  winner: Participant,
  randomIndex: (exclusiveMax: number) => number,
): LanternFlightPlan[] {
  const uniqueCandidates = new Set(candidates.map(({ number }) => number));
  const uniqueFinalists = new Set(finalists.map(({ number }) => number));
  if (uniqueCandidates.size !== candidates.length || uniqueFinalists.size !== finalists.length) {
    throw new Error('Lantern flight plans require unique participant numbers.');
  }
  if (!uniqueFinalists.has(winner.number) || finalists.length < 1 || finalists.length > 3) {
    throw new Error('The saved winner must be in a finalist roster of up to three entries.');
  }
  if (finalists.some(({ number }) => !uniqueCandidates.has(number))) {
    throw new Error('Every finalist must be in the lantern flight roster.');
  }

  const ordinary = candidates.filter(({ number }) => !uniqueFinalists.has(number));
  const finalistSlots = finalists.length === 1 ? [50] : finalists.length === 2 ? [42, 58] : [36, 50, 64];
  const finalistSlotByNumber = new Map(finalists.map(({ number }, index) => [number, finalistSlots[index]]));
  const ordinaryIndexByNumber = new Map(ordinary.map(({ number }, index) => [number, index]));
  const prevailingWindVw = 1 + checkedIndex(randomIndex, 5) * 0.4;

  return candidates.map(({ number }, index) => {
    const finalistSlot = finalistSlotByNumber.get(number);
    const depth = DEPTHS[checkedIndex(randomIndex, DEPTHS.length)];
    const progress = candidates.length <= 1 ? 0 : index / (candidates.length - 1);
    const stagger = progress * MAX_STAGGER_MS + checkedIndex(randomIndex, 121) - 60;
    const launchDelayMs = Math.max(0, Math.min(MAX_STAGGER_MS, Math.round(stagger)));
    const launchLeftPercent = finalistSlot === undefined
      ? 8 + checkedIndex(randomIndex, 85)
      : finalistSlot - 6 + checkedIndex(randomIndex, 13);
    const launchTopVh = 105 + checkedIndex(randomIndex, 21);
    const curveOneVw = prevailingWindVw + (checkedIndex(randomIndex, 13) - 6) * 0.5;
    const curveTwoVw = prevailingWindVw + (checkedIndex(randomIndex, 13) - 6) * 0.45;
    const finalistRole = finalistSlot === undefined ? null : number === winner.number ? 'winner' : 'other';
    const scale = depthScale(depth, randomIndex);
    const opacity = depthOpacity(depth, randomIndex);

    if (finalistSlot !== undefined) {
      return {
        number,
        launchDelayMs,
        exitAtMs: null,
        flightDurationMs: FINALIST_ARRIVAL_MS - launchDelayMs,
        depth,
        depthScale: scale,
        depthOpacity: opacity,
        prevailingWindVw,
        launchLeftPercent,
        launchTopVh,
        curveOneVw,
        curveTwoVw,
        finalistShiftVw: finalistSlot - 50,
        finalistRole,
      };
    }

    const ordinaryIndex = ordinaryIndexByNumber.get(number)!;
    const exitAtMs = exitTime(ordinaryIndex, ordinary.length, randomIndex, depth);
    return {
      number,
      launchDelayMs,
      exitAtMs,
      flightDurationMs: exitAtMs - launchDelayMs,
      depth,
      depthScale: scale,
      depthOpacity: opacity,
      prevailingWindVw,
      launchLeftPercent,
      launchTopVh,
      curveOneVw,
      curveTwoVw,
      finalistShiftVw: 0,
      finalistRole: null,
    };
  });
}
