/**
 * SMS 발송 공통 서비스
 * - 신규 계약: /api/sms/messages 우선 호출
 * - 레거시 계약: /api/outreach/send-sms fallback
 * - 데모 모드: 환경변수(TEST_SMS_TO)에 지정된 번호로 발송
 */

import type {
  SmsLifecycleStatus,
  SmsStage,
  SmsTemplateType,
} from "../../../features/sms/templateRegistry";

/** SMS 발송 요청 파라미터 */
export interface SmsSendRequest {
  /** 케이스 ID */
  caseId: string;
  /** 센터 ID */
  centerId: string;
  /** 수신자 전화번호 (데모에서는 TEST_SMS_TO로 자동 대체) */
  citizenPhone: string;
  /** 템플릿 ID */
  templateId: string;
  /** 렌더링된 최종 메시지 본문 */
  renderedMessage: string;
  /** 중복 발송 방지 키 (선택) */
  dedupeKey?: string;
  /** 보호자 전화번호 (선택) */
  guardianPhone?: string;
  /** 운영 Stage (선택) */
  stage?: SmsStage;
  /** 템플릿 변수 맵 */
  variables?: Record<string, string>;
  /** 발송 정책 */
  sendPolicy?: "NOW" | "SCHEDULE";
  /** 예약 발송 시점 */
  scheduledAt?: string;
  /** 메시지 채널 */
  channel?: "SMS";
  /** 링크 토큰 (없으면 프론트에서 임시 생성) */
  linkToken?: string;
  /** 링크 URL (없으면 linkToken으로 자동 생성) */
  linkUrl?: string;
  /** 상태 힌트 */
  statusHint?: SmsLifecycleStatus;
}

/** SMS 발송 결과 */
export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  status?: string;
  lifecycleStatus?: SmsLifecycleStatus;
  actualTo?: string;
  intendedTo?: string;
  renderedMessage?: string;
  renderedText?: string;
  token?: string;
  linkUrl?: string;
  endpoint?: string;
  error?: string;
}

const SMS_API_ENDPOINT_V2 = "/api/sms/messages";
const SMS_API_ENDPOINT_LEGACY = "/api/outreach/send-sms";

function normalizeBasePath(path: string): string {
  if (!path || !path.trim()) return "/neuro-shield/";
  let normalized = path.trim();
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (!normalized.endsWith("/")) normalized = `${normalized}/`;
  return normalized;
}

export function resolvePublicBaseUrl(): string {
  const envAny = import.meta.env as Record<string, string | undefined>;
  const preferred = envAny.VITE_PUBLIC_BASE_URL || envAny.DEPLOY_BASE_URL;
  if (preferred && preferred.trim()) {
    return preferred.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const basePath = normalizeBasePath(envAny.VITE_BASE_PATH || envAny.BASE_PATH || "/neuro-shield/");
    return `${window.location.origin}${basePath.replace(/\/$/, "")}`;
  }

  return "http://146.56.162.226/neuro-shield";
}

export function buildSmsLandingLink(token: string): string {
  const base = resolvePublicBaseUrl();
  return `${base}/p/sms?t=${encodeURIComponent(token)}`;
}

export function createClientSmsToken(caseId: string): string {
  const safeCase = (caseId || "case").replace(/[^a-zA-Z0-9_-]/g, "").slice(-18) || "case";
  return `tmp-${safeCase}-${Date.now().toString(36)}`;
}

function normalizeLifecycleStatus(
  rawStatus?: string,
  fallback: SmsLifecycleStatus = "SENT",
): SmsLifecycleStatus {
  if (!rawStatus) return fallback;
  const normalized = rawStatus.toUpperCase();
  if (normalized.includes("FAIL")) return "FAILED";
  if (normalized.includes("DELIVER")) return "DELIVERED";
  if (normalized.includes("SCHEDULE")) return "SCHEDULED";
  if (normalized.includes("CLICK")) return "CLICKED";
  if (normalized.includes("OPT")) return "OPTOUT";
  return fallback;
}

function buildLegacyPayload(request: SmsSendRequest, linkUrl: string) {
  return {
    case_id: request.caseId,
    center_id: request.centerId,
    citizen_phone: request.citizenPhone,
    template_id: request.templateId,
    variables: {
      template: request.renderedMessage,
      link_url: linkUrl,
      guideLink: linkUrl,
      ...(request.variables || {}),
    },
    dedupe_key: request.dedupeKey || `${request.caseId}-${Date.now()}`,
    guardian_phone: request.guardianPhone,
  };
}

function buildV2Payload(request: SmsSendRequest, linkUrl: string, token: string) {
  return {
    caseId: request.caseId,
    centerId: request.centerId,
    citizenPhone: request.citizenPhone,
    stage: request.stage || "STAGE1",
    templateId: request.templateId,
    variables: {
      LINK: linkUrl,
      ...(request.variables || {}),
    },
    sendPolicy: request.sendPolicy === "SCHEDULE" ? "SCHEDULED" : "IMMEDIATE",
    scheduledAt: request.scheduledAt,
    channel: request.channel || "SMS",
    renderedText: request.renderedMessage,
    dedupeKey: request.dedupeKey || `${request.caseId}-${Date.now()}`,
    guardianPhone: request.guardianPhone,
    token,
    statusHint: request.statusHint,
  };
}

function ensureLinkInMessage(message: string, linkUrl: string): string {
  if (message.includes(linkUrl)) return message;
  return `${message} ${linkUrl}`.trim();
}

type V2Response = {
  messageId?: string;
  providerMessageId?: string;
  status?: string;
  renderedText?: string;
  renderedMessage?: string;
  token?: string;
  linkUrl?: string;
  actualTo?: string;
  intendedTo?: string;
};

async function sendViaV2(
  request: SmsSendRequest,
  linkUrl: string,
  token: string,
): Promise<SmsSendResult> {
  const response = await fetch(SMS_API_ENDPOINT_V2, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildV2Payload(request, linkUrl, token)),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      endpoint: SMS_API_ENDPOINT_V2,
      error: `서버 오류 (${response.status}): ${errorText}`,
    };
  }

  const data = (await response.json()) as V2Response;
  const lifecycleStatus = normalizeLifecycleStatus(
    data.status,
    request.sendPolicy === "SCHEDULE" ? "SCHEDULED" : "SENT",
  );

  return {
    success: true,
    endpoint: SMS_API_ENDPOINT_V2,
    providerMessageId: data.providerMessageId || data.messageId,
    status: data.status || lifecycleStatus,
    lifecycleStatus,
    renderedText: data.renderedText || data.renderedMessage || request.renderedMessage,
    renderedMessage: data.renderedMessage || data.renderedText || request.renderedMessage,
    token: data.token || token,
    linkUrl: data.linkUrl || linkUrl,
    actualTo: data.actualTo,
    intendedTo: data.intendedTo,
  };
}

type LegacyResponse = {
  provider_message_id?: string;
  status?: string;
  actual_to?: string;
  intended_to?: string;
  rendered_message?: string;
};

async function sendViaLegacy(request: SmsSendRequest, linkUrl: string): Promise<SmsSendResult> {
  const response = await fetch(SMS_API_ENDPOINT_LEGACY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildLegacyPayload(request, linkUrl)),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      endpoint: SMS_API_ENDPOINT_LEGACY,
      error: `서버 오류 (${response.status}): ${errorText}`,
    };
  }

  const data = (await response.json()) as LegacyResponse;
  const lifecycleStatus = normalizeLifecycleStatus(
    data.status,
    request.sendPolicy === "SCHEDULE" ? "SCHEDULED" : "SENT",
  );

  return {
    success: true,
    endpoint: SMS_API_ENDPOINT_LEGACY,
    providerMessageId: data.provider_message_id,
    status: data.status || lifecycleStatus,
    lifecycleStatus,
    actualTo: data.actual_to,
    intendedTo: data.intended_to,
    renderedMessage: data.rendered_message || ensureLinkInMessage(request.renderedMessage, linkUrl),
    renderedText: data.rendered_message || ensureLinkInMessage(request.renderedMessage, linkUrl),
    token: request.linkToken,
    linkUrl,
  };
}

export function resolveSmsTemplateTypeById(templateId: string): SmsTemplateType {
  if (templateId.includes("BOOKING")) return "BOOKING";
  if (templateId.includes("REMINDER")) return "REMINDER";
  return "CONTACT";
}

export function resolveSmsLifecycleByResult(
  success: boolean,
  mode: "NOW" | "SCHEDULE",
): SmsLifecycleStatus {
  if (!success) return "FAILED";
  if (mode === "SCHEDULE") return "SCHEDULED";
  return "SENT";
}

export function toDispatchStatus(status: SmsLifecycleStatus): SmsHistoryItem["status"] {
  if (status === "SCHEDULED") return "SCHEDULED";
  if (status === "FAILED") return "FAILED";
  if (status === "DELIVERED") return "DELIVERED";
  if (status === "CLICKED") return "CLICKED";
  if (status === "ACTION_COMPLETED") return "ACTION_COMPLETED";
  if (status === "NO_RESPONSE") return "NO_RESPONSE";
  if (status === "OPTOUT") return "OPTOUT";
  return "SENT";
}

export function getDefaultSmsLandingLink(): string {
  return buildSmsLandingLink(createClientSmsToken("preview"));
}

/**
 * 실제 SMS 발송 API 호출
 */
export async function sendSmsApi(request: SmsSendRequest): Promise<SmsSendResult> {
  const token = request.linkToken || createClientSmsToken(request.caseId);
  const linkUrl = request.linkUrl || buildSmsLandingLink(token);

  try {
    const v2Result = await sendViaV2(request, linkUrl, token);
    if (v2Result.success) {
      return v2Result;
    }
    console.warn(`[SMS] ${SMS_API_ENDPOINT_V2} 실패, legacy fallback 사용:`, v2Result.error);

    const legacyResult = await sendViaLegacy(request, linkUrl);
    if (legacyResult.success) {
      return legacyResult;
    }

    return {
      success: false,
      endpoint: legacyResult.endpoint,
      error: legacyResult.error || v2Result.error || "문자 발송 실패",
      token,
      linkUrl,
    };
  } catch (err) {
    console.warn(`[SMS] ${SMS_API_ENDPOINT_V2}/${SMS_API_ENDPOINT_LEGACY} 연결 실패:`, err);
    return {
      success: false,
      token,
      linkUrl,
      error: "SMS 서비스에 연결할 수 없습니다. 네트워크를 확인하세요.",
    };
  }
}

/** 발송 이력 아이템 */
export interface SmsHistoryItem {
  id: string;
  at: string;
  templateLabel: string;
  type: SmsTemplateType;
  mode: "NOW" | "SCHEDULE";
  recipient: "본인" | "보호자";
  status:
    | "SENT"
    | "SCHEDULED"
    | "FAILED"
    | "DELIVERED"
    | "CLICKED"
    | "ACTION_COMPLETED"
    | "NO_RESPONSE"
    | "OPTOUT";
  preview: string;
  note: string;
  providerMessageId?: string;
  lifecycleStatus?: SmsLifecycleStatus;
  linkUrl?: string;
  token?: string;
}

/** 현재 시간 포맷 */
export function nowFormatted(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
