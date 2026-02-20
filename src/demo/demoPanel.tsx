import React, { useState } from "react";
import { DEMO_PANEL_ENABLED } from "./demoConfig";
import { forceHeroStage, resetDemoData, resetHeroCase } from "./api";

export function DemoPanel() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  if (!DEMO_PANEL_ENABLED) return null;

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusyKey(key);
    try {
      await action();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-amber-800">Demo Operator Panel</p>
          <p className="text-[11px] text-amber-700">영상 촬영용 상태 리셋/강제 진행</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            disabled={busyKey !== null}
            onClick={() => void run("resetSeed", resetDemoData)}
          >
            {busyKey === "resetSeed" ? "처리중..." : "Reset Seed"}
          </button>
          <button
            type="button"
            className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            disabled={busyKey !== null}
            onClick={() => void run("resetHero", resetHeroCase)}
          >
            {busyKey === "resetHero" ? "처리중..." : "Hero 초기화"}
          </button>
          <button
            type="button"
            className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            disabled={busyKey !== null}
            onClick={() => void run("stage1", () => forceHeroStage("STAGE1"))}
          >
            Stage1
          </button>
          <button
            type="button"
            className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            disabled={busyKey !== null}
            onClick={() => void run("stage2", () => forceHeroStage("STAGE2"))}
          >
            Stage2
          </button>
          <button
            type="button"
            className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            disabled={busyKey !== null}
            onClick={() => void run("stage3", () => forceHeroStage("STAGE3"))}
          >
            Stage3
          </button>
        </div>
      </div>
    </div>
  );
}
