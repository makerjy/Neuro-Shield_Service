/* ═══════════════════════════════════════════════════════════════════════════
   프로그램 제공(행정 실행) — 타입 정의
   Stage2/Stage3 케이스 상세 UI에서 사용하는 모든 인터페이스/타입
═══════════════════════════════════════════════════════════════════════════ */

/* ─── 프로그램 분류 체계 (Taxonomy) ─── */
export type TopCategory = "건강" | "일상생활" | "안전" | "가족";

export interface ProgramTaxonomyItem {
  top: TopCategory;
  mid: string;
  sub: string;
  code: string;
  label: string;
  keywords: string[];
  /** Stage 적합성 태그 */
  stageFit?: (2 | 3)[];
  /** MCI 세부분류 적합성 */
  mciSeverityFit?: ("양호" | "중등" | "중증")[];
  /** 치매 대상 여부 */
  dementiaFit?: boolean;
}

/* ─── 프로그램 선택 / 실행 ─── */
export type ExecutionMode = "연계" | "예약" | "안내" | "교육" | "방문";
export type ExecutionStatus = "예정" | "진행" | "완료" | "보류";

export interface OrgLink {
  name: string;
  phone?: string;
  note?: string;
}

export interface SelectedProgramItem {
  code: string;
  label: string;
  top: TopCategory;
  mid: string;
  mode: ExecutionMode;
  dueDate: string;
  assigneeId: string;
  assigneeName: string;
  orgLink?: OrgLink;
  notes: string;
  status: ExecutionStatus;
  addedAt: string;
  addedSource?: "manual" | "rule" | "rag";
}

export interface CaseProgramSelection {
  caseId: string;
  stage: 2 | 3;
  resultLabel: "정상" | "MCI" | "치매";
  mciSeverity?: "양호" | "중등" | "중증";
  selectedItems: SelectedProgramItem[];
}

/* ─── 추천 ─── */
export type RecommendationSource = "rule" | "rag";
export type ConfidenceLabel = "높음" | "보통" | "낮음";

export interface RecommendationItem {
  code: string;
  label: string;
  top: TopCategory;
  mid: string;
  reasonSummary: string;
  evidenceSnippets: string[];
  source: RecommendationSource;
  confidenceLabel: ConfidenceLabel;
}

/* ─── 감사 로그 ─── */
export type AuditEventType =
  | "ADD_SELECTED"
  | "REMOVE_SELECTED"
  | "UPDATE_EXECUTION"
  | "PIN"
  | "UNPIN"
  | "ADD_FROM_RECO"
  | "HOLD_RECO"
  | "STATUS_CHANGE";

export interface AuditEvent {
  eventId: string;
  caseId: string;
  actorId: string;
  actorName: string;
  at: string;
  type: AuditEventType;
  payload: Record<string, unknown>;
  sourceMeta?: { source: RecommendationSource; code: string };
}

/* ─── 핀(즐겨찾기) ─── */
export type PinnedSet = Set<string>; // program codes

/* ─── Stage 컨텍스트 (추천 엔진 입력) ─── */
export interface StageContext {
  stage: 2 | 3;
  resultLabel: "정상" | "MCI" | "치매";
  mciSeverity?: "양호" | "중등" | "중증";
  riskTags: string[]; // 예: 낙상, 배회, 약물, 보호자부담, 독거 등
}
