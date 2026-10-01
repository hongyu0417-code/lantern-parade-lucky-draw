import type { KeyboardEvent } from 'react';
import type { WinnerRecord } from '../draw/types';
import '../styles/panels.css';

type WinnerHistoryProps = {
  winnerHistory: WinnerRecord[];
  onClose: () => void;
};

function containTab(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)'));
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

export function WinnerHistory({ winnerHistory, onClose }: WinnerHistoryProps) {
  return (
    <div className="overlay-backdrop">
      <section className="operator-dialog winner-history" role="dialog" aria-modal="true" aria-labelledby="winner-history-heading" onKeyDown={containTab}>
        <header className="operator-dialog__header">
          <div>
            <p className="operator-dialog__eyebrow">A RECORD OF FORTUNE</p>
            <h2 id="winner-history-heading">Winner history</h2>
          </div>
          <button className="operator-dialog__close" type="button" aria-label="Close winner history" onClick={onClose} autoFocus>×</button>
        </header>
        {winnerHistory.length === 0 ? (
          <p className="winner-history__empty">No winners yet. The first lucky lantern is still waiting.</p>
        ) : (
          <ol className="winner-history__list">
            {[...winnerHistory].reverse().map((winner) => (
              <li className="winner-history__row" key={`${winner.round}-${winner.drawnAt}`}>
                <span className="winner-history__round">Round {winner.round}</span>
                <strong className="winner-history__number">{winner.number}</strong>
                {winner.name && <span className="winner-history__name">{winner.name}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
