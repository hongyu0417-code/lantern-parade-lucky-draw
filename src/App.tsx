import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AudioController } from './components/AudioController';
import { LanternStage } from './components/LanternStage';
import { OperatorPanel } from './components/OperatorPanel';
import { WinnerHistory } from './components/WinnerHistory';
import { createDrawState, drawReducer, type DrawOverlay } from './draw/reducer';
import { createDefaultRecord, readDrawRecord, reserveDraw, resetAllDrawData, resetDrawHistory, undoLastDraw, updateDrawSettings, writeDrawRecord } from './draw/persistence';
import type { DrawSettings, PersistedDrawRecord } from './draw/types';
import { useDrawTimeline } from './hooks/useDrawTimeline';
import { useFullscreen } from './hooks/useFullscreen';

const SAVE_ERROR = 'Unable to save draw data. Check browser storage and try again.';

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
      if (state.phase === 'searching') audio.current?.playSearchingCue();
      if (state.phase === 'winner' && previousPhase.current !== 'idle') audio.current?.playWinnerCue();
    }
    previousPhase.current = state.phase;
  }, [state.phase, state.record.settings.soundEnabled]);

  const persist = useCallback((record: PersistedDrawRecord): boolean => {
    try {
      writeDrawRecord(window.localStorage, record);
      recordRef.current = record;
      setNotice(null);
      return true;
    } catch {
      setNotice(SAVE_ERROR);
      return false;
    }
  }, []);

  const startDraw = useCallback(() => {
    if (state.phase !== 'idle' || state.overlay || drawLocked.current) return;
    if (recordRef.current.availableNumbers.length === 0) {
      setNotice('No eligible lanterns remain. Change the range or reset draw history in Operator settings.');
      return;
    }
    drawLocked.current = true;
    const controller = audio.current;
    controller?.initialize();
    try {
      const next = reserveDraw(recordRef.current, (max) => Math.floor(Math.random() * max), new Date().toISOString());
      if (!persist(next)) { drawLocked.current = false; return; }
      dispatch({ type: 'RESERVE_DRAW', record: next });
    } catch {
      drawLocked.current = false;
      setNotice('The draw could not start. Check the active pool in Operator settings.');
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
    void (isFullscreen ? exitFullscreen() : enterFullscreen()).catch(() => setNotice('Fullscreen is unavailable in this browser.'));
    dispatch({ type: 'CLOSE_OVERLAY' });
  }, [enterFullscreen, exitFullscreen, isFullscreen]);

  const showHistory = useCallback(() => {
    if (!isFullscreen) { toggleOverlay('history'); return; }
    void exitFullscreen().then(() => dispatch({ type: 'OPEN_OVERLAY', overlay: 'history' }))
      .catch(() => setNotice('Exit fullscreen to view winner history.'));
  }, [exitFullscreen, isFullscreen, toggleOverlay]);

  const updateRecord = useCallback((record: PersistedDrawRecord) => {
    if (!persist(record)) return;
    setValidationErrors([]);
    dispatch({ type: 'UPDATE_RECORD', record });
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
    catch { setValidationErrors(['Please check the range and imported participant list.']); }
  };

  const undo = () => { updateRecord(undoLastDraw(recordRef.current)); drawLocked.current = false; };
  const resetHistory = () => { updateRecord(resetDrawHistory(recordRef.current)); drawLocked.current = false; };
  const resetAll = () => { updateRecord(resetAllDrawData()); drawLocked.current = false; };

  return <>
    <LanternStage
      phase={state.phase} activeWinner={state.record.activeWinner}
      onDraw={startDraw} onNext={nextDraw} onHistory={showHistory}
      reducedMotion={reducedMotion} emptyPool={state.record.availableNumbers.length === 0}
      notice={notice} isFullscreen={isFullscreen} soundEnabled={state.record.settings.soundEnabled}
      onSettings={() => toggleOverlay('admin')} onSound={toggleSound} onFullscreen={requestFullscreen}
    />
    {!isFullscreen && state.overlay === 'admin' && <OperatorPanel
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
