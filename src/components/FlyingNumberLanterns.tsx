import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LanternAudioEvent } from './AudioController';
import type { DrawPhase, Participant, WinnerRecord } from '../draw/types';
import { createLanternFlightPlan, type LanternFlightPlan } from '../draw/lanternFlight';
import { chooseNextLanternParticipant, createInitialLanternRoster } from '../draw/flyingLanterns';
import { createSecureRandomIndex } from '../draw/random';
import { advanceLanternMotion, getNextSpawnIntervalMs, getTargetLanternCount, MOTION_POOL_CAPACITY, type LanternMotion } from '../draw/lanternMotion';
import { getDisplayUsername, usesCompactUsernameTypography } from '../draw/usernames';

type LabelTransition = { from: 0 | 1; to: 0 | 1; startedAt: number };
type Carrier = {
  instanceId: number;
  initialParticipant: Participant;
  participant: Participant;
  plan: LanternFlightPlan;
  motion: LanternMotion;
  active: boolean;
  entered: boolean;
  finalistSlot: number | null;
  loserOrder: number | null;
  element: HTMLDivElement | null;
  labels: [HTMLSpanElement | null, HTMLSpanElement | null];
  labelIndex: 0 | 1;
  labelTransition: LabelTransition | null;
  bindElement: (node: HTMLDivElement | null) => void;
  bindFirstLabel: (node: HTMLSpanElement | null) => void;
  bindSecondLabel: (node: HTMLSpanElement | null) => void;
};

type FlyingNumberLanternsProps = {
  phase: DrawPhase;
  eligible: Participant[];
  finalists: Participant[];
  winner: WinnerRecord | null;
  reducedMotion: boolean;
  stopRequested: { current: boolean };
  onAdvancePhase: () => void;
  onMotionEvent: (event: LanternAudioEvent) => void;
};

type BurstPoint = { x: number; y: number; offsetX: number; offsetY: number };

const BURST_FRAGMENTS = Array.from({ length: 20 }, (_, index) => index);
const FINAL_PHASES = new Set<DrawPhase>(['finalist1', 'magnifying', 'charging', 'burst', 'revealing']);
const ELIMINATION_PHASES = new Set<DrawPhase>(['eliminatingToTwo', 'eliminatingToOne']);
const FINAL_HOLD_PHASES = new Set<DrawPhase>(['finalists3', 'finalists2', 'finalist1']);
const LANTERN_HEIGHT = 124;

function checkedRandom(randomIndex: (exclusiveMax: number) => number, max: number): number {
  const value = randomIndex(max);
  return Number.isInteger(value) && value >= 0 && value < max ? value : 0;
}

function makeCarrier(index: number, participant: Participant, randomIndex: (max: number) => number, width: number, height: number): Carrier {
  const plan = createLanternFlightPlan(participant.number, randomIndex, 0);
  const baseX = width * plan.launchLeftPercent / 100;
  const launchY = height * plan.launchTopVh / 100;
  const motion: LanternMotion = {
    x: baseX,
    y: launchY,
    baseX,
    targetBaseX: baseX,
    windDistance: 0,
    velocityY: 0,
    targetVelocityY: 0,
    windSpeed: 0,
    swayAmplitude: 0,
    swayFrequency: 0.6,
    swayPhase: index * 0.73,
    rotation: 0,
    rotationAmplitude: 0,
    scale: plan.depthScale,
    targetScale: plan.depthScale,
    targetY: null,
  };
  const carrier: Carrier = {
    instanceId: index,
    initialParticipant: participant,
    participant,
    plan,
    motion,
    active: false,
    entered: false,
    finalistSlot: null,
    loserOrder: null,
    element: null,
    labels: [null, null],
    labelIndex: 0,
    labelTransition: null,
    bindElement: (node) => { carrier.element = node; },
    bindFirstLabel: (node) => { carrier.labels[0] = node; },
    bindSecondLabel: (node) => { carrier.labels[1] = node; },
  };
  return carrier;
}

function setLabelText(node: HTMLSpanElement | null, username: string, visible: boolean): void {
  if (!node) return;
  node.textContent = getDisplayUsername(username);
  node.style.setProperty('--username-visible-length', String(Array.from(getDisplayUsername(username)).length));
  if (usesCompactUsernameTypography(username)) node.dataset.username = 'true';
  else delete node.dataset.username;
  node.style.opacity = visible ? '1' : '0';
  node.style.visibility = visible ? 'visible' : 'hidden';
}

function setIdentity(carrier: Carrier, participant: Participant, crossFade: boolean, elapsed: number): void {
  if (carrier.participant.number === participant.number) return;
  const previousIndex = carrier.labelIndex;
  const nextIndex = previousIndex === 0 ? 1 : 0;
  const previousNumber = carrier.participant.number;
  carrier.participant = participant;
  if (carrier.element) {
    carrier.element.dataset.number = participant.number;
    carrier.element.dataset.flightNumber = participant.number;
    carrier.element.setAttribute('aria-label', `号码 ${getDisplayUsername(participant.number)}`);
  }
  setLabelText(carrier.labels[nextIndex], participant.number, true);
  if (crossFade && carrier.active) {
    setLabelText(carrier.labels[previousIndex], previousNumber, true);
    if (carrier.labels[previousIndex]) {
      carrier.labels[previousIndex]!.style.opacity = '1';
      carrier.labels[nextIndex]!.style.opacity = '0';
    }
    carrier.labelTransition = { from: previousIndex, to: nextIndex, startedAt: elapsed };
  } else {
    setLabelText(carrier.labels[previousIndex], '', false);
    carrier.labelTransition = null;
  }
  carrier.labelIndex = nextIndex;
}

function advanceLabelTransition(carrier: Carrier, elapsed: number): void {
  const transition = carrier.labelTransition;
  if (!transition) return;
  const progress = Math.min(1, (elapsed - transition.startedAt) / 0.24);
  const from = carrier.labels[transition.from];
  const to = carrier.labels[transition.to];
  if (from) from.style.opacity = String(1 - progress);
  if (to) to.style.opacity = String(progress);
  if (progress >= 1) {
    setLabelText(from, '', false);
    if (to) to.style.opacity = '1';
    carrier.labelTransition = null;
  }
}

function setCarrierActive(carrier: Carrier, participant: Participant, plan: LanternFlightPlan, width: number, height: number, reducedMotion: boolean, elapsed: number, randomIndex: (max: number) => number): void {
  const baseX = width * plan.launchLeftPercent / 100;
  const launchY = height * plan.launchTopVh / 100;
  const duration = plan.flightDurationMs / 1_000;
  const initialSpeed = (height * (plan.launchTopVh / 100 + 0.12)) / Math.max(3, duration);
  carrier.plan = plan;
  carrier.active = true;
  carrier.entered = false;
  carrier.finalistSlot = null;
  carrier.loserOrder = null;
  carrier.motion = {
    x: baseX,
    y: launchY,
    baseX,
    targetBaseX: baseX,
    windDistance: 0,
    velocityY: -initialSpeed,
    targetVelocityY: -initialSpeed,
    windSpeed: (width * plan.prevailingWindVw / 100) / duration,
    swayAmplitude: width * (reducedMotion ? 0.0012 : 0.0035),
    swayFrequency: reducedMotion ? 0.28 : 0.62 + checkedRandom(randomIndex, 36) / 100,
    swayPhase: checkedRandom(randomIndex, 628) / 100,
    rotation: 0,
    rotationAmplitude: reducedMotion ? 0.25 : 0.55 + checkedRandom(randomIndex, 120) / 100,
    scale: plan.depthScale * 0.88,
    targetScale: plan.depthScale,
    targetY: null,
  };
  setIdentity(carrier, participant, false, elapsed);
  if (carrier.element) {
    carrier.element.dataset.active = 'true';
    carrier.element.dataset.depth = plan.depth;
    delete carrier.element.dataset.finalist;
    delete carrier.element.dataset.finalistSlot;
    delete carrier.element.dataset.loserOrder;
    carrier.element.setAttribute('aria-hidden', 'false');
    carrier.element.style.visibility = 'visible';
    carrier.element.style.willChange = 'transform, opacity';
    carrier.element.classList.toggle('flying-number-lantern--finalist', false);
    carrier.element.classList.toggle('flying-number-lantern--slow-floating', false);
    carrier.element.classList.toggle('flying-number-lantern--finalist-leaving', false);
    carrier.element.classList.toggle('flying-number-lantern--winner-gliding', false);
    carrier.element.classList.toggle('flying-number-lantern--winner-focus', false);
    carrier.element.classList.toggle('flying-number-lantern--charging', false);
    carrier.element.classList.toggle('flying-number-lantern--bursting', false);
  }
}

function writeMotion(carrier: Carrier, width: number, height: number): void {
  const element = carrier.element;
  if (!element) return;
  const { motion } = carrier;
  const size = LANTERN_HEIGHT;
  let opacity = carrier.plan.depthOpacity;
  const entryStart = height + 24;
  const entryEnd = height - Math.min(104, size * 0.85);
  if (motion.y > entryEnd) opacity *= Math.max(0, Math.min(1, (entryStart - motion.y) / (entryStart - entryEnd)));
  const exitStart = -size * 0.12;
  const exitEnd = -size * 1.1;
  if (motion.y < exitStart) opacity *= Math.max(0, Math.min(1, (motion.y - exitEnd) / (exitStart - exitEnd)));
  const x = Math.max(-size, Math.min(width + size, motion.x));
  const y = Math.min(height * 1.4, Math.max(-height * 1.35, motion.y));
  element.style.opacity = String(opacity);
  element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${motion.scale.toFixed(4)}) rotate(${motion.rotation.toFixed(3)}deg)`;
}

function applyPhaseClasses(carrier: Carrier, phase: DrawPhase, winner: WinnerRecord | null): void {
  const element = carrier.element;
  if (!element || !carrier.active) return;
  if (carrier.finalistSlot === null) {
    delete element.dataset.finalist;
    delete element.dataset.finalistSlot;
    delete element.dataset.loserOrder;
  } else {
    element.dataset.finalist = 'true';
    element.dataset.finalistSlot = String(carrier.finalistSlot);
    if (carrier.loserOrder === null) delete element.dataset.loserOrder;
    else element.dataset.loserOrder = String(carrier.loserOrder);
  }
  const isWinner = carrier.participant.number === winner?.number;
  const leaving = (phase === 'eliminatingToTwo' && carrier.loserOrder === 0)
    || (phase === 'eliminatingToOne' && carrier.loserOrder === 1);
  element.classList.toggle('flying-number-lantern--finalist', carrier.finalistSlot !== null);
  element.classList.toggle('flying-number-lantern--slow-floating', carrier.finalistSlot !== null && FINAL_HOLD_PHASES.has(phase));
  element.classList.toggle('flying-number-lantern--finalist-leaving', leaving);
  element.classList.toggle('flying-number-lantern--winner-gliding', phase === 'magnifying' && isWinner);
  element.classList.toggle('flying-number-lantern--winner-focus', FINAL_PHASES.has(phase) && isWinner);
  element.classList.toggle('flying-number-lantern--charging', phase === 'charging' && isWinner);
  element.classList.toggle('flying-number-lantern--bursting', (phase === 'burst' || phase === 'revealing') && isWinner);
}

function getFinalistSlots(count: number): number[] {
  return count === 1 ? [50] : count === 2 ? [42, 58] : [36, 50, 64];
}

export function FlyingNumberLanterns({ phase, eligible, finalists, winner, reducedMotion, stopRequested, onAdvancePhase, onMotionEvent }: FlyingNumberLanternsProps) {
  const randomRef = useRef<((exclusiveMax: number) => number) | null>(null);
  if (!randomRef.current) randomRef.current = createSecureRandomIndex();
  const randomIndex = randomRef.current;
  const uniqueEligible = useMemo(() => [...new Map(eligible.map((participant) => [participant.number, participant])).values()], [eligible]);
  const poolRef = useRef<Carrier[] | null>(null);
  const initialWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
  const initialHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
  if (!poolRef.current && uniqueEligible.length > 0) {
    const uniqueFirstPass = createInitialLanternRoster(uniqueEligible, randomIndex, Math.min(MOTION_POOL_CAPACITY, uniqueEligible.length));
    poolRef.current = Array.from({ length: MOTION_POOL_CAPACITY }, (_, index) => {
      const participant = uniqueFirstPass[index % uniqueFirstPass.length];
      return makeCarrier(index, participant, randomIndex, initialWidth, initialHeight);
    });
  }
  const carriers = poolRef.current ?? [];
  const phaseRef = useRef(phase);
  const winnerRef = useRef(winner);
  const finalistsRef = useRef(finalists);
  const eligibleRef = useRef(uniqueEligible);
  const reducedMotionRef = useRef(reducedMotion);
  const advanceRef = useRef(onAdvancePhase);
  const eventRef = useRef(onMotionEvent);
  const stopRequestedRef = useRef(stopRequested);
  phaseRef.current = phase;
  winnerRef.current = winner;
  finalistsRef.current = finalists;
  eligibleRef.current = uniqueEligible;
  reducedMotionRef.current = reducedMotion;
  advanceRef.current = onAdvancePhase;
  eventRef.current = onMotionEvent;
  stopRequestedRef.current = stopRequested;
  const elapsedRef = useRef(0);
  const readyReported = useRef(false);
  const eliminationReported = useRef(false);
  const phaseAdvanceReported = useRef<DrawPhase | null>(null);
  const lastProcessedPhase = useRef<DrawPhase | null>(null);
  const previousTime = useRef<number | null>(null);
  const nextSpawnAt = useRef(0);
  const dimensions = useRef({ width: initialWidth, height: initialHeight });
  const [burstPoint, setBurstPoint] = useState<BurstPoint | null>(null);

  const startCarrier = (carrier: Carrier, now: number, width: number, height: number) => {
    const activeNumbers = new Set(carriers.filter((candidate) => candidate.active).map((candidate) => candidate.participant.number));
    const participant = chooseNextLanternParticipant(eligibleRef.current, activeNumbers, randomIndex);
    if (!participant) return false;
    const plan = createLanternFlightPlan(participant.number, randomIndex, 0);
    setCarrierActive(carrier, participant, plan, width, height, reducedMotionRef.current, elapsedRef.current, randomIndex);
    nextSpawnAt.current = now + getNextSpawnIntervalMs(carriers.filter(({ active }) => active).length, getTargetLanternCount(width, height), randomIndex);
    return true;
  };

  const beginElimination = () => {
    const count = Math.min(3, finalistsRef.current.length);
    const inFlight = carriers
      .filter((carrier) => carrier.active)
      .sort((left, right) => {
        const leftExitTime = (left.motion.y + LANTERN_HEIGHT * 1.1) / Math.max(1, Math.abs(left.motion.velocityY));
        const rightExitTime = (right.motion.y + LANTERN_HEIGHT * 1.1) / Math.max(1, Math.abs(right.motion.velocityY));
        return rightExitTime - leftExitTime;
      });
    const selected = inFlight.slice(0, count);
    if (selected.length < count) {
      for (const carrier of carriers.filter((item) => item.active && !selected.includes(item)).sort((left, right) => right.motion.y - left.motion.y)) {
        if (selected.length >= count) break;
        selected.push(carrier);
      }
    }
    const slots = getFinalistSlots(count);
    const available = [...selected];
    const assignments = finalistsRef.current.slice(0, count).map((participant, index) => {
      const exactIndex = available.findIndex((carrier) => carrier.participant.number === participant.number);
      const chosen = exactIndex >= 0 ? available.splice(exactIndex, 1)[0] : available.shift();
      return chosen ? { participant, carrier: chosen, slot: slots[index], index } : null;
    }).filter((item): item is { participant: Participant; carrier: Carrier; slot: number; index: number } => item !== null);
    const loserOrder = new Map(finalistsRef.current.filter(({ number }) => number !== winnerRef.current?.number).map(({ number }, index) => [number, index]));
    const twoEligible = finalistsRef.current.length === 2;

    for (const carrier of carriers) {
      carrier.finalistSlot = null;
      carrier.loserOrder = null;
    }
    for (const assignment of assignments) {
      const { carrier, participant, slot } = assignment;
      setIdentity(carrier, participant, true, elapsedRef.current);
      carrier.finalistSlot = slot;
      const order = loserOrder.get(participant.number);
      carrier.loserOrder = order === undefined ? null : twoEligible ? 1 : order;
    }
    for (const carrier of carriers) applyPhaseClasses(carrier, 'eliminating', winnerRef.current);
    eliminationReported.current = false;
    phaseAdvanceReported.current = null;
    nextSpawnAt.current = Number.POSITIVE_INFINITY;
    if (assignments.length < count) {
      // The first-three entry gate normally prevents this; retain a graceful fallback for tiny viewports.
      for (const carrier of carriers.filter((item) => item.active && item.finalistSlot === null).slice(0, count - assignments.length)) {
        carrier.finalistSlot = slots[assignments.length];
      }
    }
  };

  const configureFinalists = (currentPhase: DrawPhase) => {
    const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const finalistsInPhase = carriers.filter((carrier) => {
      if (!carrier.active || carrier.finalistSlot === null) return false;
      if (currentPhase === 'eliminatingToTwo' && carrier.loserOrder === 0) return false;
      if (currentPhase === 'eliminatingToOne' && carrier.loserOrder === 1) return false;
      return true;
    }).sort((left, right) => left.motion.baseX - right.motion.baseX);
    const slots = getFinalistSlots(finalistsInPhase.length);
    finalistsInPhase.forEach((carrier, slotIndex) => {
      if (FINAL_HOLD_PHASES.has(currentPhase) || currentPhase === 'eliminatingToTwo' || currentPhase === 'eliminatingToOne') {
        carrier.motion.targetVelocityY = reducedMotionRef.current ? -3 : -9;
        carrier.motion.targetY = height * 0.43;
        carrier.motion.targetBaseX = width * (slots[slotIndex] ?? 50) / 100;
      }
    });
    for (const carrier of carriers) {
      if (!carrier.active || carrier.finalistSlot === null) continue;
      const isLeaving = (currentPhase === 'eliminatingToTwo' && carrier.loserOrder === 0)
        || (currentPhase === 'eliminatingToOne' && carrier.loserOrder === 1);
      if (isLeaving) {
        carrier.motion.targetY = null;
        carrier.motion.targetVelocityY = -Math.max(420, Math.abs(carrier.motion.velocityY));
      }
    }
    carriers.forEach((carrier) => applyPhaseClasses(carrier, currentPhase, winnerRef.current));
  };

  useLayoutEffect(() => {
    if (lastProcessedPhase.current !== phase) {
      phaseAdvanceReported.current = null;
      if (phase === 'eliminating') beginElimination();
      if (FINAL_HOLD_PHASES.has(phase) || ELIMINATION_PHASES.has(phase)) configureFinalists(phase);
      if (phase === 'magnifying') {
        const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
        const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
        const winnerCarrier = carriers.find((carrier) => carrier.active && carrier.participant.number === winner?.number);
        if (winnerCarrier) {
          winnerCarrier.motion.targetBaseX = width * 0.5;
          winnerCarrier.motion.targetY = height * 0.42;
          winnerCarrier.motion.targetVelocityY = 0;
          winnerCarrier.motion.targetScale = 1.9;
        }
      }
      carriers.forEach((carrier) => applyPhaseClasses(carrier, phase, winner));
      lastProcessedPhase.current = phase;
    }
    if (phase === 'burst') {
      const layer = document.querySelector<HTMLElement>('[data-testid="flying-number-lanterns"]');
      const lantern = Array.from(document.querySelectorAll<HTMLElement>('[data-flight-number]'))
        .find((element) => element.dataset.flightNumber === winner?.number) ?? null;
      if (layer && lantern) {
        const layerBounds = layer.getBoundingClientRect();
        const lanternBounds = lantern.getBoundingClientRect();
        if (layerBounds.width > 0 && layerBounds.height > 0) {
          const x = lanternBounds.left - layerBounds.left + lanternBounds.width / 2;
          const y = lanternBounds.top - layerBounds.top + lanternBounds.height / 2;
          setBurstPoint({ x, y, offsetX: x - layerBounds.width / 2, offsetY: y - layerBounds.height * 0.43 });
        } else setBurstPoint(null);
      }
    }
  }, [phase, finalists, winner]);

  useLayoutEffect(() => {
    let frame = 0;
    const animate = (time: number) => {
      const delta = previousTime.current === null ? 0 : Math.min(0.033, Math.max(0, (time - previousTime.current) / 1_000));
      previousTime.current = time;
      elapsedRef.current += delta;
      let width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
      let height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
      const old = dimensions.current;
      if (old.width !== width || old.height !== height) {
        const xRatio = width / old.width;
        const yRatio = height / old.height;
        for (const carrier of carriers) {
          carrier.motion.x *= xRatio;
          carrier.motion.y *= yRatio;
          carrier.motion.baseX *= xRatio;
          carrier.motion.targetBaseX *= xRatio;
          carrier.motion.windDistance *= xRatio;
          carrier.motion.velocityY *= yRatio;
          carrier.motion.targetVelocityY *= yRatio;
          if (carrier.motion.targetY !== null) carrier.motion.targetY *= yRatio;
        }
        dimensions.current = { width, height };
      }
      width = dimensions.current.width;
      height = dimensions.current.height;
      const currentPhase = phaseRef.current;

      if ((currentPhase === 'preparing' || currentPhase === 'running') && !stopRequestedRef.current.current) {
        const activeCount = carriers.reduce((count, carrier) => count + Number(carrier.active), 0);
        const targetCount = Math.min(MOTION_POOL_CAPACITY, getTargetLanternCount(width, height));
        if (activeCount < targetCount && time >= nextSpawnAt.current) {
          const carrier = carriers.find((item) => !item.active);
          if (carrier) startCarrier(carrier, time, width, height);
        } else if (activeCount >= targetCount) nextSpawnAt.current = Number.POSITIVE_INFINITY;
      }

      const activeAtFrameStart = carriers.filter((carrier) => carrier.active);
      for (const carrier of activeAtFrameStart) {
        advanceLanternMotion(carrier.motion, delta, elapsedRef.current);
        advanceLabelTransition(carrier, elapsedRef.current);
        if (!carrier.entered && carrier.motion.y <= height) carrier.entered = true;
        writeMotion(carrier, width, height);
        if (carrier.motion.y < -(LANTERN_HEIGHT * 1.1)) {
          const exitedAsFinalist = carrier.finalistSlot !== null;
          const loserOrder = carrier.loserOrder;
          carrier.active = false;
          if (carrier.element) {
            carrier.element.dataset.active = 'false';
            carrier.element.setAttribute('aria-hidden', 'true');
            carrier.element.style.visibility = 'hidden';
            carrier.element.style.opacity = '0';
            carrier.element.style.willChange = 'auto';
          }
          if (currentPhase === 'eliminatingToTwo' && exitedAsFinalist && loserOrder === 0) {
            eventRef.current('first-loser-exit');
            if (phaseAdvanceReported.current !== currentPhase) {
              phaseAdvanceReported.current = currentPhase;
              advanceRef.current();
            }
          } else if (currentPhase === 'eliminatingToOne' && exitedAsFinalist && loserOrder === 1) {
            eventRef.current('second-loser-exit');
            if (phaseAdvanceReported.current !== currentPhase) {
              phaseAdvanceReported.current = currentPhase;
              advanceRef.current();
            }
          } else if ((currentPhase === 'preparing' || currentPhase === 'running') && !stopRequestedRef.current.current) {
            nextSpawnAt.current = Math.min(nextSpawnAt.current, time + getNextSpawnIntervalMs(carriers.filter((item) => item.active).length, getTargetLanternCount(width, height), randomIndex));
          }
        }
      }

      if (currentPhase === 'preparing' && !readyReported.current) {
        const required = Math.min(3, eligibleRef.current.length);
        const enteredCount = carriers.reduce((count, carrier) => count + Number(carrier.active && carrier.entered), 0);
        if (required > 0 && enteredCount >= required) {
          readyReported.current = true;
          advanceRef.current();
        }
      }
      if (currentPhase === 'eliminating' && !eliminationReported.current
        && carriers.every((carrier) => !carrier.active || carrier.finalistSlot !== null)) {
        eliminationReported.current = true;
        const finalistsNow = finalistsRef.current.length;
        configureFinalists(finalistsNow >= 3 ? 'finalists3' : finalistsNow === 2 ? 'finalists2' : 'finalist1');
        advanceRef.current();
      }
      if (currentPhase === 'eliminatingToTwo' && phaseAdvanceReported.current !== currentPhase
        && !carriers.some((carrier) => carrier.active && carrier.finalistSlot !== null && carrier.loserOrder === 0)) {
        phaseAdvanceReported.current = currentPhase;
        eventRef.current('first-loser-exit');
        advanceRef.current();
      }
      if (currentPhase === 'eliminatingToOne' && phaseAdvanceReported.current !== currentPhase
        && !carriers.some((carrier) => carrier.active && carrier.finalistSlot !== null && carrier.loserOrder === 1)) {
        phaseAdvanceReported.current = currentPhase;
        eventRef.current('second-loser-exit');
        advanceRef.current();
      }
      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const burstStyle = {
    '--burst-x': `${burstPoint?.x ?? 50}${burstPoint ? 'px' : '%'}`,
    '--burst-y': `${burstPoint?.y ?? 43}${burstPoint ? 'px' : '%'}`,
    '--burst-offset-x': `${burstPoint?.offsetX ?? 0}px`,
    '--burst-offset-y': `${burstPoint?.offsetY ?? 0}px`,
  } as CSSProperties;

  return (
    <div className={`flying-number-lanterns flying-number-lanterns--${phase}`} data-testid="flying-number-lanterns" style={burstStyle}>
      <div className="flying-number-lanterns__roster" role="list" aria-label="抽奖号码">
        {carriers.map((carrier) => {
          const initialDisplay = getDisplayUsername(carrier.initialParticipant.number);
          return <div
            key={carrier.instanceId}
            ref={carrier.bindElement}
            className="flying-number-lantern"
            role="listitem"
            aria-hidden="true"
            aria-label={`号码 ${initialDisplay}`}
            data-active="false"
            data-flight-number={carrier.initialParticipant.number}
            data-number={carrier.initialParticipant.number}
            data-instance-id={carrier.instanceId}
            data-motion="up"
            data-depth={carrier.plan.depth}
            style={{ opacity: 0, visibility: 'hidden', transform: `translate3d(0, ${initialHeight * 1.2}px, 0) translate(-50%, -50%) scale(${carrier.plan.depthScale})` }}
          >
            <span className="flying-number-lantern__visual">
              <span className="flying-number-lantern__paper">
                <span className="flying-number-lantern__frame" aria-hidden="true" />
                <span className="flying-number-lantern__flame" aria-hidden="true" />
                <span className="flying-number-lantern__label">
                  <span
                    ref={carrier.bindFirstLabel}
                    className="flying-number-lantern__number"
                    data-username={usesCompactUsernameTypography(carrier.initialParticipant.number) ? 'true' : undefined}
                    style={{ '--username-visible-length': Array.from(initialDisplay).length } as CSSProperties}
                  >{initialDisplay}</span>
                  <span
                    ref={carrier.bindSecondLabel}
                    className="flying-number-lantern__number"
                    aria-hidden="true"
                    style={{ opacity: 0, visibility: 'hidden' }}
                  />
                </span>
                <span className="flying-number-lantern__frame-fragment" aria-hidden="true" />
              </span>
              <span className="flying-number-lantern__reflection" />
            </span>
          </div>;
        })}
      </div>
      {FINAL_PHASES.has(phase) && <span className="flying-number-lanterns__water-ripple" aria-hidden="true" />}
      {phase === 'charging' && Array.from({ length: 6 }, (_, index) => (
        <span
          className="flying-number-lanterns__charge-spark"
          style={{ '--spark-angle': `${index * 60}deg`, '--spark-delay': `${index * 45}ms` } as CSSProperties}
          key={`charge-${index}`}
          aria-hidden="true"
        />
      ))}
      {(phase === 'burst' || phase === 'revealing') && <>
        <span className="flying-number-lanterns__shockwave" aria-hidden="true" />
        {BURST_FRAGMENTS.map((index) => (
          <span
            className="flying-number-lanterns__particle"
            data-testid="lantern-burst-fragment"
            style={{
              '--particle-angle': `${index * 18}deg`,
              '--particle-distance': `${96 + (index % 5) * 30}px`,
              '--particle-delay': `${(index % 5) * 18}ms`,
            } as CSSProperties}
            key={index}
            aria-hidden="true"
          />
        ))}
        {winner && <div
          className="flying-number-lanterns__emergence"
          data-testid="flying-number-lanterns__emergence"
          data-username={usesCompactUsernameTypography(winner.number) ? 'true' : undefined}
          role="status"
          aria-label="中奖者"
          aria-live="polite"
          style={{ '--winner-character-count': Array.from(winner.number).length } as CSSProperties}
        >
          <p className="flying-number-lanterns__congratulations">恭喜！</p>
          <p>中奖者</p>
          <span>{winner.number}</span>
        </div>}
      </>}
    </div>
  );
}
