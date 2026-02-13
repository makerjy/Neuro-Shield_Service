import React from "react";
import { StageMirrorDetail } from "./shared/StageMirrorDetail";

interface CaseDetailStage3Props {
  caseId: string;
  onBack: () => void;
}

export function CaseDetailStage3({ caseId, onBack }: CaseDetailStage3Props) {
  return <StageMirrorDetail caseId={caseId} stage="Stage 3" onBack={onBack} />;
}
