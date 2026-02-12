import { getCaseRecordById, maskName, maskPhone } from "../caseRecords";
import type {
  CaseDetailResponse,
  OpsActionKey,
  OpsRecommendationResponse,
  RunActionResult,
} from "./apiContracts";
import { buildOpsRecommendations } from "./recommendationEngine";

const LATENCY_MS = 180;

const store = new Map<string, CaseDetailResponse>();

const idCounters = {
  log: 1000,
};

function seeded(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

function plusHours(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function nowKstString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nextLogId() {
  idCounters.log += 1;
  return `LOG-${idCounters.log}`;
}

function makeBaseCase(caseId: string): CaseDetailResponse {
  const source = getCaseRecordById(caseId);
  const stage = source?.stage ?? "Stage 2";
  const stageCode: CaseDetailResponse["stage"] = stage === "Stage 1" ? "1" : stage === "Stage 2" ? "2" : "3";
  const risk = source?.risk ?? "중";
  const riskSignal: CaseDetailResponse["stage1"]["signalLevel"] = risk === "고" ? "위험" : risk === "중" ? "주의" : "양호";
  const random = seeded(caseId);
  const cistScore = 16 + Math.floor(random * 11);
  const missingCount = source?.quality === "경고" ? 2 : source?.quality === "주의" ? 1 : 0;
  const appointmentStatus: CaseDetailResponse["operations"]["appointment"]["status"] =
    source?.status === "완료" ? "확정" : source?.status === "대기" ? "요청" : "미정";

  return {
    caseId,
    stage: stageCode,
    assignee: { name: source?.manager ?? "김성실", role: "케이스 매니저" },
    status: (source?.status ?? "진행중") as CaseDetailResponse["status"],
    piiSummary: {
      maskedName: maskName(source?.profile.name ?? "대상자"),
      age: source?.profile.age ?? 74,
      maskedPhone: maskPhone(source?.profile.phone ?? "010-0000-0000"),
      anonymizationLevel: "Stage2+",
    },
    stage1: {
      cist: {
        date: "2026-01-15",
        score: cistScore,
        max: 30,
        reliability: missingCount > 1 ? "보통" : "양호",
      },
      signalLevel: riskSignal,
      retrigger: {
        enabled: Boolean(source?.alertTags.includes("재평가 필요") || source?.alertTags.includes("이탈 위험")),
        reason: source?.alertTags.includes("재평가 필요") ? "점수 하락 재확인" : source?.alertTags.includes("이탈 위험") ? "접촉 지연 반복" : undefined,
        lastChangedAt: source?.alertTags.length ? "2026-02-11 09:10" : undefined,
      },
    },
    stage2: {
      neuropsych_1: {
        name: "SNSB",
        date: "2026-02-10",
        summarySD: Number((-2.5 + random * 1.8).toFixed(1)),
        missingItems: {
          count: missingCount,
          items:
            missingCount === 0
              ? []
              : missingCount === 1
                ? ["시공간 구성"]
                : ["시공간 구성", "주의 전환"],
        },
        reliability: missingCount > 1 ? "보통" : "양호",
      },
      clinical_2: {
        date: source?.status === "완료" ? "2026-02-11" : undefined,
        completed: source?.status === "완료" || source?.status === "진행중",
        checklist: [
          { key: "adl", label: "일상 수행 변화", value: risk === "고" ? "주의" : "정상" },
          { key: "memory", label: "기억 관련 관찰", value: risk !== "저" ? "주의" : "정상" },
          { key: "family", label: "보호자 관찰 공유", value: source?.profile.guardianPhone ? "해당" : "미확인" },
          { key: "mood", label: "정서 변화", value: random > 0.7 ? "주의" : "정상" },
        ],
        note:
          source?.quality === "경고"
            ? "누락 항목 보완 전까지 임시 상태로 유지"
            : "운영 체크리스트 기준으로 후속 작업 가능",
        evaluator: { name: source?.manager ?? "김성실" },
      },
      mciSignal:
        source?.alertTags.includes("High MCI") || source?.alertTags.includes("MCI 미등록")
          ? "주의"
          : "양호",
    },
    operations: {
      nextAction: {
        key: "CREATE_REFERRAL",
        label: source?.action ?? "의뢰서 생성",
        dueAt: plusHours(6),
      },
      referral: {
        status: source?.status === "완료" ? "전송됨" : source?.status === "진행중" ? "생성됨" : "미생성",
        lastSentAt: source?.status === "완료" ? "2026-02-11 10:30" : undefined,
      },
      appointment: {
        status: appointmentStatus,
        hospital: source?.stage === "Stage 3" ? "강남구 협력병원" : undefined,
        at: source?.stage === "Stage 3" ? "2026-02-14 10:00" : undefined,
      },
    },
    timeline: [
      { key: "screening", label: "1차 선별검사", at: "2026-01-15", status: "done" },
      { key: "neuropsych", label: "2차 1단계 신경심리검사", at: "2026-02-10", status: "done" },
      {
        key: "clinical",
        label: "2차 2단계 임상 평가",
        at: source?.status === "완료" ? "2026-02-11" : undefined,
        status: source?.status === "완료" || source?.status === "진행중" ? "done" : "waiting",
      },
      {
        key: "referral",
        label: "의뢰 작업",
        at: source?.status === "완료" ? "2026-02-11 10:30" : undefined,
        status: source?.status === "완료" ? "done" : "waiting",
      },
      {
        key: "appointment",
        label: "예약 추적",
        at: source?.status === "완료" ? "2026-02-14 10:00" : undefined,
        status: source?.status === "완료" ? "done" : "unknown",
      },
      { key: "followup", label: "추적/종결", status: "unknown" },
    ],
    auditLogs: [
      { id: "LOG-900", at: "2026-02-10 16:20", actor: "System", message: "2차 단계 작업 큐가 생성되었습니다" },
      { id: "LOG-901", at: "2026-02-11 09:15", actor: source?.manager ?? "김성실", message: "운영 권고(참고) 검토 메모가 등록되었습니다" },
    ],
  };
}

function ensureCase(caseId: string): CaseDetailResponse {
  const existing = store.get(caseId);
  if (existing) return existing;
  const generated = makeBaseCase(caseId);
  store.set(caseId, generated);
  return generated;
}

function cloneCase<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function delay() {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

async function tryFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const useRemote = (globalThis as any)?.__NEURO_SHIELD_USE_REAL_API__ === true;
  if (!useRemote) {
    throw new Error("Remote API disabled");
  }
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function appendAudit(caseData: CaseDetailResponse, actor: string, message: string) {
  caseData.auditLogs.unshift({
    id: nextLogId(),
    at: nowKstString(),
    actor,
    message,
  });
}

function setTimeline(caseData: CaseDetailResponse, key: string, at: string, status: "done" | "waiting" | "unknown") {
  const target = caseData.timeline.find((item) => item.key === key);
  if (!target) return;
  target.status = status;
  target.at = at;
}

function applyActionLocally(caseData: CaseDetailResponse, actionKey: OpsActionKey, actor: string, reason?: string): RunActionResult {
  const now = nowKstString();

  if (actionKey === "CREATE_REFERRAL") {
    caseData.operations.referral.status = "생성됨";
    caseData.operations.nextAction = { key: "SEND_REFERRAL", label: "의뢰서 전송", dueAt: plusHours(2) };
    setTimeline(caseData, "referral", now, "waiting");
    appendAudit(caseData, actor, `의뢰서 생성 실행 (${reason || "사유 없음"})`);
    return { ok: true, actionKey, message: "의뢰서 생성 완료" };
  }

  if (actionKey === "SEND_REFERRAL") {
    caseData.operations.referral.status = "전송됨";
    caseData.operations.referral.lastSentAt = now;
    caseData.operations.nextAction = { key: "TRACK_APPOINTMENT", label: "예약 현황 추적", dueAt: plusHours(4) };
    setTimeline(caseData, "referral", now, "done");
    setTimeline(caseData, "appointment", now, "waiting");
    appendAudit(caseData, actor, `의뢰서 전송 실행 (${reason || "사유 없음"})`);
    return { ok: true, actionKey, message: "의뢰서 전송 완료" };
  }

  if (actionKey === "TRACK_APPOINTMENT") {
    const current = caseData.operations.appointment.status;
    if (current === "미정") {
      caseData.operations.appointment.status = "요청";
      caseData.operations.appointment.hospital = caseData.operations.appointment.hospital || "강남구 협력병원";
      caseData.operations.appointment.at = plusHours(48).slice(0, 16).replace("T", " ");
    } else if (current === "요청") {
      caseData.operations.appointment.status = "확정";
      caseData.operations.appointment.at = caseData.operations.appointment.at || plusHours(72).slice(0, 16).replace("T", " ");
      setTimeline(caseData, "appointment", now, "done");
    } else if (current === "취소") {
      caseData.operations.appointment.status = "요청";
    }

    appendAudit(caseData, actor, `예약 현황 추적 실행 (${reason || "사유 없음"})`);
    return { ok: true, actionKey, message: "예약 상태 갱신 완료" };
  }

  if (actionKey === "AUTHORIZE_VIEW") {
    appendAudit(caseData, actor, `권한자 열람 실행 (${reason || "사유 없음"})`);
    return { ok: true, actionKey, message: "권한자 열람이 기록되었습니다" };
  }

  if (actionKey === "REQUEST_SUPPORT") {
    appendAudit(caseData, actor, `운영 지원 요청 실행 (${reason || "사유 없음"})`);
    return { ok: true, actionKey, message: "운영 지원 요청이 기록되었습니다" };
  }

  appendAudit(caseData, actor, `상담 프로그램 연계 실행 (${reason || "사유 없음"})`);
  return { ok: true, actionKey, message: "상담 프로그램 연계가 기록되었습니다" };
}

export async function getCaseDetail(caseId: string): Promise<CaseDetailResponse> {
  await delay();
  try {
    return await tryFetch<CaseDetailResponse>(`/api/cases/${caseId}`);
  } catch {
    return cloneCase(ensureCase(caseId));
  }
}

export async function getOpsRecommendations(
  caseId: string,
  contextVersion?: string
): Promise<OpsRecommendationResponse> {
  await delay();
  try {
    return await tryFetch<OpsRecommendationResponse>(`/api/cases/${caseId}/ops-recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextVersion }),
    });
  } catch {
    const caseData = ensureCase(caseId);
    return buildOpsRecommendations(caseData);
  }
}

const ACTION_ENDPOINTS: Record<OpsActionKey, string> = {
  CREATE_REFERRAL: "create-referral",
  SEND_REFERRAL: "send-referral",
  TRACK_APPOINTMENT: "track-appointment",
  AUTHORIZE_VIEW: "authorize-view",
  REQUEST_SUPPORT: "request-support",
  LINK_COUNSELING: "link-counseling",
};

export async function runOpsAction(
  caseId: string,
  actionKey: OpsActionKey,
  actor: string,
  reason?: string
): Promise<RunActionResult> {
  await delay();

  try {
    await tryFetch(`/api/cases/${caseId}/actions/${ACTION_ENDPOINTS[actionKey]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    return {
      ok: true,
      actionKey,
      message: "원격 API 처리 완료",
    };
  } catch {
    const caseData = ensureCase(caseId);
    const result = applyActionLocally(caseData, actionKey, actor, reason);
    store.set(caseId, caseData);
    return result;
  }
}

export function __test__clearStore() {
  store.clear();
  idCounters.log = 1000;
}

export function __test__peekCase(caseId: string): CaseDetailResponse {
  return cloneCase(ensureCase(caseId));
}
