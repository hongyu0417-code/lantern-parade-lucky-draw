import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DrawPhase, Participant, WinnerRecord } from '../draw/types';

type FlyingNumberLanternsProps = {
  phase: DrawPhase;
  candidates: Participant[];
  winner: WinnerRecord;
  onSelectorTick?: (intensity: 'soft' | 'strong') => void;
};

const SELECTOR_DELAYS = [110, 115, 130, 150, 175, 220, 370, 500];
const FINALIST_DELAYS = [180, 260, 360, 480, 500];
const BURST_PARTICLES = Array.from({ length: 20 }, (_, index) => index);

const phaseCopy: Partial<Record<DrawPhase, string>> = {
  awakening: 'FIND YOUR NUMBER',
  searching: 'THE LANTERNS ARE RUSHING',
  selecting: 'THE GOLDEN SELECTOR IS CHOOSING',
  finalists: 'ONLY THREE LANTERNS REMAIN',
  locking: 'THE LUCKY LANTERN IS LOCKED',
  charging: 'A WINNER IS GATHERING LIGHT',
  burst: 'LUCKY NUMBER',
  revealing: 'CONGRATULATIONS',
};

function clampPosition(value: number): number {
  return Math.max(4, Math.min(96, value));
}

export function FlyingNumberLanterns({ phase, candidates, winner, onSelectorTick }: FlyingNumberLanternsProps) {
  const finalists = useMemo(() => {
    const others = candidates.filter(({ number }) => number !== winner.number).slice(0, 2);
    return [others[0], winner, others[1]].filter((participant): participant is Participant => Boolean(participant));
  }, [candidates, winner]);
  const finalistNumbers = useMemo(() => finalists.map(({ number }) => number), [finalists]);
  const [selectedNumber, setSelectedNumber] = useState(candidates[0]?.number ?? winner.number);
  const usesFinalists = phase === 'finalists' || phase === 'locking';
  const winnerOnly = phase === 'charging' || phase === 'burst' || phase === 'revealing';
  const visibleParticipants = winnerOnly ? [winner] : usesFinalists ? finalists : candidates;
  const selectorActive = phase === 'selecting' || phase === 'finalists';
  useEffect(() => {
    if (!selectorActive) {
      setSelectedNumber(phase === 'locking' || winnerOnly ? winner.number : candidates[0]?.number ?? winner.number);
      return;
    }

    const candidateNumbers = candidates.map(({ number }) => number);
    const otherNumbers = finalists.filter(({ number }) => number !== winner.number).map(({ number }) => number);
    const finalistStops = [otherNumbers[0], otherNumbers[1], winner.number, otherNumbers[1], otherNumbers[0], winner.number]
      .filter((number): number is string => Boolean(number));
    const stops = phase === 'finalists' && finalistStops.length > 0
      ? finalistStops
      : candidateNumbers.length > 0 ? candidateNumbers : [winner.number];
    const delays = phase === 'finalists' ? FINALIST_DELAYS : SELECTOR_DELAYS;
    let cursor = 0;
    let timeout = 0;

    setSelectedNumber(stops[0]);
    const tick = () => {
      cursor += 1;
      setSelectedNumber(stops[cursor % stops.length]);
      onSelectorTick?.(phase === 'finalists' && cursor >= 3 ? 'strong' : 'soft');
      if (cursor < delays.length) timeout = window.setTimeout(tick, delays[cursor]);
    };
    timeout = window.setTimeout(tick, delays[0]);

    return () => window.clearTimeout(timeout);
  }, [candidates, finalists, onSelectorTick, phase, selectorActive, winner.number, winnerOnly]);

  const finalistIndex = (number: string) => finalistNumbers.indexOf(number);

  function lanternStyle(participant: Participant, index: number): CSSProperties {
    const candidateIndex = candidates.findIndex(({ number }) => number === participant.number);
    const finalistPosition = finalistIndex(participant.number);
    let x = 6 + (index % 7) * 14.5;
    let y = 20 + Math.floor(index / 7) * (56 / Math.max(1, Math.ceil(visibleParticipants.length / 7) - 1));

    if (usesFinalists && finalistPosition >= 0) {
      const positions = finalists.length === 1
        ? [{ x: 50, y: 39 }]
        : finalists.length === 2
          ? [{ x: 37, y: 42 }, { x: 63, y: 42 }]
          : [{ x: 32, y: 46 }, { x: 50, y: 31 }, { x: 68, y: 46 }];
      x = positions[finalistPosition].x;
      y = positions[finalistPosition].y;
    } else if (winnerOnly) {
      x = 50;
      y = 38;
    }

    const lane = Math.max(candidateIndex, 0);
    const sweepX = ((lane * 37) % 112) - 56;
    const sweepY = ((lane * 19) % 48) - 30;
    const escapeDirection = finalistPosition === 0 ? -1 : 1;
    return {
      '--lantern-left': `${clampPosition(x)}%`,
      '--lantern-top': `${y}%`,
      '--lantern-index': lane,
      '--lantern-delay': `${(lane % 20) * 34}ms`,
      '--lantern-speed': `${0.82 + (lane % 6) * 0.13}s`,
      '--awaken-delay': `${lane * 16}ms`,
      '--awaken-speed': `${0.48 + (lane % 7) * 0.08}s`,
      '--lantern-depth': `${0.66 + (lane % 5) * 0.18}`,
      '--rush-x': `${sweepX}vw`,
      '--rush-y': `${sweepY}vh`,
      '--lantern-tilt': `${((lane * 13) % 18) - 9}deg`,
      '--escape-x': `${escapeDirection * 125}vw`,
      '--particle-x': `${(Math.cos(lane) * 140).toFixed(0)}px`,
      '--particle-y': `${(Math.sin(lane) * 140).toFixed(0)}px`,
      zIndex: String(1 + lane % 5),
    } as CSSProperties;
  }

  return (
    <div className={`flying-number-lanterns flying-number-lanterns--${phase}`} data-testid="flying-number-lanterns">
      <div className="flying-number-lanterns__roster" role="list" aria-label="Draw candidates">
        {visibleParticipants.map((participant, index) => {
          const locked = phase === 'locking' && participant.number === winner.number;
          const selected = selectorActive && participant.number === selectedNumber;
          const flyingAway = phase === 'locking' && participant.number !== winner.number;
          const finalistPosition = finalistIndex(participant.number);
          const classes = [
            'flying-number-lantern',
            phase === 'awakening' ? 'flying-number-lantern--awakening' : '',
            phase === 'searching' ? 'flying-number-lantern--rushing' : '',
            phase === 'finalists' ? 'flying-number-lantern--orbiting' : '',
            phase === 'charging' ? 'flying-number-lantern--charging' : '',
            phase === 'burst' || phase === 'revealing' ? 'flying-number-lantern--bursting' : '',
            selected ? 'flying-number-lantern--selected' : '',
            locked ? 'flying-number-lantern--locked' : '',
            flyingAway ? 'flying-number-lantern--flying-away' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              className={classes}
              role="listitem"
              aria-label={`Participant number ${participant.number}`}
              data-number={participant.number}
              data-finalist-index={finalistPosition >= 0 ? finalistPosition : undefined}
              key={participant.number}
              style={lanternStyle(participant, index)}
            >
              <span className="flying-number-lantern__selector" aria-hidden="true" />
              <span className="flying-number-lantern__paper">
                <span className="flying-number-lantern__frame" aria-hidden="true" />
                <span className="flying-number-lantern__flame" aria-hidden="true" />
                <span className="flying-number-lantern__number">{participant.number}</span>
              </span>
              <span className="flying-number-lantern__reflection" aria-hidden="true" />
            </div>
          );
        })}
      </div>

      {(phase === 'charging' || phase === 'burst' || phase === 'revealing') && <span className="flying-number-lanterns__water-ripple" aria-hidden="true" />}
      {(phase === 'burst' || phase === 'revealing') && <>
        <span className="flying-number-lanterns__shockwave" aria-hidden="true" />
        {BURST_PARTICLES.map((index) => (
          <span className="flying-number-lanterns__particle" data-testid="lantern-burst-particle" style={{
            '--particle-angle': `${index * 18}deg`,
            '--particle-distance': `${96 + (index % 5) * 30}px`,
            '--particle-delay': `${(index % 5) * 18}ms`,
          } as CSSProperties} key={index} aria-hidden="true" />
        ))}
        <div className="flying-number-lanterns__emergence" data-testid="flying-number-lanterns__emergence" role="status" aria-label="Winning number" aria-live="polite">
          <span>{winner.number}</span>
          {phase === 'revealing' && <p>CONGRATULATIONS</p>}
        </div>
      </>}

      {phase !== 'revealing' && <p className="flying-number-lanterns__prompt" aria-hidden="true">{phaseCopy[phase]}</p>}
    </div>
  );
}
