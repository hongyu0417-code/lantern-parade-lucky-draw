import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_PARTICIPANTS, parseParticipantsCsv } from '../draw/pool';
import type { DrawSettings } from '../draw/types';
import '../styles/panels.css';

type OperatorPanelProps = {
  settings: DrawSettings;
  remainingCount: number;
  winnerCount: number;
  isDrawActive: boolean;
  validationErrors: string[];
  onSave: (settings: DrawSettings) => void;
  onUndo: () => void;
  onResetHistory: () => void;
  onResetAll: () => void;
  onClose: () => void;
};

function settingsCsv(settings: DrawSettings): string {
  const encode = (value: string) => /[",\r\n]/.test(value)
    ? `"${value.replaceAll('"', '""')}"`
    : value;
  return settings.participants?.map(({ number, name }) =>
    name === undefined ? encode(number) : `${encode(number)},${encode(name)}`,
  ).join('\n') ?? '';
}

function validRange(start: string, end: string): boolean {
  if (!/^\d+$/.test(start) || !/^\d+$/.test(end)) return false;
  const first = Number(start);
  const last = Number(end);
  return Number.isSafeInteger(first) && Number.isSafeInteger(last) && last >= first;
}

function containTab(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'));
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function OperatorPanel({
  settings, remainingCount, winnerCount, isDrawActive, validationErrors,
  onSave, onUndo, onResetHistory, onResetAll, onClose,
}: OperatorPanelProps) {
  const [startNumber, setStartNumber] = useState(settings.startNumber);
  const [endNumber, setEndNumber] = useState(settings.endNumber);
  const [csv, setCsv] = useState(() => settingsCsv(settings));
  const [preventDuplicates, setPreventDuplicates] = useState(settings.preventDuplicates);
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const importPreview = csv.trim() ? parseParticipantsCsv(csv) : null;
  const errors = [...validationErrors, ...localErrors];

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDrawActive) return;
    const nextErrors: string[] = [];
    if (!validRange(startNumber, endNumber)) {
      nextErrors.push('Enter whole number bounds with an end number at least as large as the start.');
    } else if (Number(endNumber) - Number(startNumber) >= MAX_PARTICIPANTS) {
      nextErrors.push('A draw pool cannot exceed 10,000 participants.');
    }
    if (importPreview?.errors.length) nextErrors.push(...importPreview.errors);
    if (csv.trim() && importPreview?.participants.length === 0) {
      nextErrors.push('Add at least one participant number to the CSV.');
    }
    setLocalErrors(nextErrors);
    if (nextErrors.length > 0) return;
    onSave({
      ...settings,
      startNumber,
      endNumber,
      participants: importPreview?.participants ?? null,
      preventDuplicates,
    });
  }

  return (
    <div className="overlay-backdrop">
      <section className="operator-dialog operator-panel" role="dialog" aria-modal="true" aria-labelledby="operator-panel-heading" onKeyDown={containTab}>
        <header className="operator-dialog__header">
          <div>
            <p className="operator-dialog__eyebrow">BEHIND THE LANTERNS</p>
            <h2 id="operator-panel-heading">Operator settings</h2>
          </div>
          <button className="operator-dialog__close" type="button" aria-label="Close operator settings" onClick={onClose} autoFocus>×</button>
        </header>

        <div className="operator-panel__counts" aria-label="Draw counts">
          <div><strong>{remainingCount}</strong><span>Remaining</span></div>
          <div><strong>{winnerCount}</strong><span>Winners drawn</span></div>
          <div><strong>{settings.participants?.length ?? Number(settings.endNumber) - Number(settings.startNumber) + 1}</strong><span>In active pool</span></div>
        </div>

        <form className="operator-panel__form" onSubmit={save} noValidate>
          <div className="operator-panel__range">
            <label>Start number<input type="text" inputMode="numeric" value={startNumber} onChange={(event) => { setStartNumber(event.target.value); setLocalErrors([]); }} disabled={isDrawActive} /></label>
            <label>End number<input type="text" inputMode="numeric" value={endNumber} onChange={(event) => { setEndNumber(event.target.value); setLocalErrors([]); }} disabled={isDrawActive} /></label>
          </div>
          <p className="operator-panel__hint">The range is inclusive. Leading zeroes appear on the winner screen.</p>
          <label className="operator-panel__csv-label">Participants CSV
            <textarea value={csv} onChange={(event) => { setCsv(event.target.value); setLocalErrors([]); }} placeholder={'NUMBER,NAME\n001,Amina\n002,Ben'} rows={5} spellCheck={false} disabled={isDrawActive} />
          </label>
          <p className="operator-panel__hint">Paste NUMBER,NAME rows to use a participant list instead of the range. Clear the box to use the range again.</p>
          {importPreview && <p className="operator-panel__preview">{importPreview.participants.length} participants ready to import</p>}
          <label className="operator-panel__toggle">
            <input type="checkbox" checked={preventDuplicates} onChange={(event) => setPreventDuplicates(event.target.checked)} disabled={isDrawActive} />
            <span>Prevent duplicate winners</span>
          </label>
          {errors.length > 0 && <div className="operator-panel__errors" role="alert">{errors.map((error, index) => <p key={`${index}-${error}`}>{error}</p>)}</div>}
          <button className="operator-panel__save" type="submit" disabled={isDrawActive}>Save draw pool</button>
        </form>

        <div className="operator-panel__maintenance">
          <h3>Draw records</h3>
          <button type="button" disabled={isDrawActive || winnerCount === 0} onClick={onUndo}>Undo last draw</button>
          <button type="button" disabled={isDrawActive || winnerCount === 0} onClick={() => { if (window.confirm('Reset draw history and return all configured numbers to the pool?')) onResetHistory(); }}>Reset draw history</button>
          <button className="operator-panel__danger" type="button" disabled={isDrawActive} onClick={() => { if (window.confirm('Reset all draw data, including settings and imported participants?')) onResetAll(); }}>Reset all draw data</button>
        </div>
      </section>
    </div>
  );
}
