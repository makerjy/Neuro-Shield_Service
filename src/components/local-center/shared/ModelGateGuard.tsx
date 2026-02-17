import React from "react";
import { AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "../v2/shared";

type ModelGateGuardProps = {
  stage: 2 | 3;
  missing: string[];
  onOpenStep?: () => void;
  className?: string;
};

export function ModelGateGuard({ stage, missing, onOpenStep, className }: ModelGateGuardProps) {
  const previewMissing = missing.slice(0, 3);

  return (
    <section className={cn("rounded-xl border border-amber-200 bg-amber-50 p-4", className)}>
      <div className="flex items-start gap-2">
        <AlertCircle size={16} className="mt-0.5 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900">
            Stage {stage} 결과 대기
          </p>
          <p className="mt-1 text-xs text-amber-800">
            모델 결과는 검사결과 입력 후 확인할 수 있습니다. 최종 판단은 담당자와 의료진 확인이 필요합니다.
          </p>

          {previewMissing.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[11px] text-amber-800">
              {previewMissing.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3">
            <button
              type="button"
              onClick={onOpenStep}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
            >
              검사 결과 입력 열기
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ModelGateGuard;
