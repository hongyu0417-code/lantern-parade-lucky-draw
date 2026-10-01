import type { WinnerRecord } from '../draw/types';

type WinnerRevealProps = {
  winner: WinnerRecord;
  onNext: () => void;
  onHistory: () => void;
};

export function WinnerReveal({ winner, onNext, onHistory }: WinnerRevealProps) {
  return (
    <section className="stage-winner" role="region" aria-label="Lucky draw winner" aria-live="polite">
      <p className="stage-winner__congratulations">CONGRATULATIONS</p>
      <p className="stage-winner__label">LUCKY NUMBER</p>
      <strong className="stage-winner__number">{winner.number}</strong>
      {winner.name && <p className="stage-winner__name" data-testid="winner-name">{winner.name}</p>}
      <div className="stage-winner__actions">
        <button className="stage-button stage-button--primary" type="button" onClick={onNext}>NEXT DRAW</button>
        <button className="stage-button stage-button--secondary" type="button" onClick={onHistory}>VIEW WINNERS</button>
      </div>
    </section>
  );
}
