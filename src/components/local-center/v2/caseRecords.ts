import type { StageType } from "./shared";

export type CaseRisk = "고" | "중" | "저";
export type CaseStatus = "진행중" | "대기" | "완료" | "임박" | "지연";
export type CaseQuality = "양호" | "주의" | "경고";
export type ContactPriority = "즉시" | "높음" | "보통" | "낮음";
export type Stage1InterventionLevel = "L0" | "L1" | "L2" | "L3";
export type Stage1ExceptionState = "제외" | "보류" | null;

export const ALERT_FILTER_TABS = [
  "전체",
  "SLA 임박",
  "연계 대기",
  "MCI 미등록",
  "재평가 필요",
  "이탈 위험",
  "High MCI",
] as const;

export type CaseAlertFilter = (typeof ALERT_FILTER_TABS)[number];
export type StageFilter = "all" | StageType;
export type AlertTag = Exclude<CaseAlertFilter, "전체">;

type Profile = {
  name: string;
  age: number;
  phone: string;
  guardianPhone?: string;
};

export type CaseRecord = {
  id: string;
  stage: StageType;
  risk: CaseRisk;
  path: string;
  status: CaseStatus;
  manager: string;
  action: string;
  updated: string;
  quality: CaseQuality;
  profile: Profile;
  alertTags: AlertTag[];
  computed?: {
    stage2?: {
      modelAvailable?: boolean;
      classificationConfirmed?: boolean;
      predictedLabel?: "정상" | "MCI" | "치매";
      mciBand?: "양호" | "중간" | "위험";
      completed?: boolean;
      missing?: string[];
    };
    stage3?: {
      modelAvailable?: boolean;
      label?: "LOW" | "MID" | "HIGH";
      riskNow?: number;
      stage3Type?: "PREVENTIVE_TRACKING" | "AD_MANAGEMENT";
      originStage2Result?: "MCI-MID" | "MCI-HIGH" | "AD";
      completed?: boolean;
      missing?: string[];
    };
    ops?: {
      bookingPendingCount?: number;
      approvalsPendingCount?: number;
      dataQualityScore?: number;
    };
  };
};

export type Stage1InterventionGuide = {
  level: Stage1InterventionLevel;
  label: string;
  tone: string;
  purpose: string;
  whenToUse: string;
  actions: string[];
};

const STAGE1_INTERVENTION_GUIDES: Stage1InterventionGuide[] = [
  {
    level: "L0",
    label: "관찰(기록 중심)",
    tone: "text-gray-700 bg-gray-100 border-gray-200",
    purpose: "즉시 조치보다 기록과 모니터링 중심",
    whenToUse: "위험 신호가 낮거나 데이터 근거가 약한 경우",
    actions: ["운영 지원 안내 완료 기록", "재접촉 예정일 등록", "연락처/보호자 데이터 보강 요청"],
  },
  {
    level: "L1",
    label: "안내(자가점검/정보제공)",
    tone: "text-blue-700 bg-blue-50 border-blue-200",
    purpose: "가벼운 개입으로 참여 반응 확인",
    whenToUse: "연락은 가능하지만 연계 실행은 이른 경우",
    actions: ["안내문 또는 자가점검 링크 발송", "보호자 연락처 선택/확인 요청", "재평가 트리거(예: 미응답 7일) 설정"],
  },
  {
    level: "L2",
    label: "접촉(상담사 직접 연락)",
    tone: "text-orange-700 bg-orange-50 border-orange-200",
    purpose: "전화 상담으로 상태 확인 및 다음 단계 연결",
    whenToUse: "SLA 임박, 미응답 누적, 위험 신호 중간 이상",
    actions: ["전화 시도 및 실패 재시도 스케줄 생성", "필요 시 보호자 우선 접촉 전환", "2차 평가 예약 유도 준비"],
  },
  {
    level: "L3",
    label: "연계 강화(2차 연결 요청)",
    tone: "text-purple-700 bg-purple-50 border-purple-200",
    purpose: "Stage 1 내 최고 강도 행정 실행",
    whenToUse: "위험 신호가 높고 SLA/장기대기 리스크가 큰 경우",
    actions: ["2차 평가 연계 요청", "예약/의뢰서 생성", "정책 게이트 미충족 시 사유 확인 후 보완"],
  },
];

export const CASE_RECORDS: CaseRecord[] = [
  {
    id: "CASE-2026-001",
    stage: "Stage 1",
    risk: "고",
    path: "초기 접촉 집중",
    status: "진행중",
    manager: "이동욱",
    action: "1차 전화 재시도",
    updated: "2026-02-11 09:30",
    quality: "양호",
    profile: { name: "한명자", age: 78, phone: "010-2481-9320", guardianPhone: "010-8821-1209" },
    alertTags: ["SLA 임박", "재평가 필요"],
  },
  {
    id: "CASE-2026-002",
    stage: "Stage 2",
    risk: "중",
    path: "의뢰 우선",
    status: "대기",
    manager: "박민지",
    action: "의뢰서 생성",
    updated: "2026-02-11 10:15",
    quality: "주의",
    profile: { name: "최수진", age: 73, phone: "010-3841-5520" },
    alertTags: ["연계 대기"],
  },
  {
    id: "CASE-2026-003",
    stage: "Stage 3",
    risk: "고",
    path: "추적 강화",
    status: "진행중",
    manager: "김성실",
    action: "재평가 일정 생성",
    updated: "2026-02-10 16:45",
    quality: "양호",
    profile: { name: "박정호", age: 81, phone: "010-5510-2840" },
    alertTags: ["재평가 필요", "이탈 위험"],
  },
  {
    id: "CASE-2026-004",
    stage: "Stage 1",
    risk: "저",
    path: "문자 안내 우선",
    status: "완료",
    manager: "최유리",
    action: "종결",
    updated: "2026-02-11 11:00",
    quality: "양호",
    profile: { name: "이영자", age: 66, phone: "010-7652-9213", guardianPhone: "010-4312-5591" },
    alertTags: [],
  },
  {
    id: "CASE-2026-005",
    stage: "Stage 2",
    risk: "고",
    path: "High MCI 경로",
    status: "임박",
    manager: "이동욱",
    action: "추적 등록",
    updated: "2026-02-11 11:20",
    quality: "경고",
    profile: { name: "김도연", age: 75, phone: "010-4288-7712" },
    alertTags: ["SLA 임박", "High MCI", "MCI 미등록"],
  },
  {
    id: "CASE-2026-006",
    stage: "Stage 1",
    risk: "중",
    path: "보호자 동시 접촉",
    status: "진행중",
    manager: "박민지",
    action: "보호자 안내 발송",
    updated: "2026-02-11 11:45",
    quality: "양호",
    profile: { name: "윤미정", age: 69, phone: "010-6721-2098" },
    alertTags: [],
  },
  {
    id: "CASE-2026-007",
    stage: "Stage 3",
    risk: "중",
    path: "정기 추적",
    status: "지연",
    manager: "김성실",
    action: "이탈방지 재연락",
    updated: "2026-02-09 14:00",
    quality: "양호",
    profile: { name: "문성자", age: 84, phone: "010-9191-2504" },
    alertTags: ["SLA 임박", "이탈 위험"],
  },
  {
    id: "CASE-2026-008",
    stage: "Stage 2",
    risk: "중",
    path: "MCI 경로",
    status: "대기",
    manager: "최유리",
    action: "MCI 등록 검토",
    updated: "2026-02-10 09:50",
    quality: "주의",
    profile: { name: "장현우", age: 72, phone: "010-2351-9801" },
    alertTags: ["MCI 미등록", "연계 대기"],
  },
  {
    id: "CASE-2026-009",
    stage: "Stage 3",
    risk: "고",
    path: "3차 감별 연계",
    status: "임박",
    manager: "이동욱",
    action: "3차 감별 예약",
    updated: "2026-02-11 08:35",
    quality: "주의",
    profile: { name: "신미화", age: 79, phone: "010-4089-1302" },
    alertTags: ["SLA 임박", "재평가 필요"],
  },
  {
    id: "CASE-2026-010",
    stage: "Stage 1",
    risk: "저",
    path: "초기 안내",
    status: "대기",
    manager: "박민지",
    action: "초기 연락",
    updated: "2026-02-10 13:20",
    quality: "양호",
    profile: { name: "오연희", age: 64, phone: "010-7413-8267", guardianPhone: "010-3755-6401" },
    alertTags: ["연계 대기"],
  },
  {
    id: "CASE-2026-011",
    stage: "Stage 1",
    risk: "고",
    path: "현장 방문 연계",
    status: "임박",
    manager: "서지윤",
    action: "긴급 방문 전화",
    updated: "2026-02-11 12:05",
    quality: "주의",
    profile: { name: "유문자", age: 83, phone: "010-6671-2104", guardianPhone: "010-7201-5543" },
    alertTags: ["SLA 임박"],
  },
  {
    id: "CASE-2026-012",
    stage: "Stage 2",
    risk: "저",
    path: "정상 추적 권고",
    status: "완료",
    manager: "오민석",
    action: "종결 검토",
    updated: "2026-02-08 10:10",
    quality: "양호",
    profile: { name: "이춘자", age: 71, phone: "010-5870-3370" },
    alertTags: [],
  },
  {
    id: "CASE-2026-013",
    stage: "Stage 3",
    risk: "저",
    path: "완화 추적",
    status: "진행중",
    manager: "김성실",
    action: "월간 체크콜",
    updated: "2026-02-07 17:40",
    quality: "양호",
    profile: { name: "박민철", age: 68, phone: "010-8901-0061" },
    alertTags: [],
  },
  {
    id: "CASE-2026-014",
    stage: "Stage 2",
    risk: "중",
    path: "검사 예약 집중",
    status: "진행중",
    manager: "한수민",
    action: "검사 리마인드",
    updated: "2026-02-11 07:55",
    quality: "양호",
    profile: { name: "정예지", age: 70, phone: "010-3520-9912" },
    alertTags: ["재평가 필요"],
  },
  {
    id: "CASE-2026-015",
    stage: "Stage 1",
    risk: "중",
    path: "재접촉 집중",
    status: "지연",
    manager: "이동욱",
    action: "재접촉 시도",
    updated: "2026-02-09 11:25",
    quality: "주의",
    profile: { name: "권정순", age: 76, phone: "010-1002-4451", guardianPhone: "010-9001-1112" },
    alertTags: ["이탈 위험", "SLA 임박"],
  },
  {
    id: "CASE-2026-175",
    stage: "Stage 1",
    risk: "고",
    path: "초기 접촉 집중",
    status: "대기",
    manager: "이동욱",
    action: "Stage1 모델 실행",
    updated: "2026-02-19 09:00",
    quality: "양호",
    profile: { name: "이재용", age: 67, phone: "010-****-1234" },
    alertTags: ["SLA 임박"],
  },
  {
    id: "CASE-2026-275",
    stage: "Stage 2",
    risk: "중",
    path: "High MCI 경로",
    status: "진행중",
    manager: "이동욱",
    action: "Stage2 모델 결과 리뷰",
    updated: "2026-02-19 10:20",
    quality: "양호",
    profile: { name: "이재용", age: 67, phone: "010-****-1234" },
    alertTags: ["High MCI", "연계 대기"],
  },
  {
    id: "CASE-2026-375",
    stage: "Stage 3",
    risk: "중",
    path: "추가관리 집중",
    status: "진행중",
    manager: "이동욱",
    action: "Stage3 위험도 확인",
    updated: "2026-02-19 11:10",
    quality: "양호",
    profile: { name: "이재용", age: 67, phone: "010-****-1234" },
    alertTags: ["재평가 필요"],
  },
  {
    id: "CASE-2026-016",
    stage: "Stage 2",
    risk: "고",
    path: "의료 의뢰 우선",
    status: "지연",
    manager: "오민석",
    action: "의뢰기관 재조율",
    updated: "2026-02-09 08:10",
    quality: "경고",
    profile: { name: "남궁자", age: 82, phone: "010-4721-2004" },
    alertTags: ["High MCI", "SLA 임박", "연계 대기"],
  },
  {
    id: "CASE-2026-017",
    stage: "Stage 3",
    risk: "중",
    path: "안정 추적",
    status: "완료",
    manager: "최유리",
    action: "종결 보고",
    updated: "2026-02-06 15:25",
    quality: "양호",
    profile: { name: "정훈길", age: 74, phone: "010-7790-6631" },
    alertTags: [],
  },
  {
    id: "CASE-2026-018",
    stage: "Stage 1",
    risk: "저",
    path: "안내 유지",
    status: "진행중",
    manager: "서지윤",
    action: "문자 안내",
    updated: "2026-02-10 15:50",
    quality: "양호",
    profile: { name: "채은지", age: 63, phone: "010-8101-3321", guardianPhone: "010-7750-4012" },
    alertTags: [],
  },
  {
    id: "CASE-2026-019",
    stage: "Stage 2",
    risk: "중",
    path: "지역 병원 연계",
    status: "임박",
    manager: "한수민",
    action: "예약 확정 콜",
    updated: "2026-02-11 06:50",
    quality: "주의",
    profile: { name: "진소연", age: 77, phone: "010-3124-8823" },
    alertTags: ["SLA 임박", "연계 대기"],
  },
  {
    id: "CASE-2026-020",
    stage: "Stage 3",
    risk: "고",
    path: "재평가 집중",
    status: "대기",
    manager: "김성실",
    action: "재평가 전 사전콜",
    updated: "2026-02-08 17:05",
    quality: "주의",
    profile: { name: "임경남", age: 80, phone: "010-8823-2240" },
    alertTags: ["재평가 필요", "이탈 위험"],
  },
  {
    id: "CASE-2026-021",
    stage: "Stage 1",
    risk: "고",
    path: "MCI 사전 안내",
    status: "대기",
    manager: "오민석",
    action: "고위험군 재연락",
    updated: "2026-02-10 08:45",
    quality: "경고",
    profile: { name: "정해숙", age: 85, phone: "010-6012-5566", guardianPhone: "010-2201-8890" },
    alertTags: ["MCI 미등록", "연계 대기"],
  },
  {
    id: "CASE-2026-022",
    stage: "Stage 2",
    risk: "저",
    path: "보건소 협력",
    status: "진행중",
    manager: "박민지",
    action: "진행 확인",
    updated: "2026-02-07 13:15",
    quality: "양호",
    profile: { name: "송혜란", age: 67, phone: "010-4781-0190" },
    alertTags: [],
  },
  {
    id: "CASE-2026-023",
    stage: "Stage 3",
    risk: "저",
    path: "이탈 예방 추적",
    status: "지연",
    manager: "한수민",
    action: "보호자 재연락",
    updated: "2026-02-09 19:20",
    quality: "주의",
    profile: { name: "김은비", age: 72, phone: "010-2441-5567" },
    alertTags: ["이탈 위험"],
  },
  {
    id: "CASE-2026-024",
    stage: "Stage 1",
    risk: "중",
    path: "초기 선별 완료",
    status: "완료",
    manager: "최유리",
    action: "모니터링 전환",
    updated: "2026-02-05 16:20",
    quality: "양호",
    profile: { name: "백정애", age: 62, phone: "010-7140-0013" },
    alertTags: [],
  },
];

const STAGE_FILTER_BY_TRIGGER: Record<string, StageType> = {
  "1차 선별": "Stage 1",
  "1차선별": "Stage 1",
  "Stage 1": "Stage 1",
  "2차 평가": "Stage 2",
  "2차 선별": "Stage 2",
  "2차선별": "Stage 2",
  "Stage 2": "Stage 2",
  MCI: "Stage 2",
  "High MCI": "Stage 2",
  "3차 감별": "Stage 3",
  "3차선별": "Stage 3",
  "3차 선별": "Stage 3",
  "Stage 3": "Stage 3",
};

export function resolveInitialCaseFilter(initialFilter: string | null): {
  alertFilter: CaseAlertFilter;
  stageFilter: StageFilter;
} {
  if (!initialFilter) {
    return { alertFilter: "전체", stageFilter: "all" };
  }

  const trimmed = initialFilter.trim();
  if ((ALERT_FILTER_TABS as readonly string[]).includes(trimmed)) {
    return { alertFilter: trimmed as CaseAlertFilter, stageFilter: "all" };
  }

  const mappedStage = STAGE_FILTER_BY_TRIGGER[trimmed];
  if (mappedStage) {
    return { alertFilter: "전체", stageFilter: mappedStage };
  }

  return { alertFilter: "전체", stageFilter: "all" };
}

export function matchesAlertFilter(item: CaseRecord, alertFilter: CaseAlertFilter): boolean {
  if (alertFilter === "전체") return true;
  return item.alertTags.includes(alertFilter);
}

export function getCaseRecordById(caseId: string): CaseRecord | undefined {
  return CASE_RECORDS.find((item) => item.id === caseId);
}

export function getStage1ContactPriority(
  item?: Pick<CaseRecord, "stage" | "status" | "alertTags">
): { label: ContactPriority; tone: string } {
  if (!item || item.stage !== "Stage 1") {
    return { label: "보통", tone: "text-blue-700 bg-blue-50 border-blue-200" };
  }

  if (item.status === "임박" || item.status === "지연" || item.alertTags.includes("SLA 임박")) {
    return { label: "즉시", tone: "text-red-700 bg-red-50 border-red-200" };
  }

  if (
    item.status === "대기" ||
    item.alertTags.includes("연계 대기") ||
    item.alertTags.includes("재평가 필요") ||
    item.alertTags.includes("MCI 미등록")
  ) {
    return { label: "높음", tone: "text-orange-700 bg-orange-50 border-orange-200" };
  }

  if (item.status === "진행중") {
    return { label: "보통", tone: "text-blue-700 bg-blue-50 border-blue-200" };
  }

  return { label: "낮음", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
}

export type Stage1InterventionPlan = {
  level: Stage1InterventionLevel;
  guide: Stage1InterventionGuide;
  exceptionState: Stage1ExceptionState;
  exceptionReason?: string;
};

export function getStage1InterventionGuides(): Stage1InterventionGuide[] {
  return STAGE1_INTERVENTION_GUIDES;
}

export function getStage1InterventionPlan(
  item?: Pick<CaseRecord, "stage" | "status" | "alertTags" | "risk" | "quality">
): Stage1InterventionPlan {
  const fallbackGuide = STAGE1_INTERVENTION_GUIDES[1];

  if (!item || item.stage !== "Stage 1") {
    return {
      level: fallbackGuide.level,
      guide: fallbackGuide,
      exceptionState: null,
    };
  }

  const isUrgent =
    item.status === "임박" ||
    item.status === "지연" ||
    item.alertTags.includes("SLA 임박") ||
    item.alertTags.includes("이탈 위험");

  const isHighSignal =
    item.risk === "고" ||
    item.alertTags.includes("재평가 필요") ||
    item.alertTags.includes("MCI 미등록");

  const isWaiting = item.status === "대기" || item.alertTags.includes("연계 대기");

  let level: Stage1InterventionLevel = "L0";
  let exceptionState: Stage1ExceptionState = null;
  let exceptionReason: string | undefined;

  if (item.quality === "경고") {
    level = "L0";
    exceptionState = "제외";
    exceptionReason = "데이터 품질 보강 전까지 우선순위 산정 제외";
  } else if (isHighSignal && (isUrgent || isWaiting)) {
    level = "L3";
  } else if (isUrgent || isHighSignal) {
    level = "L2";
  } else if (isWaiting || item.quality === "주의") {
    level = "L1";
  }

  if (!exceptionState && item.status === "대기" && !isUrgent && !isHighSignal) {
    exceptionState = "보류";
    exceptionReason = "7일 후 자동 재상정";
  }

  const guide = STAGE1_INTERVENTION_GUIDES.find((entry) => entry.level === level) ?? fallbackGuide;

  return {
    level,
    guide,
    exceptionState,
    exceptionReason,
  };
}

export function toAgeBand(age: number): string {
  if (age < 70) return "60대";
  if (age < 80) return "70대";
  return "80대";
}

export function maskName(name: string): string {
  if (!name) return "-";
  if (name.length === 1) return `${name}*`;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}`;
}

export function maskPhone(phone: string): string {
  const match = phone.match(/^(\d{3})-(\d{3,4})-(\d{4})$/);
  if (!match) return phone;
  const [, p1, p2, p3] = match;
  return `${p1}-${"*".repeat(p2.length)}-${p3}`;
}
