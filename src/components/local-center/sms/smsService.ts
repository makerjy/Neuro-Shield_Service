/**
 * SMS 발송 공통 서비스
 * - citizen_sms_service의 /api/outreach/send-sms 엔드포인트 호출
 * - 데모 모드: 환경변수(TEST_SMS_TO)에 지정된 번호로 발송
 * - 실패 시에도 로컬 감사 로그 기록
 */

/** SMS 발송 요청 파라미터 */
export interface SmsSendRequest {
  /** 케이스 ID */
  caseId: string;
  /** 센터 ID */
  centerId: string;
  /** 수신자 전화번호 (데모에서는 TEST_SMS_TO로 자동 대체) */
  citizenPhone: string;
  /** 템플릿 ID (자유형이면 'custom') */
  templateId: string;
  /** 렌더링된 최종 메시지 본문 */
  renderedMessage: string;
  /** 중복 발송 방지 키 (선택) */
  dedupeKey?: string;
  /** 보호자 전화번호 (선택) */
  guardianPhone?: string;
}

/** SMS 발송 결과 */
export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  status?: string;
  actualTo?: string;
  intendedTo?: string;
  renderedMessage?: string;
  error?: string;
}

/**
 * SMS 발송 엔드포인트 URL
 * nginx가 /api/outreach/ → sms:4120으로 프록시
 */
const SMS_API_ENDPOINT = "/api/outreach/send-sms";

/** 시민 화면 링크 (배포 환경 자동 감지) */
function getCitizenLink(): string {
  const base = window.location.origin;
  const basePath = import.meta.env.VITE_BASE_PATH || "/neuro-shield/";
  return `${base}${basePath.replace(/\/$/, "")}/#citizen`;
}

/**
 * 실제 SMS 발송 API 호출
 */
export async function sendSmsApi(request: SmsSendRequest): Promise<SmsSendResult> {
  const citizenLink = getCitizenLink();

  const payload = {
    case_id: request.caseId,
    center_id: request.centerId,
    citizen_phone: request.citizenPhone,
    template_id: request.templateId,
    variables: {
      template: request.renderedMessage,
      link_url: citizenLink,
      guideLink: citizenLink,
    },
    dedupe_key: request.dedupeKey || `${request.caseId}-${Date.now()}`,
    guardian_phone: request.guardianPhone,
  };

  try {
    const response = await fetch(SMS_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[SMS] ${SMS_API_ENDPOINT} → ${response.status}:`, errorText);
      return {
        success: false,
        error: `서버 오류 (${response.status}): ${errorText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      providerMessageId: data.provider_message_id,
      status: data.status,
      actualTo: data.actual_to,
      intendedTo: data.intended_to,
      renderedMessage: data.rendered_message,
    };
  } catch (err) {
    console.warn(`[SMS] ${SMS_API_ENDPOINT} 연결 실패:`, err);
    return {
      success: false,
      error: "SMS 서비스에 연결할 수 없습니다. 네트워크를 확인하세요.",
    };
  }
}

/** 발송 이력 아이템 */
export interface SmsHistoryItem {
  id: string;
  at: string;
  templateLabel: string;
  type: "CONTACT" | "BOOKING" | "REMINDER";
  mode: "NOW" | "SCHEDULE";
  recipient: "본인" | "보호자";
  status: "SENT" | "SCHEDULED" | "FAILED";
  preview: string;
  note: string;
  providerMessageId?: string;
}

/** 현재 시간 포맷 */
export function nowFormatted(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
