import type { CSSProperties } from 'react';
import type { DrawPhase } from '../draw/types';

type LanternFieldProps = {
  phase: DrawPhase;
  chosenNumber?: string | null;
};

const lanterns = [
  { left: 9, top: 79, scale: 0.7, delay: -4 },
  { left: 22, top: 73, scale: 0.94, delay: -12 },
  { left: 34, top: 83, scale: 0.62, delay: -8 },
  { left: 46, top: 76, scale: 0.82, delay: -15 },
  { left: 57, top: 86, scale: 0.58, delay: -3 },
  { left: 68, top: 73, scale: 0.87, delay: -10 },
  { left: 81, top: 82, scale: 0.67, delay: -6 },
  { left: 91, top: 74, scale: 0.78, delay: -18 },
] as const;

export function LanternField({ phase, chosenNumber }: LanternFieldProps) {
  const selectedIndex = chosenNumber
    ? [...chosenNumber].reduce((sum, character) => sum + character.charCodeAt(0), 0) % lanterns.length
    : 3;
  const choosing = phase === 'selecting' || phase === 'revealing' || phase === 'winner';

  return (
    <div className={`lantern-field lantern-field--${phase}`} aria-hidden="true">
      {lanterns.map((lantern, index) => {
        const style = {
          '--lantern-left': `${lantern.left}%`,
          '--lantern-top': `${lantern.top}%`,
          '--lantern-scale': lantern.scale,
          '--lantern-delay': `${lantern.delay}s`,
          '--search-order': index,
          '--chosen-x': `${50 - lantern.left}vw`,
          '--chosen-y': `${62 - lantern.top}vh`,
        } as CSSProperties;

        return (
          <span
            key={index}
            className={`floating-lantern${choosing && index === selectedIndex ? ' floating-lantern--chosen' : ''}${choosing && index !== selectedIndex ? ' floating-lantern--recede' : ''}`}
            style={style}
          >
            <span className="floating-lantern__body">
              <span className="floating-lantern__frame" />
              <span className="floating-lantern__flame" />
            </span>
            <span className="floating-lantern__reflection" />
          </span>
        );
      })}
    </div>
  );
}
