import type { CSSProperties } from 'react';
import type { DrawPhase } from '../draw/types';

type LanternFieldProps = {
  phase: DrawPhase;
};

const lanterns = [
  { left: 4, scale: 0.65, duration: 24, opacity: 0.5 },
  { left: 9, scale: 0.5, duration: 20, opacity: 0.4 },
  { left: 14, scale: 0.76, duration: 27, opacity: 0.58 },
  { left: 19, scale: 0.58, duration: 22, opacity: 0.45 },
  { left: 24, scale: 0.7, duration: 25, opacity: 0.54 },
  { left: 29, scale: 0.52, duration: 21, opacity: 0.4 },
  { left: 34, scale: 0.8, duration: 28, opacity: 0.61 },
  { left: 39, scale: 0.6, duration: 23, opacity: 0.47 },
  { left: 44, scale: 0.73, duration: 26, opacity: 0.56 },
  { left: 49, scale: 0.53, duration: 20, opacity: 0.41 },
  { left: 54, scale: 0.78, duration: 27, opacity: 0.6 },
  { left: 59, scale: 0.61, duration: 22, opacity: 0.48 },
  { left: 64, scale: 0.71, duration: 25, opacity: 0.55 },
  { left: 69, scale: 0.51, duration: 21, opacity: 0.4 },
  { left: 74, scale: 0.79, duration: 28, opacity: 0.6 },
  { left: 79, scale: 0.59, duration: 23, opacity: 0.47 },
  { left: 84, scale: 0.72, duration: 26, opacity: 0.56 },
  { left: 89, scale: 0.52, duration: 20, opacity: 0.41 },
  { left: 94, scale: 0.77, duration: 27, opacity: 0.59 },
  { left: 98, scale: 0.6, duration: 22, opacity: 0.47 },
] as const;

export function LanternField({ phase }: LanternFieldProps) {
  return (
    <div className={`lantern-field lantern-field--${phase}`} aria-hidden="true">
      {lanterns.map((lantern, index) => {
        const delay = -(lantern.duration * (index / lanterns.length));
        const style = {
          '--lantern-left': `${lantern.left}%`,
          '--lantern-scale': lantern.scale,
          '--lantern-duration': `${lantern.duration}s`,
          '--lantern-opacity': lantern.opacity,
          '--lantern-start-scale': lantern.scale * 0.82,
          '--lantern-end-scale': lantern.scale * 0.9,
          '--lantern-delay': `${delay}s`,
        } as CSSProperties;

        return (
          <span
            key={lantern.left}
            className="floating-lantern"
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
