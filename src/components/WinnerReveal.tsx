import type { WinnerRecord } from '../draw/types';

type WinnerRevealProps = {
  winner: WinnerRecord;
  onNext: () => void;
  onHistory: () => void;
};

export function WinnerReveal({ winner, onNext, onHistory }: WinnerRevealProps) {
  return (
    <section className="stage-winner" role="region" aria-label="幸运抽奖结果" aria-live="polite">
      <p className="stage-winner__congratulations">恭喜！</p>
      <p className="stage-winner__label">中奖号码</p>
      <strong className="stage-winner__number">{winner.number}</strong>
      {winner.name && <p className="stage-winner__name" data-testid="winner-name">{winner.name}</p>}
      <div className="stage-winner__actions">
        <button className="stage-button stage-button--primary" type="button" onClick={onNext}>下一轮抽奖</button>
        <button className="stage-button stage-button--secondary" type="button" onClick={onHistory}>查看中奖名单</button>
      </div>
    </section>
  );
}
