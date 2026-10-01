import type { DrawPhase, WinnerRecord } from '../draw/types';
import { FirefliesCanvas } from './FirefliesCanvas';
import { LanternField } from './LanternField';
import { WinnerReveal } from './WinnerReveal';
import '../styles/tokens.css';
import '../styles/stage.css';

type LanternStageProps = {
  phase: DrawPhase;
  activeWinner: WinnerRecord | null;
  onDraw: () => void;
  onNext: () => void;
  onHistory: () => void;
  reducedMotion: boolean;
};

const phaseMessages: Partial<Record<DrawPhase, string>> = {
  awakening: 'The lanterns are waking',
  searching: 'Searching the lanterns',
  selecting: 'A lucky lantern is rising',
  revealing: 'The lucky number is appearing',
};

export function LanternStage({ phase, activeWinner, onDraw, onNext, onHistory, reducedMotion }: LanternStageProps) {
  const isIdle = phase === 'idle';
  const isWinner = phase === 'winner';
  const inSequence = !isIdle && !isWinner;
  const showNumber = (phase === 'revealing' || isWinner) && activeWinner;

  return (
    <main className={`lantern-stage lantern-stage--${phase}${reducedMotion ? ' lantern-stage--reduced-motion' : ''}`}>
      <div className="lantern-stage__art" aria-hidden="true" />
      <div className="lantern-stage__nightfall" aria-hidden="true" />
      <div className="lantern-stage__waterlight" aria-hidden="true" />
      <LanternField phase={phase} chosenNumber={activeWinner?.number} />
      <FirefliesCanvas intensity={inSequence ? 1 : isWinner ? 0.6 : 0.3} paused={reducedMotion} />

      <header className="stage-masthead">
        <div className="stage-masthead__rule" aria-hidden="true" />
        <p className="stage-masthead__eyebrow">UNIVERSITI MALAYA <span>✦</span> LANTERN PARADE</p>
        <p className="stage-masthead__year">2026</p>
      </header>

      <div className="lantern-stage__content">
        {isIdle && (
          <section className="stage-intro" aria-labelledby="lucky-draw-title">
            <p className="stage-intro__kicker">A NIGHT OF LIGHT & FORTUNE</p>
            <h1 id="lucky-draw-title">LUCKY <em>DRAW</em></h1>
            <p className="stage-intro__line">Every lantern carries a little luck.</p>
            <button className="stage-button stage-button--primary" type="button" onClick={onDraw}>
              <span className="stage-button__star" aria-hidden="true">✦</span>
              DRAW A LUCKY LANTERN
              <span className="stage-button__star" aria-hidden="true">✦</span>
            </button>
          </section>
        )}

        {inSequence && (
          <section className="stage-search" aria-label="Drawing in progress">
            <div className="stage-search__sigil" aria-hidden="true">✦</div>
            <p className="stage-search__overline">THE LANTERNS ARE CHOOSING</p>
            {showNumber ? (
              <div className="stage-search__reveal" aria-live="polite">
                <p>LUCKY NUMBER</p>
                <span>{activeWinner.number}</span>
              </div>
            ) : (
              <p className="stage-search__message" role="status" aria-live="polite">{phaseMessages[phase]}</p>
            )}
          </section>
        )}

        {isWinner && activeWinner && <WinnerReveal winner={activeWinner} onNext={onNext} onHistory={onHistory} />}
      </div>
    </main>
  );
}
