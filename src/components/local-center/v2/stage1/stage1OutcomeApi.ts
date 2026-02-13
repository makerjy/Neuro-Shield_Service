import type {
  CalendarEventCreatePayload,
  CalendarEventCreateResponse,
  CalendarEventDraft,
  OutcomeSavePayload,
  OutcomeSaveResponse,
  OutcomeType,
  RejectReasonCode,
  RecontactStrategy,
} from "./stage1Types";

type CalendarDraftInput = {
  caseId: string;
  outcomeType: OutcomeType;
  memo?: string;
  reject?: OutcomeSavePayload["reject"];
  noResponse?: OutcomeSavePayload["noResponse"];
};

type RemoteFetchConfig = RequestInit & {
  body?: string;
};

const mockCalendarStore = new Map<string, CalendarEventCreateResponse>();
let mockOutcomeCounter = 1;
let mockCalendarCounter = 1;

function nowIso() {
  return new Date().toISOString();
}

function withHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function shouldUseRemoteApi() {
  return (globalThis as any)?.__NEURO_SHIELD_USE_REAL_API__ === true;
}

function shouldForceCalendarFailure() {
  return (globalThis as any)?.__NEURO_SHIELD_FORCE_CALENDAR_ERROR__ === true;
}

async function sleep(ms = 160) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson<T>(url: string, config: RemoteFetchConfig): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(config.headers ?? {}) },
    ...config,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function rejectReasonLabel(code?: RejectReasonCode) {
  const labels: Record<RejectReasonCode, string> = {
    R1_SELF_REJECT: "본인 거부",
    R2_GUARDIAN_REJECT: "보호자 거부",
    R3_OTHER_INSTITUTION: "타 기관 이용",
    R4_ALREADY_DIAGNOSED: "이미 진단/관리 중",
    R5_CONTACT_INVALID: "연락처 오류",
    R6_EMOTIONAL_BACKLASH: "감정 반응 우려",
    R7_OTHER: "기타",
  };
  return code ? labels[code] : "거부 사유 확인";
}

function recontactStrategyLabel(strategy: RecontactStrategy) {
  const labels: Record<RecontactStrategy, string> = {
    CALL_RETRY: "전화 재접촉",
    SMS_RETRY: "문자 재안내",
    TIME_CHANGE: "시간대 변경 후 재접촉",
    PROTECTOR_CONTACT: "보호자 우선 연락",
    AGENT_SMS: "안내 문자 재발송",
  };
  return labels[strategy];
}

export function buildCalendarDraftFromOutcome(input: CalendarDraftInput): CalendarEventDraft[] {
  const events: CalendarEventDraft[] = [];

  if (input.outcomeType === "NO_RESPONSE" && input.noResponse?.nextContactAt) {
    events.push({
      caseId: input.caseId,
      type: "RECONTACT",
      title: `${recontactStrategyLabel(input.noResponse.strategy)} 일정`,
      startAt: input.noResponse.nextContactAt,
      durationMin: 20,
      priority: input.noResponse.escalateLevel === "L3" ? "HIGH" : "NORMAL",
      payload: {
        strategy: input.noResponse.strategy,
        escalateLevel: input.noResponse.escalateLevel,
      },
    });
  }

  if (input.outcomeType === "LATER") {
    const startAt = input.noResponse?.nextContactAt ?? withHoursFromNow(72);
    events.push({
      caseId: input.caseId,
      type: "RECONTACT",
      title: "나중에 재안내 일정",
      startAt,
      durationMin: 20,
      priority: "NORMAL",
      payload: {
        memo: input.memo,
      },
    });
  }

  if (input.outcomeType === "REJECT") {
    const shouldCreateFollowup = Boolean(input.reject?.followup?.createFollowupEvent || input.reject?.followup?.followupAt);
    if (shouldCreateFollowup) {
      events.push({
        caseId: input.caseId,
        type: "FOLLOWUP",
        title: `거부 후속 확인 (${rejectReasonLabel(input.reject?.code)})`,
        startAt: input.reject?.followup?.followupAt ?? withHoursFromNow(168),
        durationMin: 20,
        priority: input.reject?.level === "FINAL" ? "HIGH" : "NORMAL",
        payload: {
          rejectCode: input.reject?.code,
          rejectLevel: input.reject?.level,
        },
      });
    }
  }

  return events;
}

export async function saveStage1Outcome(caseId: string, payload: OutcomeSavePayload): Promise<OutcomeSaveResponse> {
  await sleep();

  if (shouldUseRemoteApi()) {
    return postJson<OutcomeSaveResponse>(`/api/cases/${caseId}/outcomes`, {
      body: JSON.stringify(payload),
    });
  }

  const outcomeId = `OUT-${caseId}-${String(mockOutcomeCounter).padStart(5, "0")}`;
  mockOutcomeCounter += 1;

  const events = buildCalendarDraftFromOutcome({
    caseId,
    outcomeType: payload.outcomeType,
    memo: payload.memo,
    reject: payload.reject,
    noResponse: payload.noResponse,
  });

  return {
    ok: true,
    outcomeId,
    timelinePatch: {
      at: nowIso(),
      outcomeType: payload.outcomeType,
    },
    nextAction: events.length
      ? {
          type: "CREATE_CALENDAR_EVENT",
          events,
        }
      : undefined,
  };
}

export async function createStage1CalendarEvent(
  payload: CalendarEventCreatePayload
): Promise<CalendarEventCreateResponse> {
  await sleep();

  if (shouldUseRemoteApi()) {
    return postJson<CalendarEventCreateResponse>("/api/calendar/events", {
      body: JSON.stringify(payload),
    });
  }

  if (shouldForceCalendarFailure()) {
    throw new Error("CALENDAR_FORCED_FAILURE");
  }

  const existing = mockCalendarStore.get(payload.idempotencyKey);
  if (existing) {
    return existing;
  }

  const response: CalendarEventCreateResponse = {
    ok: true,
    eventId: `CAL-${String(mockCalendarCounter).padStart(6, "0")}`,
  };
  mockCalendarCounter += 1;
  mockCalendarStore.set(payload.idempotencyKey, response);
  return response;
}

