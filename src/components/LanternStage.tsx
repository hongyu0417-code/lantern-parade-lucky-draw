import type { CSSProperties } from 'react';
import type { DrawPhase, Participant, WinnerRecord } from '../draw/types';
import { FirefliesCanvas } from './FirefliesCanvas';
import { FlyingNumberLanterns } from './FlyingNumberLanterns';
import { LanternField } from './LanternField';
import { WinnerReveal } from './WinnerReveal';
import '../styles/tokens.css';
import '../styles/stage.css';

type LanternStageProps = {
  phase: DrawPhase;
  activeWinner: WinnerRecord | null;
  animationCandidates: Participant[];
  onSelectorTick?: (intensity: 'soft' | 'strong') => void;
  onDraw: () => void;
  onNext: () => void;
  onHistory: () => void;
  reducedMotion: boolean;
  emptyPool: boolean;
  notice: string | null;
  isFullscreen: boolean;
  soundEnabled: boolean;
  onSettings: () => void;
  onSound: () => void;
  onFullscreen: () => void;
};

const toolbarStyle: CSSProperties = { position: 'relative', zIndex: 6, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.7rem', padding: '0 1.5rem 1.5rem' };
const toolButtonStyle: CSSProperties = { color: '#fff0ca', border: '1px solid rgba(255,228,166,.6)', background: 'rgba(3,18,38,.78)', borderRadius: 3, padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '.82rem', letterSpacing: '.1em' };
const noticeStyle: CSSProperties = { maxWidth: 680, margin: '1.5rem auto 0', padding: '.8rem 1.2rem', color: '#fff0ca', background: 'rgba(4,18,37,.85)', border: '1px solid rgba(255,228,166,.55)', lineHeight: 1.5 };

const phaseMessages: Partial<Record<DrawPhase, string>> = {
  awakening: 'The lanterns are waking',
  searching: 'The numbered lanterns are rushing',
  selecting: 'The golden selector is choosing',
  finalists: 'Only three lanterns remain',
  locking: 'The lucky lantern is locked',
  charging: 'A lucky lantern is gathering light',
  burst: 'The winning number is emerging',
  revealing: 'Congratulations',
};

export function LanternStage({ phase, activeWinner, animationCandidates, onSelectorTick, onDraw, onNext, onHistory, reducedMotion, emptyPool, notice, isFullscreen, soundEnabled, onSettings, onSound, onFullscreen }: LanternStageProps) {
  const isIdle = phase === 'idle';
  const isWinner = phase === 'winner';
  const inSequence = !isIdle && !isWinner;
  return (
    <main className={`lantern-stage lantern-stage--${phase}${reducedMotion ? ' lantern-stage--reduced-motion' : ''}`}>
      <div className="lantern-stage__art" aria-hidden="true" />
      <div className="lantern-stage__nightfall" aria-hidden="true" />
      <div className="lantern-stage__waterlight" aria-hidden="true" />
      {(!inSequence || !activeWinner) && <LanternField phase={phase} chosenNumber={activeWinner?.number} />}
      {inSequence && activeWinner && <FlyingNumberLanterns phase={phase} candidates={animationCandidates} winner={activeWinner} onSelectorTick={onSelectorTick} />}
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
            <button className="stage-button stage-button--primary" type="button" onClick={onDraw} disabled={emptyPool}>
              <span className="stage-button__star" aria-hidden="true">✦</span>
              DRAW A LUCKY LANTERN
              <span className="stage-button__star" aria-hidden="true">✦</span>
            </button>
            {emptyPool && <p role="status" style={noticeStyle}>No eligible lanterns remain. Change the range or reset draw history in Operator settings.</p>}
          </section>
        )}

        {inSequence && <p className="sr-only" role="status" aria-live="polite">{phaseMessages[phase]}</p>}

        {isWinner && activeWinner && <WinnerReveal winner={activeWinner} onNext={onNext} onHistory={onHistory} />}
        {notice && <p role="alert" style={noticeStyle}>{notice}</p>}
      </div>
      {!isFullscreen && !inSequence && <nav aria-label="Operator controls" style={toolbarStyle}>
        <button type="button" style={toolButtonStyle} onClick={onSettings} aria-label="Operator settings">SETTINGS · A</button>
        <button type="button" style={toolButtonStyle} onClick={onHistory} aria-label="Winner history">HISTORY · H</button>
        <button type="button" style={toolButtonStyle} onClick={onSound} aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}>{soundEnabled ? 'SOUND ON' : 'SOUND OFF'} · M</button>
        <button type="button" style={toolButtonStyle} onClick={onFullscreen} aria-label="Enter fullscreen">FULLSCREEN · F</button>
      </nav>}
    </main>
  );
}
