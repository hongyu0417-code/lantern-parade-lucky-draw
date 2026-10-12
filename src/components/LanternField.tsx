import type { CSSProperties } from 'react';
import type { DrawPhase } from '../draw/types';

type LanternFieldProps = {
  phase: DrawPhase;
};

const lanterns = [
  { left: 5, scale: 0.68, duration: 24, opacity: 0.56 },
  { left: 11, scale: 0.53, duration: 20, opacity: 0.44 },
  { left: 18, scale: 0.82, duration: 28, opacity: 0.64 },
  { left: 25, scale: 0.62, duration: 22, opacity: 0.51 },
  { left: 31, scale: 0.74, duration: 25, opacity: 0.59 },
  { left: 38, scale: 0.55, duration: 19, opacity: 0.43 },
  { left: 44, scale: 0.88, duration: 27, opacity: 0.68 },
  { left: 50, scale: 0.63, duration: 23, opacity: 0.53 },
  { left: 56, scale: 0.77, duration: 26, opacity: 0.61 },
  { left: 63, scale: 0.56, duration: 21, opacity: 0.45 },
  { left: 69, scale: 0.85, duration: 29, opacity: 0.67 },
  { left: 75, scale: 0.64, duration: 22, opacity: 0.54 },
  { left: 81, scale: 0.72, duration: 25, opacity: 0.58 },
  { left: 87, scale: 0.55, duration: 20, opacity: 0.45 },
  { left: 93, scale: 0.8, duration: 28, opacity: 0.65 },
  { left: 98, scale: 0.61, duration: 23, opacity: 0.5 },
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
