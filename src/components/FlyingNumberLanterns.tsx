import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, AnimationEvent as ReactAnimationEvent } from 'react';
import type { DrawPhase, Participant, WinnerRecord } from '../draw/types';
import { createLanternFlightPlan, type LanternFlightPlan } from '../draw/lanternFlight';
import { chooseNextLanternParticipant, createInitialLanternRoster } from '../draw/flyingLanterns';
import { createSecureRandomIndex } from '../draw/random';
import { getDisplayUsername, usesCompactUsernameTypography } from '../draw/usernames';

type Carrier = {
  instanceId: number;
  participant: Participant;
  plan: LanternFlightPlan;
  finalistSlot: number | null;
  loserOrder: number | null;
  eliminationDelayMs: number;
};

type FlyingNumberLanternsProps = {
  phase: DrawPhase;
  eligible: Participant[];
  finalists: Participant[];
  winner: WinnerRecord | null;
  reducedMotion: boolean;
  stopRequested: { current: boolean };
};

type BurstPoint = { x: number; y: number; offsetX: number; offsetY: number };
type CarrierExit = (instanceId: number) => void;
type RegisterNode = (instanceId: number, node: HTMLElement | null) => void;

const BURST_FRAGMENTS = Array.from({ length: 20 }, (_, index) => index);
const FINAL_PHASES = new Set<DrawPhase>(['finalist1', 'magnifying', 'charging', 'burst', 'revealing']);
const RUN_PHASES = new Set<DrawPhase>(['preparing', 'running']);

function cubicPoint(start: number, first: number, second: number, end: number, t: number): number {
  const inverse = 1 - t;
  return inverse ** 3 * start + 3 * inverse ** 2 * t * first + 3 * inverse * t ** 2 * second + t ** 3 * end;
}

/** Dense compositor keyframes keep each carrier's upward curve smooth without React frame updates. */
function createFlightKeyframes(plan: LanternFlightPlan, reducedMotion: boolean): Keyframe[] {
  const endX = plan.prevailingWindVw * 2;
  const endY = -plan.launchTopVh - 24;
  const frames: Keyframe[] = [];

  for (let index = 0; index <= 48; index += 1) {
    const t = index / 48;
    const movementScale = reducedMotion ? 0.45 : 1;
    const x = cubicPoint(0, plan.curveOneVw * movementScale, plan.curveTwoVw * movementScale, endX * movementScale, t);
    const y = cubicPoint(19, -11, -57, endY, t);
    const scale = plan.depthScale * (reducedMotion ? 0.94 + 0.04 * Math.sin(Math.PI * t) : 0.76 + 0.3 * Math.sin(Math.PI * t) - 0.06 * t);
    const rotation = reducedMotion ? 0 : Math.sin(Math.PI * 2 * t) * 2.1;
    const opacity = t < 0.12
      ? plan.depthOpacity * (t / 0.12)
      : t < 0.94
        ? plan.depthOpacity
        : plan.depthOpacity * Math.max(0, (1 - t) / 0.06);
    frames.push({
      offset: t,
      opacity,
      transform: `translate3d(calc(-50% + ${x}vw), ${y}vh, 0) scale(${scale}) rotate(${rotation}deg)`,
    });
  }
  return frames;
}

function lanternStyle(plan: LanternFlightPlan, delayMs = plan.launchDelayMs, finalistSlot: number | null = null): CSSProperties {
  return {
    '--launch-delay': `${delayMs}ms`,
    '--flight-duration': `${plan.flightDurationMs}ms`,
    '--launch-left': `${plan.launchLeftPercent}%`,
    '--launch-top': `${plan.launchTopVh}vh`,
    '--curve-one-vw': `${plan.curveOneVw}vw`,
    '--curve-one-half-vw': `${plan.curveOneVw * 0.5}vw`,
    '--curve-one-half-neg-vw': `${plan.curveOneVw * -0.5}vw`,
    '--curve-one-neg-vw': `${plan.curveOneVw * -1}vw`,
    '--curve-two-vw': `${plan.curveTwoVw}vw`,
    '--finalist-shift-vw': `${finalistSlot === null ? 0 : finalistSlot - 50}vw`,
    '--center-shift-vw': `${50 - plan.launchLeftPercent}vw`,
    '--finalist-top-vh': `${43 - plan.launchTopVh}vh`,
    '--depart-top-vh': `${43 - plan.launchTopVh - 132}vh`,
    '--depth-scale': plan.depthScale,
    '--launch-scale': plan.depthScale * 0.76,
    '--float-scale': plan.depthScale * 1.06,
    '--exit-scale': plan.depthScale * 0.7,
    '--depth-opacity': plan.depthOpacity,
    '--lantern-rotation': `${plan.curveTwoVw * 0.48}deg`,
    '--lantern-rotation-negative': `${plan.curveTwoVw * -0.48}deg`,
    '--lantern-rotation-soft-negative': `${plan.curveTwoVw * -0.48 * 0.65}deg`,
  } as CSSProperties;
}

function transformX(transform: string): string {
  const match = transform.match(/^matrix(3d)?\((.+)\)$/);
  if (!match) return '0px';
  const values = match[2].split(',').map(Number);
  const x = match[1] ? values[12] : values[4];
  return Number.isFinite(x) ? `${x}px` : '0px';
}

function transformY(transform: string): string {
  const match = transform.match(/^matrix(3d)?\((.+)\)$/);
  if (!match) return '0px';
  const values = match[2].split(',').map(Number);
  const y = match[1] ? values[13] : values[5];
  return Number.isFinite(y) ? `${y}px` : '0px';
}

function stagePositionKeyframes(element: HTMLElement, carrier: Carrier, slot: number, reducedMotion: boolean): Keyframe[] {
  const current = getComputedStyle(element).transform;
  if (reducedMotion) return [
    { transform: current, opacity: 1, offset: 0 },
    { transform: current, opacity: 1, offset: 1 },
  ];
  const targetX = slot - carrier.plan.launchLeftPercent;
  const targetY = 43 - carrier.plan.launchTopVh;
  return [
    { transform: current, opacity: 1, offset: 0 },
    { transform: `translate3d(calc(-50% + ${carrier.plan.curveTwoVw}vw), -56vh, 0) scale(var(--depth-scale))`, opacity: 1, offset: 0.45 },
    { transform: `translate3d(calc(-50% + ${targetX}vw), ${targetY}vh, 0) scale(var(--depth-scale))`, opacity: 1, offset: 1 },
  ];
}

function upwardExitKeyframes(element: HTMLElement, plan: LanternFlightPlan): Keyframe[] {
  const current = getComputedStyle(element).transform;
  const x = transformX(current);
  return [
    { transform: current, opacity: 1, offset: 0 },
    { transform: `translate3d(${x}, -155vh, 0) scale(var(--depth-scale))`, opacity: 1, offset: 0.68 },
    { transform: `translate3d(${x}, -250vh, 0) scale(${plan.depthScale * 0.76})`, opacity: 0, offset: 1 },
  ];
}

function labelStyle(username: string): CSSProperties {
  return { '--username-visible-length': Array.from(getDisplayUsername(username)).length } as CSSProperties;
}

type CarrierViewProps = {
  carrier: Carrier;
  phase: DrawPhase;
  winner: WinnerRecord | null;
  reducedMotion: boolean;
  mappingReady: boolean;
  onExit: CarrierExit;
  registerNode: RegisterNode;
};

function CarrierView({ carrier, phase, winner, reducedMotion, mappingReady, onExit, registerNode }: CarrierViewProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const onExitRef = useRef(onExit);
  const currentLabel = useRef(carrier.participant.number);
  const reducedMotionRef = useRef(reducedMotion);
  const [previousLabel, setPreviousLabel] = useState<string | null>(null);
  onExitRef.current = onExit;
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    if (currentLabel.current === carrier.participant.number) return;
    const previous = currentLabel.current;
    currentLabel.current = carrier.participant.number;
    setPreviousLabel(previous);
    const timeout = window.setTimeout(() => setPreviousLabel(null), reducedMotion ? 120 : 360);
    return () => window.clearTimeout(timeout);
  }, [carrier.participant.number, reducedMotion]);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element || typeof element.animate !== 'function') return;
    const animation = element.animate(createFlightKeyframes(carrier.plan, reducedMotionRef.current), {
      duration: carrier.plan.flightDurationMs,
      delay: carrier.plan.launchDelayMs,
      easing: 'linear',
      fill: 'both',
    });
    element.dataset.motionNative = 'true';
    animationRef.current = animation;
    animation.onfinish = () => {
      if (RUN_PHASES.has(phase)) onExitRef.current(carrier.instanceId);
    };
    return () => {
      animation.onfinish = null;
      animation.cancel();
      if (animationRef.current === animation) animationRef.current = null;
      delete element.dataset.motionNative;
    };
    // The key stays stable when a participant label is reassigned to this physical carrier.
  }, [carrier.instanceId]);

  useLayoutEffect(() => () => {
    const animation = animationRef.current;
    if (!animation) return;
    animation.onfinish = null;
    animation.cancel();
    animationRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element || typeof element.animate !== 'function') return;
    if (phase === 'eliminating' && !mappingReady) return;
    const isFinalist = carrier.finalistSlot !== null;
    let keyframes: Keyframe[] | null = null;
    let duration = 0;
    let delay = 0;
    let easing = 'cubic-bezier(.22,.78,.26,1)';
    let removeOnFinish = false;

    if (phase === 'eliminating') {
      const current = getComputedStyle(element).transform;
      keyframes = isFinalist
        ? stagePositionKeyframes(element, carrier, carrier.finalistSlot!, reducedMotion)
        : reducedMotion
          ? [{ transform: current, opacity: 1, offset: 0 }, { transform: current, opacity: 0, offset: 1 }]
          : upwardExitKeyframes(element, carrier.plan);
      duration = isFinalist ? (reducedMotion ? 1 : 2_350) : (reducedMotion ? 300 : 1_100);
      delay = isFinalist ? 0 : carrier.eliminationDelayMs;
      easing = reducedMotion ? 'linear' : isFinalist ? 'cubic-bezier(.3,.02,.3,1)' : 'cubic-bezier(.22,.7,.26,1)';
      if (!isFinalist) removeOnFinish = true;
      if (keyframes[0]) keyframes[0] = { ...keyframes[0], transform: current };
    } else if ((phase === 'eliminatingToTwo' && carrier.loserOrder === 0)
      || (phase === 'eliminatingToOne' && carrier.loserOrder === 1)) {
      const current = getComputedStyle(element).transform;
      keyframes = reducedMotion
        ? [{ transform: current, opacity: 1, offset: 0 }, { transform: current, opacity: 0, offset: 1 }]
        : upwardExitKeyframes(element, carrier.plan);
      duration = reducedMotion ? 220 : 800;
      easing = reducedMotion ? 'linear' : 'cubic-bezier(.18,.72,.26,1)';
      removeOnFinish = true;
    } else if (phase === 'magnifying' && winner?.number === carrier.participant.number) {
      const current = getComputedStyle(element).transform;
      keyframes = reducedMotion
        ? [
          { transform: current, opacity: 1, offset: 0 },
          { transform: `translate3d(${transformX(current)}, ${transformY(current)}, 0) scale(1.45)`, opacity: 1, offset: 1 },
        ]
        : [
          { transform: current, opacity: 1, offset: 0 },
          { transform: 'translate3d(calc(-50% + var(--center-shift-vw)), var(--finalist-top-vh), 0) scale(1.45)', opacity: 1, offset: 0.45 },
          { transform: 'translate3d(calc(-50% + var(--center-shift-vw)), var(--finalist-top-vh), 0) scale(1.9)', opacity: 1, offset: 1 },
        ];
      duration = reducedMotion ? 650 : 1_200;
      easing = 'cubic-bezier(.2,.75,.25,1)';
    } else if (phase === 'charging' && winner?.number === carrier.participant.number) {
      const current = getComputedStyle(element).transform;
      keyframes = reducedMotion
        ? [
          { transform: current, opacity: 1, offset: 0 },
          { transform: `translate3d(${transformX(current)}, ${transformY(current)}, 0) scale(1.52)`, opacity: 1, offset: 1 },
        ]
        : [
          { transform: current, opacity: 1, offset: 0 },
          { transform: 'translate3d(calc(-50% + var(--center-shift-vw)), var(--finalist-top-vh), 0) scale(2.02)', opacity: 1, offset: 0.72 },
          { transform: 'translate3d(calc(-50% + var(--center-shift-vw)), var(--finalist-top-vh), 0) scale(1.94)', opacity: 1, offset: 1 },
        ];
      duration = reducedMotion ? 300 : 550;
      easing = 'cubic-bezier(.2,.85,.3,1)';
    } else if (phase === 'burst' && winner?.number === carrier.participant.number) {
      const current = getComputedStyle(element).transform;
      keyframes = [
        { transform: current, opacity: 1 },
        { transform: current, opacity: 1 },
      ];
      duration = 200;
      easing = 'linear';
    }

    if (!keyframes) return;
    const currentAnimation = animationRef.current;
    if (currentAnimation) {
      currentAnimation.onfinish = null;
      currentAnimation.cancel();
      animationRef.current = null;
    }
    const animation = element.animate(keyframes, { duration, delay, easing, fill: 'both' });
    animationRef.current = animation;
    animation.onfinish = () => {
      if (removeOnFinish) onExitRef.current(carrier.instanceId);
    };
  }, [carrier, mappingReady, phase, reducedMotion, winner]);

  const soloPhase = FINAL_PHASES.has(phase);
  const isWinner = soloPhase && winner?.number === carrier.participant.number;
  const leaving = (phase === 'eliminatingToTwo' && carrier.loserOrder === 0)
    || (phase === 'eliminatingToOne' && carrier.loserOrder === 1);
  const className = [
    'flying-number-lantern',
    'flying-number-lantern--rising',
    carrier.finalistSlot !== null ? 'flying-number-lantern--finalist' : '',
    carrier.finalistSlot !== null && ['finalists3', 'finalists2', 'finalist1'].includes(phase) ? 'flying-number-lantern--slow-floating' : '',
    phase === 'eliminating' && carrier.finalistSlot === null ? 'flying-number-lantern--eliminating-away' : '',
    leaving ? 'flying-number-lantern--finalist-leaving' : '',
    phase === 'magnifying' && isWinner ? 'flying-number-lantern--winner-gliding' : '',
    isWinner ? 'flying-number-lantern--winner-focus' : '',
    phase === 'charging' && isWinner ? 'flying-number-lantern--charging' : '',
    (phase === 'burst' || phase === 'revealing') && isWinner ? 'flying-number-lantern--bursting' : '',
  ].filter(Boolean).join(' ');
  const displayUsername = getDisplayUsername(carrier.participant.number);
  const displayPrevious = previousLabel === null ? null : getDisplayUsername(previousLabel);
  const onAnimationEnd = (event: ReactAnimationEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return;
    if (event.animationName === 'lantern-ascent-away' && RUN_PHASES.has(phase)) onExit(carrier.instanceId);
    if ((event.animationName === 'lantern-eliminating-away' && phase === 'eliminating') || (event.animationName === 'lantern-finalist-depart' && leaving)) {
      onExit(carrier.instanceId);
    }
  };

  return (
    <div
      ref={(node) => {
        elementRef.current = node;
        registerNode(carrier.instanceId, node);
      }}
      className={className}
      role="listitem"
      aria-label={`号码 ${displayUsername}`}
      data-flight-number={carrier.participant.number}
      data-number={carrier.participant.number}
      data-instance-id={carrier.instanceId}
      data-motion="up"
      data-depth={carrier.plan.depth}
      data-finalist={carrier.finalistSlot !== null ? 'true' : undefined}
      data-finalist-slot={carrier.finalistSlot ?? undefined}
      style={{ ...lanternStyle(carrier.plan, carrier.plan.launchDelayMs, carrier.finalistSlot), '--elimination-delay': `${carrier.eliminationDelayMs}ms` } as CSSProperties}
      onAnimationEnd={onAnimationEnd}
    >
      <span className="flying-number-lantern__visual">
        <span className="flying-number-lantern__paper">
          <span className="flying-number-lantern__frame" aria-hidden="true" />
          <span className="flying-number-lantern__flame" aria-hidden="true" />
          <span className="flying-number-lantern__label">
            {displayPrevious && <span
              className="flying-number-lantern__number flying-number-lantern__number--outgoing"
              data-username={usesCompactUsernameTypography(previousLabel!) ? 'true' : undefined}
              style={labelStyle(previousLabel!)}
              aria-hidden="true"
            >{displayPrevious}</span>}
            <span
              className={`flying-number-lantern__number${displayPrevious ? ' flying-number-lantern__number--incoming' : ''}`}
              data-username={usesCompactUsernameTypography(carrier.participant.number) ? 'true' : undefined}
              style={labelStyle(carrier.participant.number)}
            >{displayUsername}</span>
          </span>
          <span className="flying-number-lantern__frame-fragment" aria-hidden="true" />
        </span>
        <span className="flying-number-lantern__reflection" />
      </span>
    </div>
  );
}

export function FlyingNumberLanterns({ phase, eligible, finalists, winner, reducedMotion, stopRequested }: FlyingNumberLanternsProps) {
  const randomRef = useRef<((exclusiveMax: number) => number) | null>(null);
  if (!randomRef.current) randomRef.current = createSecureRandomIndex();
  const randomIndex = randomRef.current;
  const nextInstanceId = useRef(0);
  const [carriers, setCarriers] = useState<Carrier[]>(() => createInitialLanternRoster(eligible, randomIndex).map((participant) => ({
    instanceId: nextInstanceId.current++,
    participant,
    plan: createLanternFlightPlan(participant.number, randomIndex),
    finalistSlot: null,
    loserOrder: null,
    eliminationDelayMs: 0,
  })));
  const carriersRef = useRef(carriers);
  carriersRef.current = carriers;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const eligibleRef = useRef(eligible);
  eligibleRef.current = eligible;
  const nodes = useRef(new Map<number, HTMLElement>());
  const mappingReady = useRef(false);
  const [finalistsMapped, setFinalistsMapped] = useState(false);
  const [burstPoint, setBurstPoint] = useState<BurstPoint | null>(null);

  const registerNode = useCallback<RegisterNode>((instanceId, node) => {
    if (node) nodes.current.set(instanceId, node);
    else nodes.current.delete(instanceId);
  }, []);

  const onCarrierExit = useCallback<CarrierExit>((instanceId) => {
    const current = carriersRef.current;
    const exiting = current.find(({ instanceId: id }) => id === instanceId);
    if (!exiting) return;
    const remaining = current.filter(({ instanceId: id }) => id !== instanceId);
    const mayRecycle = RUN_PHASES.has(phaseRef.current) && !stopRequested.current;
    if (!mayRecycle) {
      carriersRef.current = remaining;
      setCarriers(remaining);
      return;
    }
    const nextParticipant = chooseNextLanternParticipant(
      eligibleRef.current,
      new Set(remaining.map(({ participant }) => participant.number)),
      randomIndex,
    );
    if (!nextParticipant) {
      carriersRef.current = remaining;
      setCarriers(remaining);
      return;
    }
    const newCarrier: Carrier = {
      instanceId: nextInstanceId.current++,
      participant: nextParticipant,
      plan: createLanternFlightPlan(nextParticipant.number, randomIndex, reducedMotion ? 0 : randomIndex(451)),
      finalistSlot: null,
      loserOrder: null,
      eliminationDelayMs: 0,
    };
    const next = [...remaining, newCarrier];
    carriersRef.current = next;
    setCarriers(next);
  }, [randomIndex, reducedMotion, stopRequested]);

  useLayoutEffect(() => {
    if (phase !== 'eliminating' || mappingReady.current || finalists.length === 0 || !winner) return;
    const current = carriersRef.current;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const slots = finalists.length === 1 ? [50] : finalists.length === 2 ? [42, 58] : [36, 50, 64];
    const candidates = current.filter((carrier) => {
      const rect = nodes.current.get(carrier.instanceId)?.getBoundingClientRect();
      return !rect || rect.bottom >= 0;
    });
    const candidateIds = new Set(candidates.map(({ instanceId }) => instanceId));
    const remaining = new Set(candidates.map(({ instanceId }) => instanceId));
    const carrierByFinalist = new Map<number, number>();

    finalists.forEach((participant, index) => {
      const exact = candidates.find((carrier) => remaining.has(carrier.instanceId) && carrier.participant.number === participant.number);
      if (exact) {
        carrierByFinalist.set(index, exact.instanceId);
        remaining.delete(exact.instanceId);
        return;
      }
      const targetX = viewportWidth * slots[index] / 100;
      const targetY = viewportHeight * 0.52;
      const candidate = [...remaining].map((instanceId) => {
        const rect = nodes.current.get(instanceId)?.getBoundingClientRect();
        const score = rect
          ? Math.abs(rect.left + rect.width / 2 - targetX) + Math.abs(rect.top + rect.height / 2 - targetY) * 0.7
          : Number.MAX_SAFE_INTEGER;
        return { instanceId, score };
      }).sort((left, right) => left.score - right.score)[0];
      const chosen = candidate?.instanceId ?? [...remaining][0];
      if (chosen === undefined) return;
      carrierByFinalist.set(index, chosen);
      remaining.delete(chosen);
    });

    const loserOrderByNumber = new Map(finalists
      .filter(({ number }) => number !== winner.number)
      .map(({ number }, index) => [number, index]));
    const carrierForIndex = new Map([...carrierByFinalist].map(([index, instanceId]) => [instanceId, index]));
    const next = current.map((carrier) => {
      const finalistIndex = carrierForIndex.get(carrier.instanceId);
      if (finalistIndex !== undefined) {
        return {
          ...carrier,
          participant: finalists[finalistIndex],
          finalistSlot: slots[finalistIndex],
          loserOrder: loserOrderByNumber.get(finalists[finalistIndex].number) ?? null,
          eliminationDelayMs: 0,
        };
      }
      return {
        ...carrier,
        finalistSlot: null,
        loserOrder: null,
        eliminationDelayMs: !candidateIds.has(carrier.instanceId) || candidates.length <= 1
          ? 0
          : Math.round(candidates.findIndex(({ instanceId }) => instanceId === carrier.instanceId) / (candidates.length - 1) * 1_300),
      };
    });
    mappingReady.current = true;
    carriersRef.current = next;
    setCarriers(next);
    setFinalistsMapped(true);
  }, [finalists, phase, winner]);

  useLayoutEffect(() => {
    if (!['finalists3', 'finalists2', 'finalist1'].includes(phase)) return;
    const keep = carriersRef.current.filter((carrier) => {
      if (carrier.finalistSlot === null) return false;
      if (phase === 'finalists2') return carrier.loserOrder !== 0;
      if (phase === 'finalist1') return carrier.participant.number === winner?.number;
      return true;
    });
    carriersRef.current = keep;
    setCarriers(keep);
  }, [phase, winner]);

  useLayoutEffect(() => {
    if (phase !== 'burst' || !winner) return;
    const layer = document.querySelector<HTMLElement>('[data-testid="flying-number-lanterns"]');
    const lantern = Array.from(document.querySelectorAll<HTMLElement>('[data-flight-number]'))
      .find((element) => element.dataset.flightNumber === winner.number) ?? null;
    if (!layer || !lantern) return;
    const layerBounds = layer.getBoundingClientRect();
    const lanternBounds = lantern.getBoundingClientRect();
    if (layerBounds.width === 0 || layerBounds.height === 0) {
      setBurstPoint(null);
      return;
    }
    const x = lanternBounds.left - layerBounds.left + lanternBounds.width / 2;
    const y = lanternBounds.top - layerBounds.top + lanternBounds.height / 2;
    setBurstPoint({ x, y, offsetX: x - layerBounds.width / 2, offsetY: y - layerBounds.height * 0.43 });
  }, [phase, winner]);

  const active = useMemo(() => carriers, [carriers]);
  const burstStyle = {
    '--burst-x': `${burstPoint?.x ?? 50}${burstPoint ? 'px' : '%'}`,
    '--burst-y': `${burstPoint?.y ?? 43}${burstPoint ? 'px' : '%'}`,
    '--burst-offset-x': `${burstPoint?.offsetX ?? 0}px`,
    '--burst-offset-y': `${burstPoint?.offsetY ?? 0}px`,
  } as CSSProperties;

  return (
    <div className={`flying-number-lanterns flying-number-lanterns--${phase}`} data-testid="flying-number-lanterns" style={burstStyle}>
      <div className="flying-number-lanterns__roster" role="list" aria-label="抽奖号码">
        {active.map((carrier) => <CarrierView
          key={carrier.instanceId}
          carrier={carrier}
          phase={phase}
          winner={winner}
          reducedMotion={reducedMotion}
          mappingReady={finalistsMapped || phase !== 'eliminating'}
          onExit={onCarrierExit}
          registerNode={registerNode}
        />)}
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
