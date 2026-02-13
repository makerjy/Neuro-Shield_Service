import { generateCases, maskPhone } from "../caseData";
import { buildRecommendedActions } from "./stage3ActionRules";
import type {
  ExecuteActionBody,
  ExecuteActionResult,
  Stage3Case,
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

function zoneFromScore(scoreChangePct: number, failStreak: number): Stage3Case["risk"]["zone"] {
  if (scoreChangePct <= -10 || failStreak >= 4) return "danger";
  if (scoreChangePct <= -5 || failStreak >= 2) return "watch";
  return "stable";
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
    findings: {
      mriSummary: "참고 소견: 기억력 저하 추적 필요 신호가 있어 운영 기준상 재평가 우선순위를 높여 관리합니다.",
      notes: "의료진 확인 전 운영 참고용입니다.",
    },
    ops: {
      nextCheckpointAt: plusDaysYmd(3),
      lastContactAt: plusDaysYmd(-6),
      lastAssessmentAt: plusDaysYmd(-28),
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

  base.ops.recommendedActions = buildRecommendedActions(base);
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

function refreshRecommendedActions(stage3: Stage3Case) {
  stage3.ops.recommendedActions = buildRecommendedActions(stage3);
}

export async function getStage3Case(caseId: string): Promise<Stage3Case> {
  await delay();
  try {
    return await tryFetch<Stage3Case>(`/api/cases/${caseId}`);
  } catch {
    return clone(ensureCase(caseId));
  }
}

export async function executeStage3Action(
  caseId: string,
  body: ExecuteActionBody,
  actorName: string,
): Promise<ExecuteActionResult> {
  await delay();
  try {
    return await tryFetch<ExecuteActionResult>(`/api/cases/${caseId}/actions/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    const current = ensureCase(caseId);
    const actor = { name: actorName, type: "human" as const };

    if (body.actionType === "create_reassessment") {
      current.ops.nextCheckpointAt = plusDaysYmd(14);
      current.ops.lastAssessmentAt = nowYmdHm().slice(0, 10);
    } else if (body.actionType === "adjust_intensity") {
      current.risk.intensity = "biweekly";
      current.risk.intensityReason = "운영 기준상 신호가 누적되어 추적 강도를 상향했습니다.";
    } else if (body.actionType === "strengthen_referral") {
      current.referral.status = "done";
      current.referral.updatedAt = nowYmdHm();
      current.referral.ownerNote = "연계 일정 조율 완료 후 후속 안내 준비";
    } else if (body.actionType === "retry_contact") {
      const oldRate = current.metrics.contactSuccessRatePct ?? 0;
      current.metrics.contactSuccessRatePct = Math.min(100, oldRate + 12);
      current.metrics.contactFailStreak = Math.max(0, (current.metrics.contactFailStreak ?? 0) - 2);
      current.communication.history.unshift({
        id: `${caseId}-c-${Date.now()}`,
        at: nowYmdHm(),
        channel: "call",
        result: "success",
        reasonTag: "부재중",
        note: "재시도 연결 성공",
      });
    } else if (body.actionType === "request_support") {
      current.status = "on_hold";
    }

    current.risk.zone = zoneFromScore(current.metrics.scoreChangePct ?? 0, current.metrics.contactFailStreak ?? 0);
    current.status = current.risk.zone === "danger" ? "attrition_risk" : current.status === "on_hold" ? "on_hold" : "in_progress";
    refreshRecommendedActions(current);

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
    return await tryFetch<SupportRequestResult>(`/api/cases/${caseId}/support-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    const current = ensureCase(caseId);
    current.status = "on_hold";
    const newAuditLog = appendAudit(
      current,
      `운영 지원 요청: ${body.reason} · 요청자 ${body.requester}`,
      { name: body.requester, type: "human" },
      "warn",
    );
    refreshRecommendedActions(current);
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
