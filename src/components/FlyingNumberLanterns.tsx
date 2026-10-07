import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DrawPhase, Participant, WinnerRecord } from '../draw/types';
import { createLanternFlightPlans, type LanternFlightPlan } from '../draw/lanternFlight';
import { getDisplayUsername, usesCompactUsernameTypography } from '../draw/usernames';

type FlyingNumberLanternsProps = {
  phase: DrawPhase;
  candidates: Participant[];
  finalists: Participant[];
  winner: WinnerRecord;
};

type BurstPoint = { x: number; y: number; offsetX: number; offsetY: number };

const BURST_FRAGMENTS = Array.from({ length: 20 }, (_, index) => index);
const FINAL_PHASES = new Set<DrawPhase>(['magnifying', 'charging', 'burst', 'revealing']);

function findLantern(number: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-flight-number]'))
    .find((element) => element.dataset.flightNumber === number) ?? null;
}

function cubicPoint(start: number, first: number, second: number, end: number, t: number): number {
  const inverse = 1 - t;
  return inverse ** 3 * start + 3 * inverse ** 2 * t * first + 3 * inverse * t ** 2 * second + t ** 3 * end;
}

/** Dense compositor keyframes approximate a single cubic path without React frame updates. */
function createFlightKeyframes(plan: LanternFlightPlan): Keyframe[] {
  const finalist = plan.finalistRole !== null;
  const endX = finalist ? plan.finalistShiftVw + 50 - plan.launchLeftPercent : plan.prevailingWindVw * 2;
  const endY = finalist ? 43 - plan.launchTopVh : -plan.launchTopVh - 24;
  const frames: Keyframe[] = [];

  for (let index = 0; index <= 48; index += 1) {
    const t = index / 48;
    const x = cubicPoint(0, plan.curveOneVw, plan.curveTwoVw, endX, t);
    const y = cubicPoint(19, -11, finalist ? endY + 18 : -57, endY, t);
    const scale = plan.depthScale * (0.76 + 0.3 * Math.sin(Math.PI * t) - (finalist ? 0 : 0.06 * t));
    const rotation = Math.sin(Math.PI * 2 * t) * 2.1;
    const opacity = t < 0.12
      ? plan.depthOpacity * (t / 0.12)
      : finalist || t < 0.94
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

function lanternStyle(plan: LanternFlightPlan): CSSProperties {
  return {
    '--launch-delay': `${plan.launchDelayMs}ms`,
    '--flight-duration': `${plan.flightDurationMs}ms`,
    '--launch-left': `${plan.launchLeftPercent}%`,
    '--launch-top': `${plan.launchTopVh}vh`,
    '--curve-one-vw': `${plan.curveOneVw}vw`,
    '--curve-one-half-vw': `${plan.curveOneVw * 0.5}vw`,
    '--curve-one-half-neg-vw': `${plan.curveOneVw * -0.5}vw`,
    '--curve-one-neg-vw': `${plan.curveOneVw * -1}vw`,
    '--curve-two-vw': `${plan.curveTwoVw}vw`,
    '--finalist-shift-vw': `${plan.finalistShiftVw}vw`,
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

export function FlyingNumberLanterns({ phase, candidates, finalists, winner }: FlyingNumberLanternsProps) {
  const flightPlans = useMemo(
    () => createLanternFlightPlans(candidates, finalists, winner, (max) => Math.floor(Math.random() * max)),
    [candidates, finalists, winner],
  );
  const finalistNumbers = useMemo(() => new Set(finalists.map(({ number }) => number)), [finalists]);
  const [departedNumbers, setDepartedNumbers] = useState<Set<string>>(() => new Set());
  const [burstPoint, setBurstPoint] = useState<BurstPoint | null>(null);
  const animationHandles = useMemo(() => new Map<string, Animation>(), [flightPlans]);

  useLayoutEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-flight-number]'));
    if (typeof Element.prototype.animate !== 'function') return;

    elements.forEach((element) => {
      const number = element.dataset.flightNumber;
      if (!number) return;
      const plan = flightPlans.find(({ number: planNumber }) => planNumber === number);
      if (!plan) return;
      const animation = element.animate(createFlightKeyframes(plan), {
        duration: plan.flightDurationMs,
        delay: plan.launchDelayMs,
        easing: 'linear',
        fill: 'both',
      });
      element.dataset.motionNative = 'true';
      animationHandles.set(number, animation);
    });

    return () => {
      animationHandles.forEach((animation) => animation.cancel());
      animationHandles.clear();
    };
  }, [animationHandles, flightPlans]);

  useEffect(() => {
    const timers = flightPlans.flatMap((plan) => {
      if (plan.exitAtMs === null) return [];
      return [window.setTimeout(() => {
        setDepartedNumbers((departed) => new Set(departed).add(plan.number));
      }, plan.exitAtMs)];
    });
    return () => timers.forEach(window.clearTimeout);
  }, [flightPlans]);

  useEffect(() => {
    if (phase !== 'separating') return;
    const timeout = window.setTimeout(() => {
      setDepartedNumbers((departed) => {
        const next = new Set(departed);
        finalists.forEach(({ number }) => {
          if (number !== winner.number) next.add(number);
        });
        return next;
      });
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [finalists, phase, winner.number]);

  useLayoutEffect(() => {
    if (phase !== 'separating' && phase !== 'magnifying' && phase !== 'charging') return;
    const winnerElement = findLantern(winner.number);
    if (!winnerElement || typeof winnerElement.animate !== 'function') return;

    const current = getComputedStyle(winnerElement).transform;
    const centerX = 'calc(-50% + var(--center-shift-vw))';
    const finalistX = 'calc(-50% + var(--center-shift-vw) + var(--finalist-shift-vw))';
    const top = 'var(--finalist-top-vh)';
    let keyframes: Keyframe[] | null = null;
    let duration = 0;
    let easing = 'cubic-bezier(.22,.78,.26,1)';

    if (phase === 'separating') {
      keyframes = [
        { transform: current, opacity: 1, offset: 0 },
        { transform: `translate3d(${centerX}, ${top}, 0) scale(var(--depth-scale))`, opacity: 1, offset: 1 },
      ];
      duration = 1200;
    } else if (phase === 'magnifying') {
      keyframes = [
        { transform: current, opacity: 1, offset: 0 },
        { transform: `translate3d(${centerX}, ${top}, 0) scale(1.78)`, opacity: 1, offset: 0.76 },
        { transform: `translate3d(${centerX}, ${top}, 0) scale(1.68)`, opacity: 1, offset: 1 },
      ];
      duration = 1000;
    } else {
      keyframes = [
        { transform: current, offset: 0 },
        { transform: `translate3d(${centerX}, ${top}, 0) scale(1.9)`, offset: 0.7 },
        { transform: `translate3d(${centerX}, ${top}, 0) scale(1.78)`, offset: 1 },
      ];
      duration = 500;
      easing = 'cubic-bezier(.2,.85,.3,1)';
    }

    const existing = animationHandles.get(winner.number);
    existing?.cancel();
    const animation = winnerElement.animate(keyframes, { duration, easing, fill: 'both' });
    animationHandles.set(winner.number, animation);

    if (phase === 'separating') {
      finalists.forEach(({ number }) => {
        if (number === winner.number) return;
        const element = findLantern(number);
        if (!element || typeof element.animate !== 'function') return;
        const from = getComputedStyle(element).transform;
        const depart = element.animate([
          { transform: from, opacity: 1, offset: 0 },
          { transform: `translate3d(${finalistX}, calc(${top} - 104vh), 0) scale(var(--depth-scale)) rotate(3deg)`, opacity: 0.94, offset: 0.78 },
          { transform: `translate3d(${finalistX}, calc(${top} - 136vh), 0) scale(var(--exit-scale)) rotate(7deg)`, opacity: 0, offset: 1 },
        ], { duration: 1200, easing: 'cubic-bezier(.18,.82,.26,1)', fill: 'both' });
        animationHandles.set(number, depart);
      });
    }
  }, [animationHandles, finalists, phase, winner.number]);

  useLayoutEffect(() => {
    if (phase !== 'burst') return;
    const layer = document.querySelector<HTMLElement>('[data-testid="flying-number-lanterns"]');
    const lantern = findLantern(winner.number);
    if (!layer || !lantern) return;
    const layerBounds = layer.getBoundingClientRect();
    const lanternBounds = lantern.getBoundingClientRect();
    if (layerBounds.width === 0 || layerBounds.height === 0) {
      setBurstPoint(null);
      return;
    }
    const x = lanternBounds.left - layerBounds.left + lanternBounds.width / 2;
    const y = lanternBounds.top - layerBounds.top + lanternBounds.height / 2;
    setBurstPoint({
      x,
      y,
      offsetX: x - layerBounds.width / 2,
      offsetY: y - layerBounds.height * 0.43,
    });
  }, [phase, winner.number]);

  const active = candidates.filter(({ number }) => !departedNumbers.has(number));
  const winnerOnly = FINAL_PHASES.has(phase);
  const finalistPhase = phase === 'finalists' || phase === 'separating';
  const visibleParticipants = winnerOnly
    ? active.filter(({ number }) => number === winner.number)
    : finalistPhase
      ? active.filter(({ number }) => finalistNumbers.has(number))
      : active;
  const planByNumber = new Map(flightPlans.map((plan) => [plan.number, plan]));
  const burstStyle = {
    '--burst-x': `${burstPoint?.x ?? 50}${burstPoint ? 'px' : '%'}`,
    '--burst-y': `${burstPoint?.y ?? 43}${burstPoint ? 'px' : '%'}`,
    '--burst-offset-x': `${burstPoint?.offsetX ?? 0}px`,
    '--burst-offset-y': `${burstPoint?.offsetY ?? 0}px`,
  } as CSSProperties;

  return (
    <div className={`flying-number-lanterns flying-number-lanterns--${phase}`} data-testid="flying-number-lanterns" style={burstStyle}>
      <div className="flying-number-lanterns__roster" role="list" aria-label="抽奖号码">
        {visibleParticipants.map((participant) => {
          const plan = planByNumber.get(participant.number);
          if (!plan) return null;
          const displayUsername = getDisplayUsername(participant.number);
          const winnerFocus = participant.number === winner.number && winnerOnly;
          const winnerGliding = phase === 'separating' && participant.number === winner.number;
          const finalistLeaving = phase === 'separating' && finalistNumbers.has(participant.number) && participant.number !== winner.number;
          const classes = [
            'flying-number-lantern',
            'flying-number-lantern--rising',
            plan.finalistRole === 'winner' ? 'flying-number-lantern--finalist-winner' : '',
            plan.finalistRole === 'other' ? 'flying-number-lantern--finalist-other' : '',
            finalistLeaving ? 'flying-number-lantern--finalist-leaving' : '',
            winnerGliding ? 'flying-number-lantern--winner-gliding' : '',
            winnerFocus ? 'flying-number-lantern--winner-focus' : '',
            phase === 'charging' && winnerFocus ? 'flying-number-lantern--charging' : '',
            (phase === 'burst' || phase === 'revealing') && winnerFocus ? 'flying-number-lantern--bursting' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              className={classes}
              role="listitem"
              aria-label={`号码 ${displayUsername}`}
              data-flight-number={participant.number}
              data-number={participant.number}
              data-motion="up"
              data-depth={plan.depth}
              data-finalist={plan.finalistRole !== null ? 'true' : undefined}
              data-finalist-role={plan.finalistRole ?? undefined}
              key={participant.number}
              style={lanternStyle(plan)}
              onAnimationEnd={(event) => {
                if (event.currentTarget !== event.target) return;
                if (event.animationName === 'lantern-ascent-away' || event.animationName === 'lantern-finalist-depart') {
                  setDepartedNumbers((departed) => new Set(departed).add(participant.number));
                }
              }}
            >
              <span className="flying-number-lantern__visual">
                <span className="flying-number-lantern__paper">
                  <span className="flying-number-lantern__frame" aria-hidden="true" />
                  <span className="flying-number-lantern__flame" aria-hidden="true" />
                  <span
                    className="flying-number-lantern__number"
                    data-username={usesCompactUsernameTypography(participant.number) ? 'true' : undefined}
                    style={{ '--username-visible-length': Array.from(displayUsername).length } as CSSProperties}
                  >{displayUsername}</span>
                  <span className="flying-number-lantern__frame-fragment" aria-hidden="true" />
                </span>
                <span className="flying-number-lantern__reflection" />
              </span>
            </div>
          );
        })}
      </div>

      {winnerOnly && <span className="flying-number-lanterns__water-ripple" aria-hidden="true" />}
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
        {phase === 'revealing' && <div
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
