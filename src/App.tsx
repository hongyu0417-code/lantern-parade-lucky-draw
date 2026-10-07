import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AudioController } from './components/AudioController';
import { LanternStage } from './components/LanternStage';
import { OperatorPanel } from './components/OperatorPanel';
import { WinnerHistory } from './components/WinnerHistory';
import { createCandidateLanterns, createFinalistLanterns } from './draw/flyingLanterns';
import { createSecureRandomIndex } from './draw/random';
import { createDrawState, drawReducer, type DrawOverlay } from './draw/reducer';
import { createDefaultRecord, readDrawRecord, reserveDraw, resetAllDrawData, resetDrawHistory, undoLastDraw, updateDrawSettings, writeDrawRecord } from './draw/persistence';
import type { DrawSettings, PersistedDrawRecord } from './draw/types';
import { useDrawTimeline } from './hooks/useDrawTimeline';
import { useFullscreen } from './hooks/useFullscreen';

const SAVE_ERROR = '无法保存抽奖数据，请检查浏览器存储空间后重试。';

function initialRecord(): PersistedDrawRecord {
  try { return readDrawRecord(window.localStorage); }
  catch { return createDefaultRecord(); }
}
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}

export default function App() {
  const [state, dispatch] = useReducer(drawReducer, undefined, () => createDrawState(initialRecord()));
  const [notice, setNotice] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [operatorPanelRevision, setOperatorPanelRevision] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const drawLocked = useRef(false);
  const recordRef = useRef(state.record);
  const audio = useRef<AudioController | null>(null);
  const previousPhase = useRef(state.phase);
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen();

  if (!audio.current) audio.current = new AudioController();
  useDrawTimeline(state.phase, dispatch, reducedMotion);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const change = () => setReducedMotion(query.matches);
    query.addEventListener?.('change', change);
    return () => query.removeEventListener?.('change', change);
  }, []);

  useEffect(() => {
    const controller = audio.current;
    const initialize = () => controller?.initialize();
    window.addEventListener('pointerdown', initialize, { once: true });
    window.addEventListener('keydown', initialize, { once: true });
    return () => { window.removeEventListener('pointerdown', initialize); window.removeEventListener('keydown', initialize); controller?.dispose(); };
  }, []);

  useEffect(() => {
    audio.current?.setMuted(!state.record.settings.soundEnabled);
    if (previousPhase.current !== state.phase) {
      if (state.phase === 'awakening') audio.current?.playLaunchCue();
      if (state.phase === 'ascending') audio.current?.playAscentCue();
      if (state.phase === 'finalists') audio.current?.playFinalistsCue();
      if (state.phase === 'separating') audio.current?.playSeparationCue();
      if (state.phase === 'magnifying') audio.current?.playMagnifyCue();
      if (state.phase === 'charging') audio.current?.playChargeCue();
      if (state.phase === 'burst') audio.current?.playBurstCue();
      if (state.phase === 'winner' && previousPhase.current !== 'idle') audio.current?.playWinnerCue();
    }
    previousPhase.current = state.phase;
  }, [state.phase, state.record.settings.soundEnabled]);

  const persist = useCallback((record: PersistedDrawRecord, target: 'stage' | 'operator' = 'stage'): boolean => {
    try {
      writeDrawRecord(window.localStorage, record);
      recordRef.current = record;
      setNotice(null);
      return true;
    } catch {
      if (target === 'operator') setValidationErrors([SAVE_ERROR]);
      else setNotice(SAVE_ERROR);
      return false;
    }
  }, []);

  const startDraw = useCallback(() => {
    if (state.phase !== 'idle' || state.overlay || drawLocked.current) return;
    if (recordRef.current.availableNumbers.length === 0) {
      setNotice('暂无可抽取的号码，请调整号码范围或重置中奖记录。');
      return;
    }
    drawLocked.current = true;
    const controller = audio.current;
    controller?.initialize();
    try {
      const randomIndex = createSecureRandomIndex();
      const eligibleBeforeDraw = recordRef.current.availableNumbers;
      const next = reserveDraw(recordRef.current, randomIndex, new Date().toISOString());
      if (!next.activeWinner) throw new Error('The draw did not reserve a winner.');
      const animationCandidates = createCandidateLanterns(eligibleBeforeDraw, next.activeWinner, randomIndex);
      const animationFinalists = createFinalistLanterns(animationCandidates, next.activeWinner, randomIndex);
      if (!persist(next)) { drawLocked.current = false; return; }
      dispatch({ type: 'RESERVE_DRAW', record: next, animationCandidates, animationFinalists });
    } catch {
      drawLocked.current = false;
      setNotice('无法开始抽奖，请检查当前参与名单。');
    }
  }, [persist, state.overlay, state.phase]);

  const nextDraw = useCallback(() => {
    if (state.phase !== 'winner') return;
    const next = { ...recordRef.current, activeWinner: null };
    if (!persist(next)) return;
    drawLocked.current = false;
    dispatch({ type: 'RETURN_TO_IDLE' });
  }, [persist, state.phase]);

  const toggleOverlay = useCallback((overlay: DrawOverlay) => {
    if (isFullscreen || (state.phase !== 'idle' && state.phase !== 'winner')) return;
    dispatch({ type: state.overlay === overlay ? 'CLOSE_OVERLAY' : 'OPEN_OVERLAY', overlay });
  }, [isFullscreen, state.overlay, state.phase]);

  const toggleSound = useCallback(() => {
    const next = updateDrawSettings(recordRef.current, { soundEnabled: !recordRef.current.settings.soundEnabled });
    if (persist(next)) dispatch({ type: 'TOGGLE_SOUND' });
  }, [persist]);

  const requestFullscreen = useCallback(() => {
    void (isFullscreen ? exitFullscreen() : enterFullscreen()).catch(() => setNotice('此浏览器暂不支持全屏显示。'));
    dispatch({ type: 'CLOSE_OVERLAY' });
  }, [enterFullscreen, exitFullscreen, isFullscreen]);

  const showHistory = useCallback(() => {
    if (!isFullscreen) { toggleOverlay('history'); return; }
    void exitFullscreen().then(() => dispatch({ type: 'OPEN_OVERLAY', overlay: 'history' }))
      .catch(() => setNotice('暂时无法退出全屏，请退出后再查看中奖记录。'));
  }, [exitFullscreen, isFullscreen, toggleOverlay]);

  const updateRecord = useCallback((record: PersistedDrawRecord): boolean => {
    if (!persist(record, 'operator')) return false;
    setValidationErrors([]);
    dispatch({ type: 'UPDATE_RECORD', record });
    return true;
  }, [persist]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === ' ' || key === 'spacebar') {
        if (event.target instanceof HTMLElement && event.target.closest('button, a, summary, [role="button"], [role="link"]')) return;
        if (state.phase === 'idle' && !state.overlay) { event.preventDefault(); startDraw(); }
      } else if (key === 'n') {
        if (state.phase === 'winner' && !state.overlay) { event.preventDefault(); nextDraw(); }
      } else if (key === 'a' || key === 'h') {
        event.preventDefault(); toggleOverlay(key === 'a' ? 'admin' : 'history');
      } else if (key === 'm') {
        event.preventDefault(); toggleSound();
      } else if (key === 'f') {
        event.preventDefault(); requestFullscreen();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [nextDraw, requestFullscreen, startDraw, state.overlay, state.phase, toggleOverlay, toggleSound]);

  const saveSettings = (settings: DrawSettings) => {
    try { updateRecord(updateDrawSettings(recordRef.current, settings)); }
    catch { setValidationErrors(['请检查号码范围和导入的参与者名单。']); }
  };

  const undo = () => { if (updateRecord(undoLastDraw(recordRef.current))) drawLocked.current = false; };
  const resetHistory = () => { if (updateRecord(resetDrawHistory(recordRef.current))) drawLocked.current = false; };
  const resetAll = () => {
    if (updateRecord(resetAllDrawData())) {
      drawLocked.current = false;
      setOperatorPanelRevision((revision) => revision + 1);
    }
  };

  return <>
    <LanternStage
      phase={state.phase} activeWinner={state.record.activeWinner}
      animationCandidates={state.animationCandidates} animationFinalists={state.animationFinalists}
      onDraw={startDraw} onNext={nextDraw} onHistory={showHistory}
      reducedMotion={reducedMotion} emptyPool={state.record.availableNumbers.length === 0}
      notice={notice} isFullscreen={isFullscreen} soundEnabled={state.record.settings.soundEnabled}
      onSettings={() => toggleOverlay('admin')} onSound={toggleSound} onFullscreen={requestFullscreen}
    />
    {!isFullscreen && state.overlay === 'admin' && <OperatorPanel
      key={operatorPanelRevision}
      settings={state.record.settings} remainingCount={state.record.availableNumbers.length}
      winnerCount={state.record.winnerHistory.length} isDrawActive={state.phase !== 'idle' && state.phase !== 'winner'}
      validationErrors={validationErrors} onSave={saveSettings} onUndo={undo}
      onResetHistory={resetHistory} onResetAll={resetAll}
      onClose={() => dispatch({ type: 'CLOSE_OVERLAY' })}
    />}
    {!isFullscreen && state.overlay === 'history' && <WinnerHistory
      winnerHistory={state.record.winnerHistory} onClose={() => dispatch({ type: 'CLOSE_OVERLAY' })}
    />}
  </>;
}
