import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../ui/utils";
import type { WorkflowStep, WorkflowStepStatus } from "./types";

type WorkflowStripProps = {
  steps: WorkflowStep[];
  ariaLabel?: string;
  density?: "comfortable" | "compact";
  layout?: "scroll" | "wrap";
};

const STATUS_TONE: Record<WorkflowStepStatus, string> = {
  neutral: "text-slate-600",
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-rose-600",
};

function formatNumberLike(value: number | string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("ko-KR");
  }
  return String(value ?? "-");
}

function formatPercent(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const clamped = Math.max(0, Math.min(100, value));
  return `${clamped.toFixed(1)}%`;
}

function toCardAriaLabel(step: WorkflowStep, index: number) {
  const parts = [
    `${index + 1}단계`,
    step.title,
    `값 ${formatNumberLike(step.value)}`,
  ];
  const percent = formatPercent(step.percentOfTotal);
  if (percent) parts.push(`전체 대비 ${percent}`);
  const conversion = formatPercent(step.conversionFromPrev);
  if (conversion) parts.push(`전환율 ${conversion}`);
  if (step.helperText) parts.push(step.helperText);
  return parts.join(", ");
}

export function WorkflowStrip({
  steps,
  ariaLabel = "워크플로우 단계 흐름",
  density = "comfortable",
  layout = "scroll",
}: WorkflowStripProps) {
  const isCompact = density === "compact";
  const isScroll = layout === "scroll";

  if (!steps || steps.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
        표시할 단계 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-3 shadow-sm", isCompact ? "p-2.5" : "p-3")}>
      <div className={cn(isScroll ? "overflow-x-auto pb-1" : "overflow-visible")}>
        <ol
          className={cn(
            "items-stretch",
            isScroll ? "flex min-w-max gap-2" : "flex flex-wrap gap-2"
          )}
          aria-label={ariaLabel}
        >
          {steps.map((step, index) => {
            const percentText = formatPercent(step.percentOfTotal);
            const conversionText = formatPercent(step.conversionFromPrev);
            const statusTone = STATUS_TONE[step.status ?? "neutral"];
            const isInteractive = typeof step.onClick === "function";

            return (
              <React.Fragment key={step.id}>
                <li
                  className={cn(
                    "rounded-xl border border-slate-200 bg-slate-50/70 transition-all",
                    isScroll ? "w-[198px] shrink-0" : "min-w-[180px] grow basis-[180px]",
                    isInteractive && "hover:border-slate-300 hover:shadow-md"
                  )}
                >
                  {isInteractive ? (
                    <button
                      type="button"
                      onClick={step.onClick}
                      className={cn(
                        "h-full w-full rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
                        isCompact ? "px-3 py-2.5" : "px-4 py-3"
                      )}
                      aria-label={toCardAriaLabel(step, index)}
                      title={step.helperText}
                    >
                      <p className={cn("font-semibold text-slate-800", isCompact ? "text-[11px]" : "text-xs")}>{step.title}</p>
                      <p className={cn("mt-1.5 font-bold leading-none text-slate-900", isCompact ? "text-2xl" : "text-[30px]")}>
                        {formatNumberLike(step.value)}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">{step.subLabel ?? "전체 대비"}</span>
                        {percentText ? <span className={cn("font-semibold", statusTone)}>{percentText}</span> : null}
                      </div>
                      {conversionText ? (
                        <div className="mt-2 border-t border-slate-200 pt-1.5 text-[11px]">
                          <span className="text-slate-500">전환율: </span>
                          <span className={cn("font-semibold", statusTone)}>{conversionText}</span>
                        </div>
                      ) : null}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "h-full rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
                        isCompact ? "px-3 py-2.5" : "px-4 py-3"
                      )}
                      tabIndex={0}
                      aria-label={toCardAriaLabel(step, index)}
                      title={step.helperText}
                    >
                      <p className={cn("font-semibold text-slate-800", isCompact ? "text-[11px]" : "text-xs")}>{step.title}</p>
                      <p className={cn("mt-1.5 font-bold leading-none text-slate-900", isCompact ? "text-2xl" : "text-[30px]")}>
                        {formatNumberLike(step.value)}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">{step.subLabel ?? "전체 대비"}</span>
                        {percentText ? <span className={cn("font-semibold", statusTone)}>{percentText}</span> : null}
                      </div>
                      {conversionText ? (
                        <div className="mt-2 border-t border-slate-200 pt-1.5 text-[11px]">
                          <span className="text-slate-500">전환율: </span>
                          <span className={cn("font-semibold", statusTone)}>{conversionText}</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>

                {index < steps.length - 1 ? (
                  <li
                    aria-hidden="true"
                    className="flex shrink-0 items-center justify-center px-0.5 text-slate-300"
                  >
                    <ChevronRight size={18} />
                  </li>
                ) : null}
              </React.Fragment>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
