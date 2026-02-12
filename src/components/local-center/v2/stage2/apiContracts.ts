export type CaseStageValue = "1" | "2" | "3";

export type StageDisplayStatus = "진행중" | "대기" | "완료" | "지연" | "보류";

export interface CaseDetailResponse {
  caseId: string;
  stage: CaseStageValue;
  assignee: { name: string; role: string };
  status: StageDisplayStatus;
  piiSummary: {
    maskedName: string;
    age: number;
    maskedPhone: string;
    anonymizationLevel: "Stage2+" | "Stage1";
  };
  stage1: {
    cist: { date: string; score: number; max: number; reliability: "양호" | "보통" | "낮음" };
    signalLevel: "양호" | "주의" | "위험";
    retrigger: { enabled: boolean; reason?: string; lastChangedAt?: string };
  };
  stage2: {
    neuropsych_1: {
      name: "SNSB";
      date: string;
      summarySD: number;
      missingItems: { count: number; items: string[] };
      reliability: "양호" | "보통" | "낮음";
    };
    clinical_2: {
      date?: string;
      completed: boolean;
      checklist: Array<{
        key: string;
        label: string;
        value: "정상" | "주의" | "해당" | "미확인";
      }>;
      note?: string;
      evaluator?: { name: string };
    };
    mciSignal: "양호" | "주의" | null;
  };
  operations: {
    nextAction: { key: string; label: string; dueAt?: string };
    referral: { status: "미생성" | "생성됨" | "전송됨" | "오류"; lastSentAt?: string };
    appointment: { status: "미정" | "요청" | "확정" | "취소"; hospital?: string; at?: string };
  };
  timeline: Array<{ key: string; label: string; at?: string; status: "done" | "waiting" | "unknown" }>;
  auditLogs: Array<{ id: string; at: string; actor: string; message: string }>;
}

export interface OpsRecommendationResponse {
  generatedAt: string;
  items: Array<{
    id: string;
    priority: 1 | 2 | 3;
    title: string;
    rationale: string;
    actions: Array<{
      key: OpsActionKey;
      label: string;
    }>;
  }>;
}

export type OpsActionKey =
  | "CREATE_REFERRAL"
  | "SEND_REFERRAL"
  | "TRACK_APPOINTMENT"
  | "AUTHORIZE_VIEW"
  | "REQUEST_SUPPORT"
  | "LINK_COUNSELING";

export type RunActionResult = {
  ok: boolean;
  actionKey: OpsActionKey;
  message: string;
};
