import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CaseDetailStage2Page } from "./stage2/CaseDetailStage2Page";
import { getStage2CaseDetailById, getStage2SampleCaseDetail } from "./stage2/stage2Mock";

interface CaseDetailStage2Props {
  caseId: string;
  onBack: () => void;
}

export function CaseDetailStage2({ caseId, onBack }: CaseDetailStage2Props) {
  const data = getStage2CaseDetailById(caseId);

  if (!data) {
    return (
      <div className="flex min-h-[460px] items-center justify-center">
        <Card className="w-full max-w-lg border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              케이스를 찾을 수 없습니다
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-900">
            <p>요청한 케이스 ID: {caseId}</p>
            <p>샘플 화면으로 이동하거나 목록으로 돌아갈 수 있습니다.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onBack}>
                목록으로 이동
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <CaseDetailStage2Page data={data} onBack={onBack} />;
}

export function CaseDetailStage2SamplePage({ onBack }: { onBack: () => void }) {
  return <CaseDetailStage2Page data={getStage2SampleCaseDetail()} onBack={onBack} />;
}
