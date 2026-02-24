import type { StageKey } from "../types";

interface StageSelectCardProps {
  stage: StageKey;
  title: string;
  subtitle: string;
  io: string;
  onDemoRun: (stage: StageKey) => void;
  onEnter: (stage: StageKey) => void;
}

export function StageSelectCard({ stage, title, subtitle, io, onDemoRun, onEnter }: StageSelectCardProps) {
  return (
    <article className="stage-card">
      <p className="stage-card__kicker">{stage.toUpperCase()}</p>
      <h3>{title}</h3>
      <p className="stage-card__subtitle">{subtitle}</p>
      <p className="stage-card__io">{io}</p>
      <div className="stage-card__actions">
        <button type="button" className="btn btn-primary" onClick={() => onDemoRun(stage)}>
          Demo Run
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onEnter(stage)}>
          들어가기
        </button>
      </div>
    </article>
  );
}
