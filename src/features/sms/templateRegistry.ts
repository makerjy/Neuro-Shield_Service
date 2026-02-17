export type SmsStage = "STAGE1" | "STAGE2" | "STAGE3";
export type SmsChannel = "SMS";
export type SmsTone = "government";
export type SmsTemplateType = "CONTACT" | "BOOKING" | "REMINDER";

export type SmsSituation =
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "CLICKED"
  | "ACTION_COMPLETED"
  | "NO_RESPONSE";

export type SmsLifecycleStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "CLICKED"
  | "ACTION_COMPLETED"
  | "NO_RESPONSE"
  | "OPTOUT";

export interface SmsTemplateDefinition {
  id: string;
  stage: SmsStage;
  situation: SmsSituation;
  channel: SmsChannel;
  tone: SmsTone;
  type: SmsTemplateType;
  label: string;
  template: string;
}

export interface SmsTemplateVariables {
  CENTER_NAME: string;
  CALLBACK_PHONE: string;
  LINK: string;
  OPT_OUT: string;
  CASE_ALIAS: string;
  DUE_DATE: string;
  OPTOUT_NUMBER: string;
}

export interface SmsPanelTemplateVars {
  centerName: string;
  centerPhone: string;
  guideLink: string;
  bookingLink: string;
  caseAlias?: string;
  dueDate?: string;
  optOut?: string;
}

export interface SmsPanelTemplateLike {
  id: string;
  type: SmsTemplateType;
  label: string;
  body: (vars: SmsPanelTemplateVars) => string;
}

export interface SmsStatusMeta {
  label: string;
  tone: string;
}

export interface SmsRecommendedAction {
  id:
    | "RETRY_WITH_ALT_TEMPLATE"
    | "SWITCH_TO_CALL"
    | "VERIFY_PHONE"
    | "CREATE_RECONTACT_TASK"
    | "SEND_REMINDER"
    | "MARK_NO_RESPONSE"
    | "MARK_COMPLETED"
    | "MARK_OPTOUT";
  label: string;
  nextStatus?: SmsLifecycleStatus;
}

const DEFAULT_OPTOUT_NUMBER = "080-000-0000";
const DEFAULT_OPT_OUT = `수신거부 ${DEFAULT_OPTOUT_NUMBER}`;
const DEFAULT_CASE_ALIAS = "대상자";
const DEFAULT_DUE_DATE = "일정 확인 필요";

const SMS_TEMPLATE_REGISTRY: SmsTemplateDefinition[] = [
  {
    id: "S1_SENT_BASE",
    stage: "STAGE1",
    situation: "DELIVERED",
    channel: "SMS",
    tone: "government",
    type: "CONTACT",
    label: "1차 기본 안내",
    template:
      "[{{CENTER_NAME}}] 건강관리 지원 안내입니다. 대상자({{CASE_ALIAS}})께 필요한 절차를 간단히 확인하고 예약을 진행할 수 있습니다. {{LINK}} 문의 {{CALLBACK_PHONE}} {{OPT_OUT}}",
  },
  {
    id: "S1_NO_RESPONSE",
    stage: "STAGE1",
    situation: "NO_RESPONSE",
    channel: "SMS",
    tone: "government",
    type: "REMINDER",
    label: "1차 무응답 리마인드",
    template:
      "[{{CENTER_NAME}}] 안내 확인이 아직 어려우셨다면, 아래 링크에서 예약/절차 확인이 가능합니다. {{LINK}} 문의 {{CALLBACK_PHONE}} {{OPT_OUT}}",
  },
  {
    id: "S1_FAILED",
    stage: "STAGE1",
    situation: "FAILED",
    channel: "SMS",
    tone: "government",
    type: "CONTACT",
    label: "1차 발송 실패 안내",
    template:
      "[{{CENTER_NAME}}] 안내 문자 전달이 원활하지 않았습니다. 연락처 확인을 위해 {{CALLBACK_PHONE}}로 연락 부탁드립니다. {{OPT_OUT}}",
  },
  {
    id: "S2_SENT_BASE",
    stage: "STAGE2",
    situation: "DELIVERED",
    channel: "SMS",
    tone: "government",
    type: "BOOKING",
    label: "2차 다음 단계 허브 안내",
    template:
      "[{{CENTER_NAME}}] 검사/절차 진행을 위한 다음 단계 안내입니다. 아래 링크에서 일정 확인 및 필요한 절차를 진행할 수 있습니다. {{LINK}} 문의 {{CALLBACK_PHONE}} {{OPT_OUT}}",
  },
  {
    id: "S2_CLICKED_INCOMPLETE",
    stage: "STAGE2",
    situation: "CLICKED",
    channel: "SMS",
    tone: "government",
    type: "REMINDER",
    label: "2차 클릭 후 미완료",
    template:
      "[{{CENTER_NAME}}] 링크를 확인해 주셔서 감사합니다. 아직 절차가 완료되지 않아, 아래에서 이어서 진행할 수 있습니다. {{LINK}} 문의 {{CALLBACK_PHONE}} {{OPT_OUT}}",
  },
  {
    id: "S2_NO_RESPONSE",
    stage: "STAGE2",
    situation: "NO_RESPONSE",
    channel: "SMS",
    tone: "government",
    type: "REMINDER",
    label: "2차 무응답 리마인드",
    template:
      "[{{CENTER_NAME}}] 일정/절차 확인이 필요합니다. 가능하신 때 아래 링크에서 확인 부탁드립니다. {{LINK}} 문의 {{CALLBACK_PHONE}} {{OPT_OUT}}",
  },
  {
    id: "S3_SENT_BASE",
    stage: "STAGE3",
    situation: "DELIVERED",
    channel: "SMS",
    tone: "government",
    type: "CONTACT",
    label: "3차 추적관리 기본 안내",
    template:
      "[{{CENTER_NAME}}] 추후 관리와 관련된 다음 안내입니다. 필요한 일정/절차를 아래 링크에서 확인할 수 있습니다. {{LINK}} 문의 {{CALLBACK_PHONE}} {{OPT_OUT}}",
  },
  {
    id: "S3_ACTION_COMPLETED",
    stage: "STAGE3",
    situation: "ACTION_COMPLETED",
    channel: "SMS",
    tone: "government",
    type: "REMINDER",
    label: "3차 절차 완료 확인",
    template:
      "[{{CENTER_NAME}}] 안내된 절차 확인이 완료되었습니다. 추가 안내가 필요하면 {{CALLBACK_PHONE}}로 연락 부탁드립니다. {{OPT_OUT}}",
  },
  {
    id: "S3_NO_RESPONSE",
    stage: "STAGE3",
    situation: "NO_RESPONSE",
    channel: "SMS",
    tone: "government",
    type: "REMINDER",
    label: "3차 무응답 전화 전환",
    template:
      "[{{CENTER_NAME}}] 확인이 어려우실 수 있어 전화로 안내드릴 수 있습니다. {{CALLBACK_PHONE}}로 연락 주시거나, 아래 링크에서 확인 가능합니다. {{LINK}} {{OPT_OUT}}",
  },
];

export const SMS_STATUS_META: Record<SmsLifecycleStatus, SmsStatusMeta> = {
  DRAFT: { label: "작성중", tone: "border-slate-300 bg-slate-50 text-slate-700" },
  SCHEDULED: { label: "예약발송", tone: "border-blue-300 bg-blue-50 text-blue-700" },
  SENT: { label: "발송", tone: "border-indigo-300 bg-indigo-50 text-indigo-700" },
  DELIVERED: { label: "도착", tone: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  FAILED: { label: "실패", tone: "border-red-300 bg-red-50 text-red-700" },
  CLICKED: { label: "링크 클릭", tone: "border-cyan-300 bg-cyan-50 text-cyan-700" },
  ACTION_COMPLETED: { label: "절차 완료", tone: "border-green-300 bg-green-50 text-green-700" },
  NO_RESPONSE: { label: "무응답", tone: "border-amber-300 bg-amber-50 text-amber-700" },
  OPTOUT: { label: "수신거부", tone: "border-zinc-300 bg-zinc-100 text-zinc-700" },
};

export const SMS_RECOMMENDED_ACTIONS: Record<SmsLifecycleStatus, SmsRecommendedAction[]> = {
  DRAFT: [
    { id: "MARK_COMPLETED", label: "완료 처리", nextStatus: "ACTION_COMPLETED" },
    { id: "MARK_OPTOUT", label: "수신거부 처리", nextStatus: "OPTOUT" },
  ],
  SCHEDULED: [
    { id: "MARK_NO_RESPONSE", label: "무응답 처리", nextStatus: "NO_RESPONSE" },
    { id: "SWITCH_TO_CALL", label: "전화 전환" },
  ],
  SENT: [
    { id: "SEND_REMINDER", label: "리마인드 발송", nextStatus: "CLICKED" },
    { id: "MARK_NO_RESPONSE", label: "무응답 처리", nextStatus: "NO_RESPONSE" },
  ],
  DELIVERED: [
    { id: "SEND_REMINDER", label: "리마인드 발송", nextStatus: "CLICKED" },
    { id: "MARK_COMPLETED", label: "완료 처리", nextStatus: "ACTION_COMPLETED" },
  ],
  FAILED: [
    { id: "VERIFY_PHONE", label: "번호 확인" },
    { id: "SWITCH_TO_CALL", label: "전화 전환" },
  ],
  CLICKED: [
    { id: "SEND_REMINDER", label: "리마인드 발송" },
    { id: "MARK_COMPLETED", label: "완료 처리", nextStatus: "ACTION_COMPLETED" },
  ],
  ACTION_COMPLETED: [
    { id: "CREATE_RECONTACT_TASK", label: "후속 업무 생성" },
    { id: "MARK_OPTOUT", label: "수신거부 처리", nextStatus: "OPTOUT" },
  ],
  NO_RESPONSE: [
    { id: "RETRY_WITH_ALT_TEMPLATE", label: "재발송(다른 템플릿)" },
    { id: "SWITCH_TO_CALL", label: "전화 전환" },
  ],
  OPTOUT: [
    { id: "SWITCH_TO_CALL", label: "대체 채널 안내" },
    { id: "CREATE_RECONTACT_TASK", label: "내부 확인 업무 생성" },
  ],
};

function normalizeTemplateVariables(
  variables: Partial<SmsTemplateVariables> = {},
): SmsTemplateVariables {
  const optOutNumber = variables.OPTOUT_NUMBER?.trim() || DEFAULT_OPTOUT_NUMBER;
  return {
    CENTER_NAME: variables.CENTER_NAME || "강남구 치매안심센터",
    CALLBACK_PHONE: variables.CALLBACK_PHONE || "02-555-0199",
    LINK: variables.LINK || "",
    OPT_OUT: variables.OPT_OUT || `수신거부 ${optOutNumber}`,
    CASE_ALIAS: variables.CASE_ALIAS || DEFAULT_CASE_ALIAS,
    DUE_DATE: variables.DUE_DATE || DEFAULT_DUE_DATE,
    OPTOUT_NUMBER: optOutNumber,
  };
}

export function renderTemplateText(
  template: string,
  variables: Partial<SmsTemplateVariables> = {},
): string {
  const normalized = normalizeTemplateVariables(variables);
  const pattern = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

  const pass = (input: string) =>
    input.replace(pattern, (_, key: keyof SmsTemplateVariables) => normalized[key] ?? "");

  return pass(pass(template)).replace(/\s{2,}/g, " ").trim();
}

export function getSmsTemplateRegistry(): SmsTemplateDefinition[] {
  return [...SMS_TEMPLATE_REGISTRY];
}

export function getSmsTemplatesByStage(stage: SmsStage): SmsTemplateDefinition[] {
  return SMS_TEMPLATE_REGISTRY.filter((item) => item.stage === stage);
}

export function getSmsTemplatesByStageAndSituation(
  stage: SmsStage,
  situation: SmsSituation,
): SmsTemplateDefinition[] {
  return SMS_TEMPLATE_REGISTRY.filter(
    (item) => item.stage === stage && item.situation === situation,
  );
}

export function toPanelTemplates(stage: SmsStage): SmsPanelTemplateLike[] {
  return getSmsTemplatesByStage(stage).map((template) => ({
    id: template.id,
    type: template.type,
    label: template.label,
    body: (vars) =>
      renderTemplateText(template.template, {
        CENTER_NAME: vars.centerName,
        CALLBACK_PHONE: vars.centerPhone,
        LINK: vars.guideLink,
        CASE_ALIAS: vars.caseAlias || DEFAULT_CASE_ALIAS,
        DUE_DATE: vars.dueDate || DEFAULT_DUE_DATE,
        OPT_OUT: vars.optOut || DEFAULT_OPT_OUT,
      }),
  }));
}

export function resolveSmsStageFromLabel(stageLabel: string): SmsStage {
  if (stageLabel.includes("3")) return "STAGE3";
  if (stageLabel.includes("2")) return "STAGE2";
  return "STAGE1";
}

