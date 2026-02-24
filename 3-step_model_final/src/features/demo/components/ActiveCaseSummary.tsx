import { STAGE_LABELS } from "../constants";
import type { ActiveCaseState, StageKey } from "../types";

interface ActiveCaseSummaryProps {
  activeCase: ActiveCaseState;
  stage: StageKey;
}

export function ActiveCaseSummary({ activeCase, stage }: ActiveCaseSummaryProps) {
  return (
    <section className="active-case-card">
      <div className="active-case-main">
        <p className="eyebrow">Active Case</p>
        <h2>
          {activeCase.name} <span className="muted">({activeCase.ageBand})</span>
        </h2>
        <p className="active-case-meta">
          caseId <code>{activeCase.caseId}</code> · PTID <code>{activeCase.ptid}</code> · 현재 {STAGE_LABELS[stage]}
        </p>
      </div>

      <div className="active-case-status">
        <span className="chip chip-primary">{activeCase.stageStatus}</span>
        {activeCase.badges.map((badge) => (
          <span key={badge} className="chip chip-muted">
            {badge}
          </span>
        ))}
        {activeCase.badges.length === 0 && <span className="chip chip-muted">이전 결과 없음</span>}
      </div>
    </section>
  );
}
