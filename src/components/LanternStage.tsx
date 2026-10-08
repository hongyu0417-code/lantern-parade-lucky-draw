import type { CSSProperties } from 'react';
import type { LanternAudioEvent } from './AudioController';
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
  animationPool: Participant[];
  animationFinalists: Participant[];
  stopRequested: { current: boolean };
  onAdvancePhase: () => void;
  onMotionEvent: (event: LanternAudioEvent) => void;
  onDraw: () => void;
  onNext: () => void;
  onHistory: () => void;
  reducedMotion: boolean;
  emptyPool: boolean;
  notice: string | null;
};

const noticeStyle: CSSProperties = { maxWidth: 680, margin: '1.5rem auto 0', padding: '.8rem 1.2rem', color: '#fff0ca', background: 'rgba(4,18,37,.85)', border: '1px solid rgba(255,228,166,.55)', lineHeight: 1.5 };

const phaseMessages: Partial<Record<DrawPhase, string>> = {
  preparing: '幸运抽奖即将开始',
  running: '每个号码都在夜空中前行',
  eliminating: '夜空渐渐安静下来',
  finalists3: '最后几盏灯缓缓升起',
  eliminatingToTwo: '灯笼继续缓缓升起',
  finalists2: '夜色中还剩两盏灯',
  eliminatingToOne: '灯笼继续缓缓升起',
  finalist1: '最后一盏灯缓缓升起',
  magnifying: '幸运号码即将揭晓',
  charging: '光芒正在汇聚',
  burst: '中奖号码即将揭晓',
  revealing: '恭喜，幸运号码已经揭晓',
};

export function LanternStage({ phase, activeWinner, animationPool, animationFinalists, stopRequested, onAdvancePhase, onMotionEvent, onDraw, onNext, onHistory, reducedMotion, emptyPool, notice }: LanternStageProps) {
  const isIdle = phase === 'idle';
  const isPreparing = phase === 'preparing';
  const isWinner = phase === 'winner';
  const inSequence = !isIdle && !isWinner;
  const showIntro = isIdle || isPreparing;
  const mastheadClassName = `stage-masthead${inSequence ? ` stage-masthead--${isPreparing ? 'fading' : 'hidden'}` : ''}`;
  return (
    <main className={`lantern-stage lantern-stage--${phase}${reducedMotion ? ' lantern-stage--reduced-motion' : ''}`} data-screen={phase}>
      <div className="lantern-stage__art" aria-hidden="true" />
      <div className="lantern-stage__nightfall" aria-hidden="true" />
      <div className="lantern-stage__waterlight" aria-hidden="true" />
      {(isIdle || isWinner) && <LanternField phase={phase} />}
      {inSequence && animationPool.length > 0 && <FlyingNumberLanterns
        phase={phase}
        eligible={animationPool}
        finalists={animationFinalists}
        winner={activeWinner}
        reducedMotion={reducedMotion}
        stopRequested={stopRequested}
        onAdvancePhase={onAdvancePhase}
        onMotionEvent={onMotionEvent}
      />}
      <FirefliesCanvas intensity={inSequence ? 0.16 : isWinner ? 0.3 : 0.22} paused={reducedMotion || inSequence} />

      <header className={mastheadClassName}>
        <div className="stage-masthead__rule" aria-hidden="true" />
        <p className="stage-masthead__eyebrow">UNIVERSITI MALAYA <span>✦</span> LANTERN PARADE</p>
        <p className="stage-masthead__year">2026</p>
      </header>

      <div className="lantern-stage__content">
        {showIntro && (
          <section className={`stage-intro${isPreparing ? ' stage-intro--fading' : ''}`} aria-labelledby="lucky-draw-title" aria-hidden={isPreparing}>
            <p className="stage-intro__kicker">第二十六届马大灯笼节 · 灯笼游行</p>
            <h1 id="lucky-draw-title">幸运抽奖</h1>
            <p className="stage-intro__line">寻找属于你的幸运灯笼</p>
            <button className="stage-button stage-button--primary" type="button" onClick={onDraw} disabled={emptyPool || isPreparing}>
              <span className="stage-button__star" aria-hidden="true">✦</span>
              开始抽奖
              <span className="stage-button__star" aria-hidden="true">✦</span>
            </button>
            {emptyPool && <p role="status" style={noticeStyle}>暂无可抽取的号码。请在抽奖设置中调整号码范围或重置中奖记录。</p>}
          </section>
        )}

        {inSequence && <p className="sr-only" role="status" aria-live="polite">{phaseMessages[phase]}</p>}

        {isWinner && activeWinner && <WinnerReveal winner={activeWinner} onNext={onNext} onHistory={onHistory} />}
        {notice && <p role="alert" style={noticeStyle}>{notice}</p>}
      </div>
    </main>
  );
}
