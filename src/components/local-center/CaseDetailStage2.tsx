import React from "react";
import { StageMirrorDetail } from "./shared/StageMirrorDetail";

interface CaseDetailStage2Props {
  caseId: string;
  onBack: () => void;
}

export function CaseDetailStage2({ caseId, onBack }: CaseDetailStage2Props) {
  return <StageMirrorDetail caseId={caseId} stage="Stage 2" forceMode="stage3" onBack={onBack} />;
}

export function CaseDetailStage2SamplePage({ onBack }: { onBack: () => void }) {
  return <CaseDetailStage2 caseId="CASE-2026-002" onBack={onBack} />;
}
