import React from "react";
import { Loader2, Timer, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "./ui/utils";
import type { ModelJob } from "../demo/seed";

interface ModelJobProgressCardProps {
  job?: ModelJob | null;
  title?: string;
  className?: string;
  showIdle?: boolean;
  showDevTools?: boolean;
  onInstantComplete?: () => void | Promise<void>;
}

function formatEta(seconds?: number) {
  const safe = Math.max(0, seconds ?? 0);
  const mm = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

function statusTone(status: ModelJob["status"]) {
  if (status === "SUCCEEDED") return "border-success/30 bg-success/10 text-success";
  if (status === "FAILED") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "RUNNING") return "border-primary/30 bg-accent text-primary";
  return "border-warning/30 bg-warning/10 text-warning";
}

function statusLabel(status: ModelJob["status"]) {
  if (status === "SUCCEEDED") return "succeeded";
  if (status === "FAILED") return "failed";
  if (status === "RUNNING") return "running";
  return "queued";
}

export function ModelJobProgressCard({
  job,
  title = "모델 실행 상태",
  className,
  showIdle = true,
  showDevTools = false,
  onInstantComplete,
}: ModelJobProgressCardProps) {
  if (!job && !showIdle) return null;
  const status = job?.status ?? "QUEUED";
  const running = status === "RUNNING" || status === "QUEUED";
  const progress = job?.progress ?? 0;

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{title}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", statusTone(status))}>
              {statusLabel(status)}
            </span>
            {status === "RUNNING" || status === "QUEUED" ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Timer size={13} />
                ETA {formatEta(job?.etaSeconds)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "SUCCEEDED" ? <CheckCircle2 size={16} className="text-success" /> : null}
          {status === "FAILED" ? <AlertCircle size={16} className="text-destructive" /> : null}
          {running ? <Loader2 size={16} className="animate-spin text-primary" /> : null}
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-200 ease-out",
              status === "FAILED" ? "bg-destructive" : status === "SUCCEEDED" ? "bg-success" : "bg-primary",
            )}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>{running ? "모델 산출 중" : status === "SUCCEEDED" ? "모델 산출 완료" : "모델 상태 확인 필요"}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {import.meta.env.DEV && showDevTools && running && onInstantComplete ? (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
            onClick={() => void onInstantComplete()}
          >
            즉시 완료(Dev)
          </button>
        </div>
      ) : null}
    </div>
  );
}
