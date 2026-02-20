import { DEMO_LATENCY_MS, DEMO_SPEED, HERO_CASE_ID, STAGE_MODEL_DURATION_SECONDS } from "./demoConfig";
import type { Case, ModelJob, TimelineEvent } from "./seed";
import {
  appendTimeline,
  ensureDemoSeed,
  getCase as getCaseFromStore,
  getHeroCaseId,
  getLatestJobByCase,
  getPerson,
  getJob,
  listCases as listCasesFromStore,
  listTimeline as listTimelineFromStore,
  resetDemoSeed,
  resetHeroCaseState,
  updateCase,
  updateJob,
  upsertJob,
} from "./store";

type JobRuntime = {
  queueTimer?: number;
  intervalTimer?: number;
  complete: () => void;
};

const runtimes = new Map<string, JobRuntime>();
let sequence = 0;

function nowIso() {
  return new Date().toISOString();
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function withLatency<T>(mode: keyof typeof DEMO_LATENCY_MS, builder: () => T) {
  await wait(DEMO_LATENCY_MS[mode]);
  return builder();
}

function createJobId(stage: ModelJob["stage"], caseId: string) {
  sequence += 1;
  const suffix = String(sequence).padStart(4, "0");
  return `JOB-${stage}-${caseId}-${suffix}`;
}

function toSeconds(durationMs: number) {
  return Math.max(1, Math.ceil(durationMs / 1000));
}

function normalizeProbabilities(input: Record<string, number>) {
  const keys = Object.keys(input);
  const safeEntries = keys.map((key) => [key, Math.max(0, input[key] ?? 0)] as const);
  const sum = safeEntries.reduce((acc, [, value]) => acc + value, 0);
  if (sum <= 0) {
    const fallback = Number((1 / Math.max(1, keys.length)).toFixed(4));
    const result: Record<string, number> = {};
    for (const key of keys) result[key] = fallback;
    return result;
  }

  const result: Record<string, number> = {};
  let cumulative = 0;
  safeEntries.forEach(([key, value], index) => {
    if (index === safeEntries.length - 1) {
      result[key] = Number((1 - cumulative).toFixed(4));
      return;
    }
    const normalized = Number((value / sum).toFixed(4));
    result[key] = normalized;
    cumulative += normalized;
  });
  return result;
}

function formatTimeline(type: TimelineEvent["type"], caseId: string, summary: string, meta?: Record<string, any>) {
  return {
    ts: nowIso(),
    caseId,
    type,
    summary,
    meta,
  } satisfies TimelineEvent;
}

function heroStage1Result() {
  return {
    riskScore: 78,
    riskBand: "HIGH" as const,
    keyFactors: ["인지기능 저하 신호", "대사/혈관성 위험", "활동량 감소", "수면 패턴 불안정"],
  };
}

function heroStage2Labs(receivedAt = nowIso()) {
  return {
    cognition: { MMSE: 23, MoCA: 18 },
    blood: { HbA1c: 6.4, LDL: 158 },
    biomarker: { pTau: 1.8 },
    receivedAt,
  };
}

function heroStage2Classification() {
  return {
    label: "MCI_HIGH" as const,
    probs: normalizeProbabilities({
      NORMAL: 0.03,
      MCI_LOW: 0.12,
      MCI_HIGH: 0.78,
      AD: 0.07,
    }),
    reasons: ["인지검사 저하", "혈액 지표 위험", "생활패턴 위험", "MRI 위험 패턴 연계"],
  };
}

function datePlusDays(days: number) {
  const base = new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

function heroStage3Plan() {
  return [
    { title: "감별검사 예약 연계", owner: "센터", dueAt: datePlusDays(7), status: "TODO" as const },
    { title: "생활습관 개선 프로그램 등록", owner: "센터", dueAt: datePlusDays(14), status: "TODO" as const },
    { title: "보호자 상담", owner: "보호자", dueAt: datePlusDays(10), status: "TODO" as const },
    { title: "3개월 추적(인지/생활)", owner: "센터", dueAt: datePlusDays(90), status: "TODO" as const },
    { title: "병원 진료 결과 회신 요청", owner: "병원", dueAt: datePlusDays(21), status: "TODO" as const },
    { title: "복약/운동 자가실천 점검", owner: "본인", dueAt: datePlusDays(30), status: "DOING" as const },
  ];
}

function buildCaseSummary(item: Case) {
  const person = getPerson(item.personId);
  if (!person) return null;
  return {
    case: item,
    person,
    latestJob: getLatestJobByCase(item.caseId),
  };
}

function clearRuntime(jobId: string) {
  const runtime = runtimes.get(jobId);
  if (!runtime) return;
  if (runtime.queueTimer) window.clearTimeout(runtime.queueTimer);
  if (runtime.intervalTimer) window.clearInterval(runtime.intervalTimer);
  runtimes.delete(jobId);
}

function launchJob(
  job: ModelJob,
  stageDurationSeconds: number,
  onComplete: () => void,
) {
  const durationMs = Math.max(700, Math.round((stageDurationSeconds * 1000) / DEMO_SPEED));
  const queueMs = Math.max(180, Math.round(800 / DEMO_SPEED));

  const completeJob = () => {
    clearRuntime(job.jobId);
    const next = getJob(job.jobId);
    if (!next || next.status === "SUCCEEDED" || next.status === "FAILED") return;

    updateJob(job.jobId, (previous) => ({
      ...previous,
      status: "SUCCEEDED",
      progress: 100,
      etaSeconds: 0,
    }));
    onComplete();
  };

  const runtime: JobRuntime = {
    complete: completeJob,
  };
  runtimes.set(job.jobId, runtime);

  runtime.queueTimer = window.setTimeout(() => {
    const startedAt = nowIso();
    updateJob(job.jobId, (previous) => ({
      ...previous,
      status: "RUNNING",
      startedAt,
      progress: Math.max(previous.progress, 5),
      etaSeconds: toSeconds(durationMs),
    }));

    const startedMs = Date.now();
    runtime.intervalTimer = window.setInterval(() => {
      const current = getJob(job.jobId);
      if (!current || current.status !== "RUNNING") {
        clearRuntime(job.jobId);
        return;
      }

      const elapsed = Date.now() - startedMs;
      const ratio = Math.min(1, elapsed / durationMs);
      if (ratio >= 1) {
        completeJob();
        return;
      }

      updateJob(job.jobId, (previous) => ({
        ...previous,
        status: "RUNNING",
        progress: Math.min(99, Math.max(previous.progress, Math.round(ratio * 100))),
        etaSeconds: toSeconds(Math.max(0, durationMs - elapsed)),
      }));
    }, 250);
  }, queueMs);
}

function ensureCase(caseId: string) {
  const item = getCaseFromStore(caseId);
  if (!item) throw new Error(`Case not found: ${caseId}`);
  return item;
}

function hasActiveJob(caseId: string, stage: ModelJob["stage"]) {
  const latest = getLatestJobByCase(caseId, stage);
  if (!latest) return false;
  return latest.status === "QUEUED" || latest.status === "RUNNING";
}

function requestJob(caseId: string, stage: ModelJob["stage"]) {
  if (hasActiveJob(caseId, stage)) {
    const existing = getLatestJobByCase(caseId, stage);
    if (existing) return existing;
  }
  const durationSeconds = STAGE_MODEL_DURATION_SECONDS[stage];
  const job: ModelJob = {
    jobId: createJobId(stage, caseId),
    caseId,
    stage,
    status: "QUEUED",
    progress: 0,
    etaSeconds: toSeconds((durationSeconds * 1000) / DEMO_SPEED),
  };
  upsertJob(job);
  return job;
}

export async function listCases(stage?: Case["currentStage"]) {
  ensureDemoSeed();
  return withLatency("list", () =>
    listCasesFromStore(stage)
      .map(buildCaseSummary)
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  );
}

export async function getCaseDetail(caseId: string) {
  ensureDemoSeed();
  return withLatency("detail", () => {
    const item = getCaseFromStore(caseId);
    if (!item) return null;
    const person = getPerson(item.personId);
    if (!person) return null;
    return {
      case: item,
      person,
      latestJob: getLatestJobByCase(caseId),
      timeline: listTimelineFromStore(caseId),
    };
  });
}

export async function getCase(caseId: string) {
  ensureDemoSeed();
  return withLatency("detail", () => {
    const item = ensureCase(caseId);
    const person = getPerson(item.personId);
    if (!person) throw new Error("Person not found");
    return {
      case: item,
      person,
      latestJob: getLatestJobByCase(caseId),
    };
  });
}

export async function listTimeline(caseId: string) {
  ensureDemoSeed();
  return withLatency("detail", () => listTimelineFromStore(caseId));
}

export async function runStage1Model(caseId: string) {
  ensureDemoSeed();
  return withLatency("mutate", () => {
    const item = ensureCase(caseId);
    if (item.currentStage !== "STAGE1") throw new Error("Stage1 케이스에서만 실행할 수 있습니다.");
    const active = getLatestJobByCase(caseId, "STAGE1");
    if (active && (active.status === "QUEUED" || active.status === "RUNNING")) return active;
    const job = requestJob(caseId, "STAGE1");

    updateCase(caseId, (previous) => ({
      ...previous,
      stage1: {
        ...previous.stage1,
        status: "IN_PROGRESS",
      },
      ops: {
        ...previous.ops,
        loopStep: {
          ...previous.ops.loopStep,
          stage1Step: Math.max(2, previous.ops.loopStep.stage1Step),
        },
      },
    }));

    appendTimeline(
      formatTimeline("STAGE1_MODEL_REQUESTED", caseId, "Stage1 ML 모델 실행 요청", {
        jobId: job.jobId,
        etaSeconds: job.etaSeconds,
      }),
    );

    launchJob(job, STAGE_MODEL_DURATION_SECONDS.STAGE1, () => {
      updateCase(caseId, (previous) => ({
        ...previous,
        stage1: {
          status: "DONE",
          ...heroStage1Result(),
        },
        ops: {
          ...previous.ops,
          contactPriority: "HIGH",
          loopStep: {
            ...previous.ops.loopStep,
            stage1Step: 3,
          },
        },
      }));

      appendTimeline(
        formatTimeline("STAGE1_MODEL_DONE", caseId, "Stage1 모델 산출 완료", {
          riskScore: 78,
          riskBand: "HIGH",
        }),
      );
    });

    return job;
  });
}

export async function promoteToStage2(caseId: string) {
  ensureDemoSeed();
  return withLatency("mutate", () => {
    const item = ensureCase(caseId);
    if (item.stage1.status !== "DONE") throw new Error("Stage1 결과 완료 후에 Stage2로 상승할 수 있습니다.");

    const next = updateCase(caseId, (previous) => ({
      ...previous,
      currentStage: "STAGE2",
      stage2: {
        ...previous.stage2,
        status: "NOT_READY",
        labs: undefined,
        classification: undefined,
      },
      ops: {
        ...previous.ops,
        loopStep: {
          ...previous.ops.loopStep,
          stage2Step: 1,
        },
      },
    }));

    appendTimeline(formatTimeline("PROMOTED_TO_STAGE2", caseId, "Stage2(추가검사)로 상승"));
    return next;
  });
}

export async function submitStage2Labs(
  caseId: string,
  payload?: Partial<NonNullable<Case["stage2"]["labs"]>>,
) {
  ensureDemoSeed();
  return withLatency("mutate", () => {
    const item = ensureCase(caseId);
    if (item.currentStage !== "STAGE2") throw new Error("Stage2 케이스에서만 검사결과를 수신할 수 있습니다.");

    const labs = {
      ...heroStage2Labs(),
      ...(payload ?? {}),
      receivedAt: payload?.receivedAt ?? nowIso(),
    };

    const next = updateCase(caseId, (previous) => ({
      ...previous,
      stage2: {
        ...previous.stage2,
        labs,
        status: "LABS_RECEIVED",
      },
      ops: {
        ...previous.ops,
        loopStep: {
          ...previous.ops.loopStep,
          stage2Step: 2,
        },
      },
    }));

    appendTimeline(
      formatTimeline("STAGE2_LABS_RECEIVED", caseId, "Stage2 검사결과 수신", {
        receivedAt: labs.receivedAt,
      }),
    );
    return next;
  });
}

export async function runStage2Model(caseId: string) {
  ensureDemoSeed();
  return withLatency("mutate", () => {
    const item = ensureCase(caseId);
    if (item.currentStage !== "STAGE2") throw new Error("Stage2 케이스에서만 실행할 수 있습니다.");
    if (!item.stage2.labs) throw new Error("검사결과 수신 후 실행 가능합니다.");
    const active = getLatestJobByCase(caseId, "STAGE2");
    if (active && (active.status === "QUEUED" || active.status === "RUNNING")) return active;

    const job = requestJob(caseId, "STAGE2");

    updateCase(caseId, (previous) => ({
      ...previous,
      stage2: {
        ...previous.stage2,
        status: "MODEL_RUNNING",
      },
      ops: {
        ...previous.ops,
        loopStep: {
          ...previous.ops.loopStep,
          stage2Step: Math.max(2, previous.ops.loopStep.stage2Step),
        },
      },
    }));

    appendTimeline(formatTimeline("STAGE2_MODEL_REQUESTED", caseId, "Stage2 3중 분류 모델 실행 요청", { jobId: job.jobId }));

    launchJob(job, STAGE_MODEL_DURATION_SECONDS.STAGE2, () => {
      updateCase(caseId, (previous) => ({
        ...previous,
        stage2: {
          ...previous.stage2,
          status: "DONE",
          classification: heroStage2Classification(),
        },
        ops: {
          ...previous.ops,
          loopStep: {
            ...previous.ops.loopStep,
            stage2Step: 4,
          },
        },
      }));
      appendTimeline(
        formatTimeline("STAGE2_MODEL_DONE", caseId, "Stage2 분류 완료: High-MCI", {
          label: "MCI_HIGH",
        }),
      );
    });

    return job;
  });
}

export async function promoteToStage3(caseId: string) {
  ensureDemoSeed();
  return withLatency("mutate", () => {
    const item = ensureCase(caseId);
    if (item.stage2.status !== "DONE") throw new Error("Stage2 결과 완료 후 Stage3로 상승할 수 있습니다.");

    const next = updateCase(caseId, (previous) => ({
      ...previous,
      currentStage: "STAGE3",
      stage3: {
        status: "NOT_STARTED",
        inputs: undefined,
        conversionRisk: undefined,
        carePlan: undefined,
      },
      ops: {
        ...previous.ops,
        loopStep: {
          ...previous.ops.loopStep,
          stage3Step: 1,
        },
      },
    }));
    appendTimeline(formatTimeline("PROMOTED_TO_STAGE3", caseId, "Stage3(추가관리)로 상승"));
    return next;
  });
}

export async function runStage3Model(caseId: string) {
  ensureDemoSeed();
  return withLatency("mutate", () => {
    const item = ensureCase(caseId);
    if (item.currentStage !== "STAGE3") throw new Error("Stage3 케이스에서만 실행할 수 있습니다.");
    if (item.stage2.classification?.label !== "MCI_HIGH") throw new Error("High-MCI 케이스에서만 Stage3 모델을 실행할 수 있습니다.");
    const active = getLatestJobByCase(caseId, "STAGE3");
    if (active && (active.status === "QUEUED" || active.status === "RUNNING")) return active;

    const job = requestJob(caseId, "STAGE3");
    const inputs = {
      annFeaturesReady: true,
      cnnMriScore: 0.62,
      note: "멀티모달 점수 반영",
    };

    updateCase(caseId, (previous) => ({
      ...previous,
      stage3: {
        ...previous.stage3,
        status: "MODEL_RUNNING",
        inputs,
      },
      ops: {
        ...previous.ops,
        loopStep: {
          ...previous.ops.loopStep,
          stage3Step: Math.max(2, previous.ops.loopStep.stage3Step),
        },
      },
    }));

    appendTimeline(formatTimeline("STAGE3_MODEL_REQUESTED", caseId, "Stage3 멀티모달 모델 실행 요청", { jobId: job.jobId }));

    launchJob(job, STAGE_MODEL_DURATION_SECONDS.STAGE3, () => {
      const updatedAt = nowIso();
      updateCase(caseId, (previous) => ({
        ...previous,
        stage3: {
          ...previous.stage3,
          status: "DONE",
          inputs,
          conversionRisk: {
            horizonYears: 2,
            yearly: [
              { year: 1, prob: 0.22 },
              { year: 2, prob: 0.41 },
            ],
            updatedAt,
          },
          carePlan: heroStage3Plan(),
        },
        ops: {
          ...previous.ops,
          loopStep: {
            ...previous.ops.loopStep,
            stage3Step: 3,
          },
        },
      }));

      appendTimeline(formatTimeline("STAGE3_MODEL_DONE", caseId, "Stage3 전환위험 산출 완료", { year1: 0.22, year2: 0.41 }));
      appendTimeline(formatTimeline("CAREPLAN_CREATED", caseId, "Stage3 조치 계획 생성", { planCount: 6 }));
    });

    return job;
  });
}

export async function instantCompleteLatestJob(caseId: string, stage: ModelJob["stage"]) {
  ensureDemoSeed();
  return withLatency("mutate", () => {
    const latest = getLatestJobByCase(caseId, stage);
    if (!latest) return null;
    const runtime = runtimes.get(latest.jobId);
    if (runtime) runtime.complete();
    return getJob(latest.jobId);
  });
}

export async function resetDemoData() {
  return withLatency("mutate", () => {
    resetDemoSeed();
    for (const [jobId, runtime] of runtimes.entries()) {
      if (runtime.queueTimer) window.clearTimeout(runtime.queueTimer);
      if (runtime.intervalTimer) window.clearInterval(runtime.intervalTimer);
      runtimes.delete(jobId);
    }
    return true;
  });
}

export async function resetHeroCase() {
  return withLatency("mutate", () => {
    resetHeroCaseState();
    return getCaseFromStore(HERO_CASE_ID);
  });
}

export async function forceHeroStage(stage: Case["currentStage"]) {
  ensureDemoSeed();
  return withLatency("mutate", () => {
    resetHeroCaseState();

    if (stage === "STAGE1") {
      return getCaseFromStore(HERO_CASE_ID);
    }

    updateCase(HERO_CASE_ID, (previous) => ({
      ...previous,
      stage1: {
        status: "DONE",
        ...heroStage1Result(),
      },
      currentStage: "STAGE2",
      stage2: {
        status: "LABS_RECEIVED",
        labs: heroStage2Labs(),
      },
      ops: {
        ...previous.ops,
        contactPriority: "HIGH",
        loopStep: {
          stage1Step: 3,
          stage2Step: 2,
          stage3Step: 0,
        },
      },
    }));

    appendTimeline(formatTimeline("PROMOTED_TO_STAGE2", HERO_CASE_ID, "운영자 패널: Hero Stage2로 강제 이동"));

    if (stage === "STAGE2") {
      return getCaseFromStore(HERO_CASE_ID);
    }

    updateCase(HERO_CASE_ID, (previous) => ({
      ...previous,
      stage2: {
        ...previous.stage2,
        status: "DONE",
        classification: heroStage2Classification(),
      },
      currentStage: "STAGE3",
      stage3: {
        status: "NOT_STARTED",
      },
      ops: {
        ...previous.ops,
        loopStep: {
          ...previous.ops.loopStep,
          stage2Step: 4,
          stage3Step: 1,
        },
      },
    }));

    appendTimeline(formatTimeline("PROMOTED_TO_STAGE3", HERO_CASE_ID, "운영자 패널: Hero Stage3로 강제 이동"));
    return getCaseFromStore(HERO_CASE_ID);
  });
}

export function getHeroCase() {
  const item = getCaseFromStore(getHeroCaseId());
  if (!item) return null;
  const person = getPerson(item.personId);
  if (!person) return null;
  return { case: item, person, latestJob: getLatestJobByCase(item.caseId) };
}
