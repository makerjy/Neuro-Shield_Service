import React from "react";
import { Stage3CaseDetailPage } from "./stage3/Stage3CaseDetailPage";

interface CaseDetailStage3Props {
  caseId: string;
  onBack: () => void;
}

export function CaseDetailStage3({ caseId, onBack }: CaseDetailStage3Props) {
  return <Stage3CaseDetailPage caseId={caseId} onBack={onBack} />;
}
