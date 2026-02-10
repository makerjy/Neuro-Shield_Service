/**
 * Mock 데이터: 정책/규칙 변경 이벤트, 감사 이력, Driver 분석
 * 중앙관리(보건복지부) 서비스 전용
 */

/* ═══════════════════════════════════════════
   A) 정책/규칙 변경 이벤트 (Policy Impact)
   → "모델/규칙 변경 관리" 탭
   ═══════════════════════════════════════════ */

export interface PolicyChangeEvent {
  id: string;
  title: string;
  type: 'rule_threshold' | 'model_version' | 'ruleset' | 'contact_rule';
  version: string;
  deployedAt: string;        // ISO datetime
  deployedBy: string;
  status: 'deployed' | 'rollback' | 'pending' | 'reviewing';
  description: string;
  before: PolicyKpiSnapshot;
  after: PolicyKpiSnapshot;
  impactSummary: ImpactItem[];
  affectedRegions: string[];
  /* Decision Control 확장 */
  riskLevel?: 'low' | 'medium' | 'high';
  requestedBy?: string;
  approvedBy?: string | null;
  currentRule?: string;
  proposedRule?: string;
  reason?: string;
}

export interface PolicyKpiSnapshot {
  slaRate: number;
  responseTimeliness: number;
  completionRate: number;
  dataFulfillment: number;
}

export interface ImpactItem {
  kpi: string;
  label: string;
  changePp: number;  // percentage-point change
  verdict: 'improved' | 'worsened' | 'insignificant';
}

export const MOCK_POLICY_CHANGES: PolicyChangeEvent[] = [
  {
    id: 'chg_20260124',
    title: 'L2 기준점 65→60 하향 검토',
    type: 'rule_threshold',
    version: 'v2.3.2 (draft)',
    deployedAt: '2026-01-24T14:00:00+09:00',
    deployedBy: '-',
    status: 'reviewing',
    description: '경기도 일부 센터에서 L2 누락 케이스 증가. 60~64점 구간 이탈률 24%를 근거로 기준점 하향 검토 중.',
    before: { slaRate: 89.8, responseTimeliness: 85.1, completionRate: 92.7, dataFulfillment: 94.3 },
    after: { slaRate: 89.8, responseTimeliness: 85.1, completionRate: 92.7, dataFulfillment: 94.3 },
    impactSummary: [
      { kpi: 'SLA', label: 'SLA 준수율', changePp: 0, verdict: 'insignificant' },
      { kpi: 'RESP', label: '응답 적시율', changePp: 0, verdict: 'insignificant' },
      { kpi: 'COMP', label: '처리 완료율', changePp: 0, verdict: 'insignificant' },
      { kpi: 'DATA', label: '데이터 충족률', changePp: 0, verdict: 'insignificant' },
    ],
    affectedRegions: ['전국'],
    riskLevel: 'medium',
    requestedBy: '이영희 (서울시)',
    approvedBy: null,
    currentRule: '점수 ≥ 65 → L2',
    proposedRule: '점수 ≥ 60 → L2',
    reason: '최근 3개월 데이터 분석 결과, 60~64점 구간에서 이탈률이 높음(평균 24%). 조기 개입 시 이탈률을 약 15% 감소시킬 수 있을 것으로 예상됨.',
  },
  {
    id: 'chg_20260120',
    title: 'L2 기준점 60→65 상향 조정',
    type: 'rule_threshold',
    version: 'v2.3.1',
    deployedAt: '2026-01-20T09:00:00+09:00',
    deployedBy: '박중앙 (보건복지부)',
    status: 'deployed',
    description: 'L2 대상 점수 기준을 60점에서 65점으로 상향. 경미 위험 대상 축소로 센터 업무 집중도 향상 기대.',
    before: { slaRate: 87.2, responseTimeliness: 82.5, completionRate: 91.3, dataFulfillment: 94.1 },
    after: { slaRate: 89.8, responseTimeliness: 85.1, completionRate: 92.7, dataFulfillment: 94.3 },
    impactSummary: [
      { kpi: 'SLA', label: 'SLA 준수율', changePp: 2.6, verdict: 'improved' },
      { kpi: 'RESP', label: '응답 적시율', changePp: 2.6, verdict: 'improved' },
      { kpi: 'COMP', label: '처리 완료율', changePp: 1.4, verdict: 'improved' },
      { kpi: 'DATA', label: '데이터 충족률', changePp: 0.2, verdict: 'insignificant' },
    ],
    affectedRegions: ['전국'],
    riskLevel: 'medium',
    requestedBy: '박중앙 (보건복지부)',
    approvedBy: '김정책 (보건복지부)',
  },
  {
    id: 'chg_20260115',
    title: '재접촉 주기 7일→5일 단축',
    type: 'contact_rule',
    version: 'v2.3.0',
    deployedAt: '2026-01-15T14:30:00+09:00',
    deployedBy: '김센터 (강남구)',
    status: 'deployed',
    description: 'L3 케이스 재접촉 주기를 7일에서 5일로 단축. 조기 대응 가능성 확대.',
    before: { slaRate: 85.8, responseTimeliness: 80.1, completionRate: 89.5, dataFulfillment: 93.8 },
    after: { slaRate: 87.2, responseTimeliness: 82.5, completionRate: 91.3, dataFulfillment: 94.1 },
    impactSummary: [
      { kpi: 'SLA', label: 'SLA 준수율', changePp: 1.4, verdict: 'improved' },
      { kpi: 'RESP', label: '응답 적시율', changePp: 2.4, verdict: 'improved' },
      { kpi: 'COMP', label: '처리 완료율', changePp: 1.8, verdict: 'improved' },
      { kpi: 'DATA', label: '데이터 충족률', changePp: 0.3, verdict: 'insignificant' },
    ],
    affectedRegions: ['서울특별시'],
    riskLevel: 'low',
    requestedBy: '최현장 (서울시 센터장)',
    approvedBy: '박중앙 (보건복지부)',
  },
  {
    id: 'chg_20260110',
    title: '예측 모델 v3.2 배포',
    type: 'model_version',
    version: 'v3.2.0',
    deployedAt: '2026-01-10T11:00:00+09:00',
    deployedBy: '이모델 (중앙)',
    status: 'deployed',
    description: '위험 예측 모델 v3.2 전국 배포. 재현율 +3.2%p, 정밀도 +1.8%p 향상.',
    before: { slaRate: 84.1, responseTimeliness: 78.9, completionRate: 88.2, dataFulfillment: 93.2 },
    after: { slaRate: 85.8, responseTimeliness: 80.1, completionRate: 89.5, dataFulfillment: 93.8 },
    impactSummary: [
      { kpi: 'SLA', label: 'SLA 준수율', changePp: 1.7, verdict: 'improved' },
      { kpi: 'RESP', label: '응답 적시율', changePp: 1.2, verdict: 'improved' },
      { kpi: 'COMP', label: '처리 완료율', changePp: 1.3, verdict: 'improved' },
      { kpi: 'DATA', label: '데이터 충족률', changePp: 0.6, verdict: 'insignificant' },
    ],
    affectedRegions: ['전국'],
    riskLevel: 'low',
    requestedBy: '이모델 (중앙)',
    approvedBy: '박중앙 (보건복지부)',
  },
  {
    id: 'chg_20260105',
    title: '독거 가중치 1.2→1.35 조정',
    type: 'ruleset',
    version: 'v2.2.5',
    deployedAt: '2026-01-05T10:00:00+09:00',
    deployedBy: '박중앙 (보건복지부)',
    status: 'rollback',
    description: '독거 노인 가중치를 1.2에서 1.35로 상향. 업무량 과다로 1주 후 롤백.',
    before: { slaRate: 84.5, responseTimeliness: 79.2, completionRate: 88.8, dataFulfillment: 93.5 },
    after: { slaRate: 82.3, responseTimeliness: 76.8, completionRate: 86.1, dataFulfillment: 93.4 },
    impactSummary: [
      { kpi: 'SLA', label: 'SLA 준수율', changePp: -2.2, verdict: 'worsened' },
      { kpi: 'RESP', label: '응답 적시율', changePp: -2.4, verdict: 'worsened' },
      { kpi: 'COMP', label: '처리 완료율', changePp: -2.7, verdict: 'worsened' },
      { kpi: 'DATA', label: '데이터 충족률', changePp: -0.1, verdict: 'insignificant' },
    ],
    affectedRegions: ['전국'],
    riskLevel: 'high',
    requestedBy: '박중앙 (보건복지부)',
    approvedBy: '김정책 (보건복지부)',
  },
];

/* ═══════════════════════════════════════════
   B) 감사/변경 이력 (Audit & Accountability)
   → "규정 준수 및 감사" 탭
   ═══════════════════════════════════════════ */

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  actionType: 'intervention' | 'rule_change' | 'model_deploy' | 'access' | 'override';
  target: string;
  result: 'success' | 'blocked' | 'pending';
  rationale: string;
  kpiSnapshot: {
    slaRate: number;
    riskTop3: string[];
    regionContext: string;
  };
}

export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'a_001',
    timestamp: '2026-01-24T14:30:00+09:00',
    actor: '박중앙',
    actorRole: '보건복지부 중앙관리자',
    action: '부산시 센터 긴급 인력 지원 지시',
    actionType: 'intervention',
    target: '부산광역시 관할 5개 센터',
    result: 'success',
    rationale: 'SLA 준수율 78.2%로 전국 최하위. 미처리 케이스 42건 누적. 즉각 인력 재배치 필요.',
    kpiSnapshot: { slaRate: 78.2, riskTop3: ['부산 해운대구', '부산 동래구', '부산 사하구'], regionContext: '부산광역시' },
  },
  {
    id: 'a_002',
    timestamp: '2026-01-22T10:15:00+09:00',
    actor: '이정책',
    actorRole: '정책 담당자',
    action: 'L2 기준점 65→60 긴급 하향 검토 요청',
    actionType: 'rule_change',
    target: 'L2 분류 기준점',
    result: 'pending',
    rationale: '경기도 일부 센터에서 L2 누락 케이스 증가. 60~64점 구간 이탈률 24% 확인.',
    kpiSnapshot: { slaRate: 85.5, riskTop3: ['경기 안산시', '경기 시흥시', '경기 부천시'], regionContext: '경기도' },
  },
  {
    id: 'a_003',
    timestamp: '2026-01-20T09:00:00+09:00',
    actor: '박중앙',
    actorRole: '보건복지부 중앙관리자',
    action: 'L2 기준점 60→65 상향 배포',
    actionType: 'rule_change',
    target: 'L2 분류 기준점 (전국)',
    result: 'success',
    rationale: '센터 업무량 최적화를 위해 경미 위험 기준 상향. 샌드박스 평가 통과.',
    kpiSnapshot: { slaRate: 87.2, riskTop3: ['부산 해운대구', '대구 달서구', '경기 안산시'], regionContext: '전국' },
  },
  {
    id: 'a_004',
    timestamp: '2026-01-18T16:45:00+09:00',
    actor: '김모델',
    actorRole: '데이터 사이언티스트',
    action: '위험 예측 모델 v3.2 전국 배포',
    actionType: 'model_deploy',
    target: '위험 예측 모델 전국 적용',
    result: 'success',
    rationale: 'v3.1 대비 재현율 +3.2%p. A/B 테스트 2주간 진행 후 전국 확대.',
    kpiSnapshot: { slaRate: 85.8, riskTop3: ['부산 해운대구', '대구 달서구', '경기 안산시'], regionContext: '전국' },
  },
  {
    id: 'a_005',
    timestamp: '2026-01-15T14:30:00+09:00',
    actor: '최현장',
    actorRole: '서울시 센터장',
    action: '재접촉 주기 7일→5일 승인 요청',
    actionType: 'rule_change',
    target: 'L3 재접촉 주기 (서울)',
    result: 'success',
    rationale: 'L3 케이스 7일 주기로 위험 신호 2건 놓침. 5일로 단축 시 조기 대응 가능.',
    kpiSnapshot: { slaRate: 86.1, riskTop3: ['서울 강남구', '서울 송파구', '서울 관악구'], regionContext: '서울특별시' },
  },
];

/* ═══════════════════════════════════════════
   C) Driver 분석 / 병목 분석 / 품질 진단
   → "데이터&모델 품질" 탭
   ═══════════════════════════════════════════ */

export interface DriverAnalysis {
  key: 'ops_bottleneck' | 'data_quality' | 'contact_strategy' | 'model_fitness';
  label: string;
  icon: string;
  description: string;
  severity: 'critical' | 'warning' | 'good';
  score: number;           // 0-100
  contributionPct: number; // KPI 하락 기여도 (%)
  topRegions: DriverRegion[];
  indicators: DriverIndicator[];
}

export interface DriverRegion {
  code: string;
  name: string;
  score: number;
  detail: string;
}

export interface DriverIndicator {
  label: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'red' | 'yellow' | 'green';
}

export const MOCK_DRIVER_ANALYSIS: DriverAnalysis[] = [
  {
    key: 'ops_bottleneck',
    label: '운영 병목',
    icon: '⚙️',
    description: '센터 인력, SLA 위반, 미처리 케이스 누적 등 운영 리소스 병목 분석',
    severity: 'critical',
    score: 38,
    contributionPct: 35,
    topRegions: [
      { code: '26', name: '부산광역시', score: 22, detail: 'SLA 78.2%, 미처리 42건' },
      { code: '27', name: '대구광역시', score: 35, detail: 'SLA 82.5%, 인력 부족' },
      { code: '31', name: '경기도', score: 41, detail: '일부 시군 SLA 84%' },
    ],
    indicators: [
      { label: '평균 SLA 준수율', value: 89.8, unit: '%', threshold: 90, status: 'yellow' },
      { label: '미처리 케이스 총수', value: 156, unit: '건', threshold: 100, status: 'red' },
      { label: '평균 처리 소요시간', value: 4.2, unit: '일', threshold: 3, status: 'red' },
      { label: '인력 대비 케이스 비율', value: 28.5, unit: '건/인', threshold: 25, status: 'yellow' },
    ],
  },
  {
    key: 'data_quality',
    label: '데이터 품질',
    icon: '📊',
    description: '데이터 결측, 업데이트 지연, 입력 오류 등 데이터 품질 진단',
    severity: 'warning',
    score: 62,
    contributionPct: 28,
    topRegions: [
      { code: '26', name: '부산광역시', score: 48, detail: '필수필드 누락률 8.2%' },
      { code: '27', name: '대구광역시', score: 55, detail: '입력 지연 평균 48시간' },
      { code: '28', name: '인천광역시', score: 61, detail: '중복 케이스 12건' },
    ],
    indicators: [
      { label: '데이터 완전성', value: 95.5, unit: '%', threshold: 95, status: 'green' },
      { label: '데이터 정확성', value: 96.8, unit: '%', threshold: 95, status: 'green' },
      { label: '데이터 적시성', value: 93.8, unit: '%', threshold: 95, status: 'yellow' },
      { label: '결측 필드 비율', value: 4.5, unit: '%', threshold: 5, status: 'yellow' },
    ],
  },
  {
    key: 'contact_strategy',
    label: '접촉 전략',
    icon: '📞',
    description: '접촉 성공률, 재접촉 효율, 채널 활용도 등 접촉 전략 효과성 분석',
    severity: 'good',
    score: 75,
    contributionPct: 22,
    topRegions: [
      { code: '30', name: '대전광역시', score: 58, detail: '접촉 성공률 62%' },
      { code: '29', name: '광주광역시', score: 65, detail: '재접촉 효율 68%' },
      { code: '31', name: '경기도', score: 70, detail: '채널 다변화 부족' },
    ],
    indicators: [
      { label: '접촉 성공률', value: 78.5, unit: '%', threshold: 80, status: 'yellow' },
      { label: '재접촉 효율', value: 72.3, unit: '%', threshold: 70, status: 'green' },
      { label: '평균 접촉 횟수', value: 2.8, unit: '회', threshold: 3, status: 'green' },
      { label: '응답 적시율', value: 85.1, unit: '%', threshold: 85, status: 'green' },
    ],
  },
  {
    key: 'model_fitness',
    label: '모델 적합성',
    icon: '🤖',
    description: '예측 모델 정확도, 드리프트 신호, 재학습 필요성 등 모델 적합성 진단',
    severity: 'good',
    score: 82,
    contributionPct: 15,
    topRegions: [
      { code: '27', name: '대구광역시', score: 68, detail: 'F1 89.2%, 드리프트 감지' },
      { code: '26', name: '부산광역시', score: 72, detail: 'Precision 하락 추세' },
      { code: '28', name: '인천광역시', score: 78, detail: '재학습 권장' },
    ],
    indicators: [
      { label: '평균 F1 점수', value: 91.6, unit: '%', threshold: 90, status: 'green' },
      { label: '모델 드리프트 지수', value: 0.12, unit: '', threshold: 0.15, status: 'green' },
      { label: '예측 정밀도', value: 90.5, unit: '%', threshold: 90, status: 'green' },
      { label: '재현율', value: 92.8, unit: '%', threshold: 90, status: 'green' },
    ],
  },
];

/* ═══════════════════════════════════════════
   품질 경보 (단순 규칙 기반)
   ═══════════════════════════════════════════ */

export interface QualityAlert {
  id: string;
  type: 'data_missing' | 'update_delay' | 'model_drift' | 'sla_breach';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  region: string;
  detectedAt: string;
  resolved: boolean;
  relatedDriver?: DriverAnalysis['key'];
}

export const MOCK_QUALITY_ALERTS: QualityAlert[] = [
  {
    id: 'qa_001',
    type: 'sla_breach',
    severity: 'critical',
    title: '부산광역시 SLA 위반 경보',
    description: 'SLA 준수율 78.2%로 기준(85%) 미달. 미처리 42건 누적.',
    region: '부산광역시',
    detectedAt: '2026-01-24T08:00:00+09:00',
    resolved: false,
    relatedDriver: 'ops_bottleneck',
  },
  {
    id: 'qa_002',
    type: 'update_delay',
    severity: 'warning',
    title: '대구광역시 데이터 입력 지연',
    description: '평균 입력 지연 48시간. 기준(24시간) 초과.',
    region: '대구광역시',
    detectedAt: '2026-01-23T10:00:00+09:00',
    resolved: false,
    relatedDriver: 'data_quality',
  },
  {
    id: 'qa_003',
    type: 'model_drift',
    severity: 'warning',
    title: 'L3 위험 예측 모델 드리프트 감지',
    description: 'F1 89.2% → 기존 대비 -2.4%p. 재학습 권장.',
    region: '전국',
    detectedAt: '2026-01-22T15:00:00+09:00',
    resolved: false,
    relatedDriver: 'model_fitness',
  },
  {
    id: 'qa_004',
    type: 'data_missing',
    severity: 'info',
    title: '인천광역시 중복 케이스 발견',
    description: '중복 케이스 12건 감지. 자동 병합 처리 예정.',
    region: '인천광역시',
    detectedAt: '2026-01-21T09:00:00+09:00',
    resolved: true,
    relatedDriver: 'data_quality',
  },
];

/* ═══════════════════════════════════════════
   D) 통합 감사 이벤트 (Unified Audit Events)
   → "규정 준수 및 감사" 단일 화면
   ═══════════════════════════════════════════ */

export type UnifiedEventType = 'violation' | 'policy_change' | 'model_deploy' | 'resolution';
export type EventSeverity = 'high' | 'medium' | 'low';
export type EventStatus = 'reviewing' | 'resolved' | 'pending';

export interface UnifiedAuditEvent {
  id: string;
  timestamp: string;
  type: UnifiedEventType;
  severity: EventSeverity;
  status: EventStatus;
  title: string;
  actor: string;
  actorRole: string;
  center?: string;
  target: string;
  /* 상세: 무엇이 문제였는가 */
  violationType?: string;
  violatedRegulation?: string;
  /* 상세: 왜 발생했는가 */
  cause: string;
  relatedChangeId?: string;
  /* 상세: 누가 개입했는가 */
  requestor?: string;
  approver?: string;
  executor?: string;
  /* 상세: 근거 */
  policyRef?: string;
  internalStandardId?: string;
  approvalComment?: string;
  rationale: string;
  /* KPI 스냅샷 */
  kpiSnapshot: {
    slaRate: number;
    riskTop3: string[];
    regionContext: string;
  };
}

export const MOCK_UNIFIED_AUDIT: UnifiedAuditEvent[] = [
  /* ── 🔴 규정 위반 ── */
  {
    id: 'ua_001',
    timestamp: '2026-01-24T09:15:00+09:00',
    type: 'violation',
    severity: 'high',
    status: 'reviewing',
    title: '권한 없는 PII 접근 시도',
    actor: '김상담 (CS-1042)',
    actorRole: '상담사',
    center: '강남구 센터',
    target: '시민 개인정보 DB',
    violationType: '개인정보 무단 접근',
    violatedRegulation: '개인정보보호법 제29조, 내부규정 SEC-003',
    cause: '담당 케이스 외 시민 정보 조회 시도. IP 로그 및 접근 기록 확인됨.',
    requestor: '김상담 (CS-1042)',
    executor: '김상담 (CS-1042)',
    policyRef: '개인정보보호법 제29조',
    internalStandardId: 'SEC-003',
    approvalComment: '접근 차단 후 센터장에게 통보 완료. 징계위 회부 검토 중.',
    rationale: '비담당 케이스 PII 접근은 즉시 차단 대상. 접근 로그 자동 기록.',
    kpiSnapshot: { slaRate: 89.8, riskTop3: ['서울 강남구', '서울 송파구', '서울 서초구'], regionContext: '서울특별시' },
  },
  {
    id: 'ua_002',
    timestamp: '2026-01-22T14:20:00+09:00',
    type: 'violation',
    severity: 'medium',
    status: 'resolved',
    title: '타 센터 케이스 접근',
    actor: '이과장',
    actorRole: '서초구 센터 팀장',
    center: '서초구 센터',
    target: '강남구 센터 케이스 #2847',
    violationType: '권한 범위 초과 접근',
    violatedRegulation: '내부규정 ACC-007 (센터 간 정보 장벽)',
    cause: '업무 협조 목적이나 공식 요청 절차 미이행. 즉시 차단됨.',
    relatedChangeId: 'chg_20260120',
    requestor: '이과장',
    approver: '박센터장 (서초구)',
    executor: '시스템 자동 차단',
    policyRef: '센터 간 정보 공유 지침 v2.1',
    internalStandardId: 'ACC-007',
    approvalComment: '사후 협조 요청서 제출 완료. 경고 조치.',
    rationale: '센터 간 정보 장벽 원칙 위반. 공식 협조 요청 없이 직접 접근 시도.',
    kpiSnapshot: { slaRate: 88.5, riskTop3: ['서울 서초구', '서울 강남구', '서울 관악구'], regionContext: '서울특별시' },
  },
  {
    id: 'ua_003',
    timestamp: '2026-01-20T16:00:00+09:00',
    type: 'violation',
    severity: 'low',
    status: 'resolved',
    title: 'SLA 기준 위반 (3건)',
    actor: '송파구 센터',
    actorRole: '센터 운영팀',
    center: '송파구 센터',
    target: 'SLA 기준 (48시간 내 초기 접촉)',
    violationType: 'SLA 준수 실패',
    violatedRegulation: '운영규정 SLA-001 (초기 접촉 48시간)',
    cause: '주간 인력 부족 및 케이스 급증(+15건). 우선순위 재조정 지연.',
    requestor: '송파구 센터장',
    executor: '송파구 센터 운영팀',
    approvalComment: '추가 인력 1명 임시 배치. 3건 모두 72시간 내 처리 완료.',
    policyRef: '운영규정 SLA-001',
    internalStandardId: 'SLA-001',
    rationale: '주간 케이스 급증으로 48시간 SLA 초과. 센터 자체 해결 후 보고.',
    kpiSnapshot: { slaRate: 87.2, riskTop3: ['서울 송파구', '서울 강남구', '서울 관악구'], regionContext: '서울특별시' },
  },

  /* ── 🔵 정책/기준 변경 ── */
  {
    id: 'ua_004',
    timestamp: '2026-01-20T09:00:00+09:00',
    type: 'policy_change',
    severity: 'medium',
    status: 'resolved',
    title: 'L2 기준점 60→65 상향 배포',
    actor: '박중앙',
    actorRole: '보건복지부 중앙관리자',
    target: 'L2 분류 기준점 (전국)',
    cause: '센터 업무량 최적화를 위한 경미 위험 대상 축소 조치.',
    relatedChangeId: 'chg_20260120',
    requestor: '박중앙 (보건복지부)',
    approver: '김정책 (정책심의위)',
    executor: '박중앙 (보건복지부)',
    policyRef: '위험 분류 기준 운영지침 v4.2',
    internalStandardId: 'RULE-L2-001',
    approvalComment: '샌드박스 평가 통과. SLA +2.6%p 개선 확인. 전국 배포 승인.',
    rationale: '센터 업무량 최적화를 위해 경미 위험 기준 상향. 샌드박스 평가 통과.',
    kpiSnapshot: { slaRate: 87.2, riskTop3: ['부산 해운대구', '대구 달서구', '경기 안산시'], regionContext: '전국' },
  },
  {
    id: 'ua_005',
    timestamp: '2026-01-15T14:30:00+09:00',
    type: 'policy_change',
    severity: 'low',
    status: 'resolved',
    title: '재접촉 주기 7일→5일 단축 (서울)',
    actor: '최현장',
    actorRole: '서울시 센터장',
    target: 'L3 재접촉 주기 (서울)',
    cause: 'L3 케이스 7일 주기로 위험 신호 2건 놓침. 5일로 단축 필요.',
    relatedChangeId: 'chg_20260115',
    requestor: '최현장 (서울시)',
    approver: '박중앙 (보건복지부)',
    executor: '시스템 자동 적용',
    policyRef: '접촉 관리 운영지침 v3.0',
    internalStandardId: 'RULE-CT-002',
    approvalComment: '서울 지역 한정 적용. 2주 후 전국 확대 검토.',
    rationale: 'L3 케이스 7일 주기로 위험 신호 2건 놓침. 5일로 단축 시 조기 대응 가능.',
    kpiSnapshot: { slaRate: 86.1, riskTop3: ['서울 강남구', '서울 송파구', '서울 관악구'], regionContext: '서울특별시' },
  },

  /* ── 🟣 모델 배포 ── */
  {
    id: 'ua_006',
    timestamp: '2026-01-10T11:00:00+09:00',
    type: 'model_deploy',
    severity: 'medium',
    status: 'resolved',
    title: '위험 예측 모델 v3.2 전국 배포',
    actor: '김모델',
    actorRole: '데이터 사이언티스트',
    target: '위험 예측 모델 전국 적용',
    cause: 'v3.1 대비 재현율 +3.2%p 향상. A/B 테스트 2주간 양호.',
    relatedChangeId: 'chg_20260110',
    requestor: '김모델 (데이터팀)',
    approver: '박중앙 (보건복지부)',
    executor: '김모델 (데이터팀)',
    policyRef: '모델 배포 프로세스 가이드 v1.3',
    internalStandardId: 'MDL-DEP-001',
    approvalComment: 'A/B 테스트 결과 양호. 재현율 +3.2%p, 정밀도 +1.8%p. 전국 배포 승인.',
    rationale: 'v3.1 대비 재현율 +3.2%p. A/B 테스트 2주간 진행 후 전국 확대.',
    kpiSnapshot: { slaRate: 85.8, riskTop3: ['부산 해운대구', '대구 달서구', '경기 안산시'], regionContext: '전국' },
  },

  /* ── 🟢 조치 완료 ── */
  {
    id: 'ua_007',
    timestamp: '2026-01-24T17:00:00+09:00',
    type: 'resolution',
    severity: 'high',
    status: 'resolved',
    title: '부산시 센터 긴급 인력 지원 완료',
    actor: '박중앙',
    actorRole: '보건복지부 중앙관리자',
    target: '부산광역시 관할 5개 센터',
    cause: 'SLA 준수율 78.2%로 전국 최하위. 미처리 42건 즉각 해소 필요.',
    requestor: '부산시 센터장',
    approver: '박중앙 (보건복지부)',
    executor: '인력운영팀',
    policyRef: '긴급 인력 재배치 지침 v2.0',
    internalStandardId: 'OPS-EMG-001',
    approvalComment: '5개 센터 각 2명씩 10명 긴급 파견. 48시간 내 미처리 건수 50% 감소.',
    rationale: 'SLA 준수율 78.2%로 전국 최하위. 미처리 케이스 42건 누적. 즉각 인력 재배치 필요.',
    kpiSnapshot: { slaRate: 78.2, riskTop3: ['부산 해운대구', '부산 동래구', '부산 사하구'], regionContext: '부산광역시' },
  },
  {
    id: 'ua_008',
    timestamp: '2026-01-18T11:30:00+09:00',
    type: 'resolution',
    severity: 'medium',
    status: 'resolved',
    title: '서초구 케이스 접근 위반 해결',
    actor: '박센터장',
    actorRole: '서초구 센터장',
    target: '서초구 센터 내부 조치',
    cause: '타 센터 케이스 무단 접근 건 사후 처리 완료.',
    requestor: '시스템 자동 탐지',
    approver: '박센터장 (서초구)',
    executor: '서초구 센터 관리팀',
    policyRef: '보안 위반 사후 처리 절차 v1.5',
    internalStandardId: 'SEC-POST-001',
    approvalComment: '해당 직원 보안 교육 재이수 완료. 접근 권한 재설정.',
    rationale: '위반 발생 후 48시간 내 사후 조치 완료. 보안 교육 재이수 및 권한 재설정.',
    kpiSnapshot: { slaRate: 88.5, riskTop3: ['서울 서초구', '서울 강남구', '서울 관악구'], regionContext: '서울특별시' },
  },
  {
    id: 'ua_009',
    timestamp: '2026-01-05T10:00:00+09:00',
    type: 'policy_change',
    severity: 'high',
    status: 'resolved',
    title: '독거 가중치 1.2→1.35 조정 (이후 롤백)',
    actor: '박중앙',
    actorRole: '보건복지부 중앙관리자',
    target: '독거 노인 위험 가중치',
    cause: '독거 노인 위험도 과소평가 우려. 가중치 상향 시도.',
    relatedChangeId: 'chg_20260105',
    requestor: '박중앙 (보건복지부)',
    approver: '정책심의위',
    executor: '시스템 자동 적용',
    policyRef: '가중치 조정 운영지침 v2.0',
    internalStandardId: 'RULE-WT-001',
    approvalComment: '업무량 +22% 급증으로 1주 후 롤백 결정. SLA -2.2%p 악화 확인.',
    rationale: '가중치 상향 후 업무량 과다로 1주 후 롤백. SLA 악화 확인.',
    kpiSnapshot: { slaRate: 82.3, riskTop3: ['부산 해운대구', '대구 달서구', '경기 안산시'], regionContext: '전국' },
  },
];
