import { generateCases, maskPhone } from "../caseData";
import {
  buildRecommendedActions,
  buildStage3RecommendedActionQueue,
} from "./stage3ActionRules";
import type {
  ConfidenceLevel,
  ExecuteActionBody,
  ExecuteActionResult,
  Stage3OperationalStatus,
  Stage3Case,
  Stage3TimelineEvent,
  SupportRequestBody,
  SupportRequestResult,
} from "./stage3Types";

const store = new Map<string, Stage3Case>();
let logCounter = 1200;

function seeded(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

function delay(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const useRemote = (globalThis as any)?.__NEURO_SHIELD_USE_REAL_API__ === true;
  if (!useRemote) {
    throw new Error("Remote API disabled");
  }
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function nowYmdHm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function plusDaysYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function daysUntil(target?: string): number | null {
  if (!target) return null;
  const diff = Math.ceil(
    (new Date(`${target}T00:00:00`).getTime() -
      new Date().setHours(0, 0, 0, 0)) /
      (1000 * 60 * 60 * 24),
  );
  return diff;
}

function zoneFromScore(scoreChangePct: number, failStreak: number): Stage3Case["risk"]["zone"] {
  if (scoreChangePct <= -10 || failStreak >= 4) return "danger";
  if (scoreChangePct <= -5 || failStreak >= 2) return "watch";
  return "stable";
}

function clampProbability(value: number): number {
  return Math.max(0.01, Math.min(0.99, value));
}

function computeMissingCount(dataQualityPct: number): number {
  return Math.max(0, Math.round((100 - dataQualityPct) / 5));
}

function confidenceFromQuality(dataQualityPct: number, missingCount: number): ConfidenceLevel {
  if (dataQualityPct >= 95 && missingCount === 0) return "HIGH";
  if (dataQualityPct >= 88 && missingCount <= 2) return "MID";
  return "LOW";
}

function intervalFromConfidence(probability: number, confidence: ConfidenceLevel) {
  const width = confidence === "HIGH" ? 0.08 : confidence === "MID" ? 0.14 : 0.2;
  return {
    low: Math.max(0, Math.round((probability - width / 2) * 100)),
    high: Math.min(100, Math.round((probability + width / 2) * 100)),
  };
}

function buildPredictionAtSeries(probability: number): { at: string; p: number }[] {
  const base = clampProbability(probability);
  const points = [base - 0.11, base - 0.08, base - 0.05, base - 0.03, base - 0.015, base];
  return points.map((p, idx) => ({
    at: `${plusDaysYmd(-150 + idx * 30)} 09:00`,
    p: Number(clampProbability(p).toFixed(2)),
  }));
}

function estimatePrediction(
  scoreChangePct: number,
  failStreak: number,
  zone: Stage3Case["risk"]["zone"],
  dataQualityPct: number,
): Stage3Case["prediction"] {
  const zoneBias = zone === "danger" ? 0.24 : zone === "watch" ? 0.14 : 0.06;
  const scoreBias = Math.max(0, Math.abs(Math.min(0, scoreChangePct)) * 0.015);
  const contactBias = Math.min(0.2, failStreak * 0.03);
  const qualityPenalty = Math.max(0, (95 - dataQualityPct) * 0.003);
  const probability = clampProbability(0.28 + zoneBias + scoreBias + contactBias + qualityPenalty);
  const missingCount = computeMissingCount(dataQualityPct);
  const confidence = confidenceFromQuality(dataQualityPct, missingCount);
  const intervalPct = intervalFromConfidence(probability, confidence);

  return {
    horizonMonths: 24,
    probability: Number(probability.toFixed(2)),
    generatedAt: nowYmdHm(),
    confidence,
    intervalPct,
    topDrivers: [
      {
        key: "score_decline",
        label: "점수 하락",
        direction: "UP",
        delta: Math.abs(scoreChangePct),
        evidenceRef: "stage3-panel-risk",
      },
      {
        key: "contact_fail",
        label: "연락 실패 누적",
        direction: "UP",
        delta: failStreak,
        evidenceRef: "stage3-panel-followup",
      },
      {
        key: "data_quality",
        label: missingCount > 0 ? "누락 데이터 영향" : "데이터 품질 안정",
        direction: missingCount > 0 ? "UP" : "DOWN",
        delta: missingCount,
        evidenceRef: "stage3-panel-update",
      },
    ],
    trend: buildPredictionAtSeries(probability),
  };
}

function refreshPrediction(stage3: Stage3Case) {
  const scoreChangePct = stage3.metrics.scoreChangePct ?? 0;
  const failStreak = stage3.metrics.contactFailStreak ?? 0;
  const zone = stage3.risk.zone;
  const dataQualityPct = stage3.metrics.dataQualityPct ?? 0;
  const next = estimatePrediction(scoreChangePct, failStreak, zone, dataQualityPct);
  const prevTrend = stage3.prediction?.trend ?? [];
  const mergedTrend = [...prevTrend.slice(-5), { at: nowYmdHm(), p: next.probability }];
  stage3.prediction = { ...next, trend: mergedTrend };
}

function mapTrackingCycleDays(
  intensity: Stage3Case["risk"]["intensity"],
): number {
  if (intensity === "biweekly") return 14;
  if (intensity === "monthly") return 30;
  return 90;
}

function deriveChurnRisk(stage3: Stage3Case): Stage3Case["headerMeta"]["churn_risk"] {
  const p = stage3.prediction.probability;
  const failStreak = stage3.metrics.contactFailStreak ?? 0;
  if (p >= 0.72 || failStreak >= 4) return "HIGH";
  if (p >= 0.55 || failStreak >= 2) return "MID";
  return "LOW";
}

function updateHeaderMeta(stage3: Stage3Case) {
  const pTrend = stage3.prediction.trend ?? [];
  const pDelta =
    pTrend.length >= 2 ? pTrend[pTrend.length - 1].p - pTrend[pTrend.length - 2].p : 0;
  const missingCount = computeMissingCount(stage3.metrics.dataQualityPct ?? 0);
  stage3.headerMeta = {
    next_reval_at: stage3.ops.nextCheckpointAt,
    next_contact_at: stage3.headerMeta?.next_contact_at ?? plusDaysYmd(2),
    next_program_at: stage3.headerMeta?.next_program_at ?? plusDaysYmd(10),
    tracking_cycle_days: mapTrackingCycleDays(stage3.risk.intensity),
    plan_status:
      missingCount > 0 || pDelta >= 0.05 ? "NEEDS_UPDATE" : stage3.status === "on_hold" ? "PAUSED" : "ACTIVE",
    churn_risk: deriveChurnRisk(stage3),
  };
}

function deriveOperationalStatus(stage3: Stage3Case): Stage3OperationalStatus {
  if (stage3.status === "completed") return "CLOSED";
  const churn = stage3.headerMeta.churn_risk;
  const reevalDue = daysUntil(stage3.headerMeta.next_reval_at);
  const hasPendingReevalAction = stage3.ops.recommended_actions.some(
    (item) => item.type === "SCHEDULE_REEVAL" && item.decision !== "APPROVED",
  );
  if (churn === "HIGH" || stage3.risk.zone === "danger") return "CHURN_RISK";
  if (reevalDue != null && reevalDue <= 3) return "REEVAL_DUE";
  if (hasPendingReevalAction) return "REEVAL_PENDING";
  if (stage3.referral.status !== "done") return "LINKAGE_PENDING";
  return "TRACKING";
}

function buildBaseCase(caseId: string): Stage3Case {
  const source = generateCases().find((item) => item.id === caseId) ?? generateCases()[0];
  const seed = seeded(caseId);
  const scoreZ = Number((-2.4 + (seed - 0.5) * 0.4).toFixed(1));
  const scoreChangePct = -15 + Math.round((seed - 0.5) * 4);
  const dataQualityPct = 95 - Math.round(seed * 3);
  const contactSuccessRatePct = 33 + Math.round(seed * 6);
  const contactFailStreak = 4 + Math.round(seed * 1);
  const zone = zoneFromScore(scoreChangePct, contactFailStreak);

  const base: Stage3Case = {
    caseId,
    stage: 3,
    subject: {
      maskedName: source.patientName,
      age: source.age,
      maskedPhone: maskPhone(source.phone),
      pseudonymKey: `PS-${caseId.slice(-4)}`,
    },
    owner: {
      name: source.counselor,
      role: "counselor",
    },
    status: zone === "danger" ? "attrition_risk" : "in_progress",
    operationalStatus: "TRACKING",
    headerMeta: {
      next_reval_at: plusDaysYmd(3),
      next_contact_at: plusDaysYmd(1),
      next_program_at: plusDaysYmd(10),
      plan_status: "ACTIVE",
      tracking_cycle_days: zone === "danger" ? 14 : 30,
      churn_risk: zone === "danger" ? "HIGH" : zone === "watch" ? "MID" : "LOW",
    },
    risk: {
      zone,
      intensity: zone === "danger" ? "biweekly" : "monthly",
      intensityReason: "운영 기준 신호(점수 변화/연락 실패)에 따라 추적 강도를 조정합니다.",
      triggers: [
        {
          key: "score_drop",
          label: "점수 하락",
          satisfied: scoreChangePct <= -10,
          currentValueText: `${Math.abs(scoreChangePct)}% 하락`,
          thresholdText: "10% 이상 하락",
          lastUpdatedAt: nowYmdHm(),
        },
        {
          key: "contact_fail",
          label: "연락 실패 누적",
          satisfied: contactFailStreak >= 3,
          currentValueText: `${contactFailStreak}회 연속 실패`,
          thresholdText: "3회 이상",
          lastUpdatedAt: nowYmdHm(),
        },
        {
          key: "missing_exam",
          label: "재평가 누락",
          satisfied: true,
          currentValueText: "다음 체크포인트 D-3",
          thresholdText: "D-7 이내 설정",
          lastUpdatedAt: nowYmdHm(),
        },
      ],
    },
    metrics: {
      scoreZ,
      scoreChangePct,
      dataQualityPct,
      contactSuccessRatePct,
      contactFailStreak,
      trendByQuarter: [
        { quarter: "24-Q1", value: -1.3 },
        { quarter: "24-Q2", value: -1.7 },
        { quarter: "24-Q3", value: -1.9 },
        { quarter: "24-Q4", value: -2.2 },
        { quarter: "25-Q1", value: -2.4 },
      ],
      threshold: -1.8,
    },
    prediction: estimatePrediction(scoreChangePct, contactFailStreak, zone, dataQualityPct),
    findings: {
      mriSummary: "참고 소견: 기억력 저하 추적 필요 신호가 있어 운영 기준상 재평가 우선순위를 높여 관리합니다.",
      notes: "의료진 확인 전 운영 참고용입니다.",
    },
    ops: {
      nextCheckpointAt: plusDaysYmd(3),
      lastContactAt: plusDaysYmd(-6),
      lastAssessmentAt: plusDaysYmd(-28),
      recommended_actions: [],
      recommendedActions: [],
    },
    audit: [
      {
        at: nowYmdHm(),
        actor: { name: "System", type: "system" },
        message: "Stage3 운영 화면 로딩 및 신호 계산이 완료되었습니다.",
        logId: "LOG-1200",
        severity: "info",
      },
      {
        at: `${plusDaysYmd(-1)} 10:20`,
        actor: { name: source.counselor, type: "human" },
        message: "담당자 확인 필요 항목으로 연락 실패 원인을 갱신했습니다.",
        logId: "LOG-1199",
        severity: "warn",
      },
    ],
    timeline: [
      {
        id: `${caseId}-tl-0`,
        at: nowYmdHm(),
        type: "STATUS",
        title: "Stage3 추적 상태 갱신",
        detail: "운영 기준 점검이 완료되었습니다.",
        actor: { name: "System", type: "system" },
      },
      {
        id: `${caseId}-tl-1`,
        at: `${plusDaysYmd(-1)} 10:20`,
        type: "CONTACT",
        title: "확인 연락 시도",
        detail: "연락 실패 원인 태그를 갱신했습니다.",
        actor: { name: source.counselor, type: "human" },
      },
    ],
    communication: {
      recommendedTimeSlot: "평일 14:00~16:00",
      history: [
        {
          id: `${caseId}-c0`,
          at: `${plusDaysYmd(-1)} 15:40`,
          channel: "call",
          result: "fail",
          reasonTag: "부재중",
          note: "응답 없음",
        },
        {
          id: `${caseId}-c1`,
          at: `${plusDaysYmd(-3)} 14:30`,
          channel: "call",
          result: "fail",
          reasonTag: "시간대부적절",
        },
        {
          id: `${caseId}-c2`,
          at: `${plusDaysYmd(-5)} 11:10`,
          channel: "sms",
          result: "fail",
          reasonTag: "수신거부",
        },
        {
          id: `${caseId}-c3`,
          at: `${plusDaysYmd(-7)} 15:00`,
          channel: "call",
          result: "fail",
          reasonTag: "보호자연락필요",
        },
        {
          id: `${caseId}-c4`,
          at: `${plusDaysYmd(-10)} 13:20`,
          channel: "call",
          result: "success",
          reasonTag: "부재중",
        },
      ],
    },
    referral: {
      organization: "강남구 협력 신경인지 클리닉",
      status: "in_progress",
      updatedAt: `${plusDaysYmd(-2)} 16:30`,
      ownerNote: "연계 일정 조율 중",
    },
  };

  updateHeaderMeta(base);
  refreshQueues(base);
  base.operationalStatus = deriveOperationalStatus(base);
  return base;
}

function ensureCase(caseId: string): Stage3Case {
  const existing = store.get(caseId);
  if (existing) return existing;
  const created = buildBaseCase(caseId);
  store.set(caseId, created);
  return created;
}

function appendAudit(
  stage3: Stage3Case,
  message: string,
  actor: Stage3Case["audit"][number]["actor"],
  severity: "info" | "warn" = "info",
): Stage3Case["audit"][number] {
  logCounter += 1;
  const entry: Stage3Case["audit"][number] = {
    at: nowYmdHm(),
    actor,
    message,
    logId: `LOG-${logCounter}`,
    severity,
  };
  stage3.audit.unshift(entry);
  return entry;
}

function appendTimeline(
  stage3: Stage3Case,
  type: Stage3TimelineEvent["type"],
  title: string,
  actor: Stage3TimelineEvent["actor"],
  detail?: string,
): Stage3TimelineEvent {
  const entry: Stage3TimelineEvent = {
    id: `${stage3.caseId}-tl-${Date.now()}`,
    at: nowYmdHm(),
    type,
    title,
    detail,
    actor,
  };
  stage3.timeline.unshift(entry);
  return entry;
}

function refreshQueues(stage3: Stage3Case) {
  stage3.ops.recommendedActions = buildRecommendedActions(stage3);
  stage3.ops.recommended_actions = buildStage3RecommendedActionQueue(stage3);
}

function normalizeStage3Case(stage3: Stage3Case): Stage3Case {
  const next = clone(stage3);
  if (!next.prediction) {
    next.prediction = estimatePrediction(
      next.metrics.scoreChangePct ?? 0,
      next.metrics.contactFailStreak ?? 0,
      next.risk.zone,
      next.metrics.dataQualityPct ?? 90,
    );
  }
  if (!next.timeline) {
    next.timeline = [];
  }
  if (!next.headerMeta) {
    next.headerMeta = {
      next_reval_at: next.ops.nextCheckpointAt,
      next_contact_at: next.ops.lastContactAt,
      next_program_at: undefined,
      plan_status: "ACTIVE",
      tracking_cycle_days: mapTrackingCycleDays(next.risk.intensity),
      churn_risk: "MID",
    };
  }
  updateHeaderMeta(next);
  if (!next.ops.recommendedActions || next.ops.recommendedActions.length === 0) {
    next.ops.recommendedActions = buildRecommendedActions(next);
  }
  if (!next.ops.recommended_actions || next.ops.recommended_actions.length === 0) {
    next.ops.recommended_actions = buildStage3RecommendedActionQueue(next);
  }
  next.operationalStatus = deriveOperationalStatus(next);
  return next;
}

export async function getStage3Case(caseId: string): Promise<Stage3Case> {
  await delay();
  try {
    const remote = await tryFetch<Stage3Case>(`/api/cases/${caseId}`);
    return normalizeStage3Case(remote);
  } catch {
    return normalizeStage3Case(ensureCase(caseId));
  }
}

export async function executeStage3Action(
  caseId: string,
  body: ExecuteActionBody,
  actorName: string,
): Promise<ExecuteActionResult> {
  await delay();
  try {
    const remote = await tryFetch<ExecuteActionResult>(`/api/cases/${caseId}/actions/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return {
      updatedCase: normalizeStage3Case(remote.updatedCase),
      newAuditLog: remote.newAuditLog,
    };
  } catch {
    const current = ensureCase(caseId);
    const actor = { name: actorName, type: "human" as const };

    if (body.actionType === "create_reassessment") {
      current.ops.nextCheckpointAt = plusDaysYmd(14);
      current.ops.lastAssessmentAt = nowYmdHm().slice(0, 10);
      current.headerMeta.next_reval_at = current.ops.nextCheckpointAt;
      appendTimeline(current, "REEVAL_SCHEDULED", "재평가 예약 생성", actor, "다음 재평가 일정이 설정되었습니다.");
    } else if (body.actionType === "adjust_intensity") {
      current.risk.intensity = "biweekly";
      current.risk.intensityReason = "운영 기준상 신호가 누적되어 추적 강도를 상향했습니다.";
      appendTimeline(current, "PLAN_UPDATED", "추적 강도 조정", actor, "추적 주기를 조정했습니다.");
    } else if (body.actionType === "strengthen_referral") {
      current.referral.status = "done";
      current.referral.updatedAt = nowYmdHm();
      current.referral.ownerNote = "연계 일정 조율 완료 후 후속 안내 준비";
      appendTimeline(current, "LINKAGE_COMPLETED", "연계 완료", actor, "연계 진행 상태를 완료로 반영했습니다.");
    } else if (body.actionType === "retry_contact") {
      const oldRate = current.metrics.contactSuccessRatePct ?? 0;
      current.metrics.contactSuccessRatePct = Math.min(100, oldRate + 12);
      current.metrics.contactFailStreak = Math.max(0, (current.metrics.contactFailStreak ?? 0) - 2);
      current.headerMeta.next_contact_at = plusDaysYmd(7);
      current.communication.history.unshift({
        id: `${caseId}-c-${Date.now()}`,
        at: nowYmdHm(),
        channel: "call",
        result: "success",
        reasonTag: "부재중",
        note: "재시도 연결 성공",
      });
      appendTimeline(current, "CONTACT", "확인 연락 실행", actor, "확인 연락 시도 결과를 기록했습니다.");
    } else if (body.actionType === "request_data_completion") {
      current.metrics.dataQualityPct = Math.min(100, (current.metrics.dataQualityPct ?? 90) + 6);
      current.risk.triggers = current.risk.triggers.map((trigger) =>
        trigger.key === "missing_exam"
          ? {
              ...trigger,
              satisfied: false,
              currentValueText: "누락 보강 요청 기록됨",
              lastUpdatedAt: nowYmdHm(),
            }
          : trigger,
      );
      appendTimeline(current, "STATUS", "데이터 보완 요청", actor, "누락 보완 요청을 기록했습니다.");
    } else if (body.actionType === "request_support") {
      current.status = "on_hold";
      appendTimeline(current, "STATUS", "운영 지원 요청", actor, "운영 지원 요청이 등록되었습니다.");
    }

    current.risk.zone = zoneFromScore(current.metrics.scoreChangePct ?? 0, current.metrics.contactFailStreak ?? 0);
    refreshPrediction(current);
    current.status = current.risk.zone === "danger" ? "attrition_risk" : current.status === "on_hold" ? "on_hold" : "in_progress";
    updateHeaderMeta(current);
    refreshQueues(current);
    current.operationalStatus = deriveOperationalStatus(current);

    const newAuditLog = appendAudit(
      current,
      `운영 액션 실행: ${body.actionType} · 감사 로그 기록됨`,
      actor,
      body.actionType === "request_support" ? "warn" : "info",
    );

    store.set(caseId, current);
    return {
      updatedCase: clone(current),
      newAuditLog: clone(newAuditLog),
    };
  }
}

export async function requestStage3Support(
  caseId: string,
  body: SupportRequestBody,
): Promise<SupportRequestResult> {
  await delay();
  try {
    const remote = await tryFetch<SupportRequestResult>(`/api/cases/${caseId}/support-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return {
      updatedCase: normalizeStage3Case(remote.updatedCase),
      newAuditLog: remote.newAuditLog,
    };
  } catch {
    const current = ensureCase(caseId);
    current.status = "on_hold";
    const newAuditLog = appendAudit(
      current,
      `운영 지원 요청: ${body.reason} · 요청자 ${body.requester}`,
      { name: body.requester, type: "human" },
      "warn",
    );
    appendTimeline(
      current,
      "STATUS",
      "운영 지원 요청",
      { name: body.requester, type: "human" },
      body.reason,
    );
    updateHeaderMeta(current);
    refreshQueues(current);
    current.operationalStatus = deriveOperationalStatus(current);
    store.set(caseId, current);
    return {
      updatedCase: clone(current),
      newAuditLog: clone(newAuditLog),
    };
  }
}

export function __test__resetStage3Store() {
  store.clear();
  logCounter = 1200;
}
