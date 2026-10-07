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
  animationFinalists: Participant[];
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

const toolbarStyle: CSSProperties = { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.7rem', padding: '0 1.5rem 1.5rem' };
const toolButtonStyle: CSSProperties = { color: '#fff0ca', border: '1px solid rgba(255,228,166,.6)', background: 'rgba(3,18,38,.78)', borderRadius: 3, padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '.82rem', letterSpacing: '.08em' };
const noticeStyle: CSSProperties = { maxWidth: 680, margin: '1.5rem auto 0', padding: '.8rem 1.2rem', color: '#fff0ca', background: 'rgba(4,18,37,.85)', border: '1px solid rgba(255,228,166,.55)', lineHeight: 1.5 };

const phaseMessages: Partial<Record<DrawPhase, string>> = {
  preparing: '幸运抽奖即将开始',
  awakening: '灯笼正从湖畔升起',
  ascending: '每个号码都在夜空中前行',
  narrowing: '夜空渐渐安静下来',
  finalists: '最后几盏灯缓缓升起',
  separating: '幸运灯笼即将浮现',
  magnifying: '幸运号码即将揭晓',
  charging: '光芒正在汇聚',
  burst: '中奖号码即将揭晓',
  revealing: '恭喜，幸运号码已经揭晓',
};

export function LanternStage({ phase, activeWinner, animationCandidates, animationFinalists, onDraw, onNext, onHistory, reducedMotion, emptyPool, notice, isFullscreen, soundEnabled, onSettings, onSound, onFullscreen }: LanternStageProps) {
  const isIdle = phase === 'idle';
  const isPreparing = phase === 'preparing';
  const isWinner = phase === 'winner';
  const inSequence = !isIdle && !isWinner;
  const showIntro = isIdle || isPreparing;
  const mastheadClassName = `stage-masthead${inSequence ? ` stage-masthead--${isPreparing ? 'fading' : 'hidden'}` : ''}`;
  const toolbarClassName = `stage-toolbar${isPreparing ? ' stage-toolbar--fading' : ''}`;
  return (
    <main className={`lantern-stage lantern-stage--${phase}${reducedMotion ? ' lantern-stage--reduced-motion' : ''}`} data-screen={phase}>
      <div className="lantern-stage__art" aria-hidden="true" />
      <div className="lantern-stage__nightfall" aria-hidden="true" />
      <div className="lantern-stage__waterlight" aria-hidden="true" />
      {(isIdle || isPreparing || isWinner || !activeWinner) && <LanternField phase={phase} />}
      {inSequence && !isPreparing && activeWinner && <FlyingNumberLanterns phase={phase} candidates={animationCandidates} finalists={animationFinalists} winner={activeWinner} />}
      <FirefliesCanvas intensity={inSequence ? 0.16 : isWinner ? 0.3 : 0.22} paused={reducedMotion} />

      <header className={mastheadClassName}>
        <div className="stage-masthead__rule" aria-hidden="true" />
        <p className="stage-masthead__eyebrow">UNIVERSITI MALAYA <span>✦</span> LANTERN PARADE</p>
        <p className="stage-masthead__year">2026</p>
      </header>

      <div className="lantern-stage__content">
        {showIntro && (
          <section className={`stage-intro${isPreparing ? ' stage-intro--fading' : ''}`} aria-labelledby="lucky-draw-title" aria-hidden={isPreparing}>
            <p className="stage-intro__kicker">月色如画 · 灯火相逢</p>
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
      {!isFullscreen && (!inSequence || isPreparing) && <nav className={toolbarClassName} aria-label="管理选项" aria-hidden={isPreparing} style={toolbarStyle}>
        <button type="button" style={toolButtonStyle} onClick={onSettings} aria-label="抽奖设置" disabled={isPreparing}>设置 · A</button>
        <button type="button" style={toolButtonStyle} onClick={onHistory} aria-label="中奖记录" disabled={isPreparing}>中奖记录 · H</button>
        <button type="button" style={toolButtonStyle} onClick={onSound} aria-label={soundEnabled ? '关闭音效' : '开启音效'} disabled={isPreparing}>{soundEnabled ? '音效开' : '音效关'} · M</button>
        <button type="button" style={toolButtonStyle} onClick={onFullscreen} aria-label="进入全屏" disabled={isPreparing}>全屏 · F</button>
      </nav>}
    </main>
  );
}
