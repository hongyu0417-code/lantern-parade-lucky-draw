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
      nextErrors.push('请输入有效的整数范围，并确保结束号码不小于起始号码。');
    } else if (Number(endNumber) - Number(startNumber) >= MAX_PARTICIPANTS) {
      nextErrors.push('参与者名单不能超过 10,000 人。');
    }
    if (importPreview?.errors.length) nextErrors.push(...importPreview.errors);
    if (csv.trim() && importPreview?.participants.length === 0) {
      nextErrors.push('请至少填写一位参与者的号码。');
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
            <p className="operator-dialog__eyebrow">灯笼节 · 管理面板</p>
            <h2 id="operator-panel-heading">抽奖设置</h2>
          </div>
          <button className="operator-dialog__close" type="button" aria-label="关闭抽奖设置" onClick={onClose} autoFocus>×</button>
        </header>

        <div className="operator-panel__counts" aria-label="抽奖人数统计">
          <div><strong>{remainingCount}</strong><span>剩余人数</span></div>
          <div><strong>{winnerCount}</strong><span>中奖人数</span></div>
          <div><strong>{settings.participants?.length ?? Number(settings.endNumber) - Number(settings.startNumber) + 1}</strong><span>参与人数</span></div>
        </div>

        <form className="operator-panel__form" onSubmit={save} noValidate>
          <div className="operator-panel__range">
            <label>起始号码<input type="text" inputMode="numeric" value={startNumber} onChange={(event) => { setStartNumber(event.target.value); setLocalErrors([]); }} disabled={isDrawActive} /></label>
            <label>结束号码<input type="text" inputMode="numeric" value={endNumber} onChange={(event) => { setEndNumber(event.target.value); setLocalErrors([]); }} disabled={isDrawActive} /></label>
          </div>
          <p className="operator-panel__hint">号码范围包含起始与结束号码；小于 1000 的号码会以三位数显示。</p>
          <label className="operator-panel__csv-label">导入参与者名单
            <textarea value={csv} onChange={(event) => { setCsv(event.target.value); setLocalErrors([]); }} placeholder={'号码,姓名\n001,陈美玲\n002,王俊杰'} rows={5} spellCheck={false} disabled={isDrawActive} />
          </label>
          <p className="operator-panel__hint">每行填写“号码,姓名”，即可使用参与者名单代替号码范围。清空名单即可恢复使用号码范围。</p>
          {importPreview && <p className="operator-panel__preview">已读取 {importPreview.participants.length} 位参与者</p>}
          <label className="operator-panel__toggle">
            <input type="checkbox" checked={preventDuplicates} onChange={(event) => setPreventDuplicates(event.target.checked)} disabled={isDrawActive} />
            <span>防止重复中奖</span>
          </label>
          {errors.length > 0 && <div className="operator-panel__errors" role="alert">{errors.map((error, index) => <p key={`${index}-${error}`}>{error}</p>)}</div>}
          <button className="operator-panel__save" type="submit" disabled={isDrawActive}>保存抽奖名单</button>
        </form>

        <div className="operator-panel__maintenance">
          <h3>中奖记录管理</h3>
          <button type="button" disabled={isDrawActive || winnerCount === 0} onClick={onUndo}>撤销上一轮</button>
          <button type="button" disabled={isDrawActive || winnerCount === 0} onClick={() => { if (window.confirm('重置中奖记录，并将所有号码放回可抽取名单？')) onResetHistory(); }}>重置中奖记录</button>
          <button className="operator-panel__danger" type="button" disabled={isDrawActive} onClick={() => { if (window.confirm('确定要重置全部抽奖数据、设置和已导入名单吗？')) onResetAll(); }}>全部重置</button>
        </div>
      </section>
    </div>
  );
}
