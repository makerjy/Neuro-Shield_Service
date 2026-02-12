import type { CentralKpiId } from './kpi.types';

export type CentralKpiCategory = '신호' | '영향' | '위험' | '준비' | '거버넌스';

export type CentralCenterPageId =
  | 'national-dashboard'
  | 'model-governance'
  | 'quality-monitoring'
  | 'compliance-audit';

export interface CentralKpiScreenLink {
  page: CentralCenterPageId;
  label: string;
  reason: string;
}

export interface CentralKpiHistoryItem {
  version: string;
  changedAt: string; // YYYY-MM-DD
  changedBy: string;
  definitionChange: string;
  formulaChange: string;
  impactedScreens: CentralCenterPageId[];
}

export interface CentralKpiStandard {
  id: CentralKpiId;
  category: CentralKpiCategory;
  scope: '중앙';
  definition: {
    what: string;
    why: string;
  };
  calculation: {
    numeratorLabel: string;
    denominatorLabel: string;
    includeRules: string[];
    excludeRules: string[];
  };
  interpretation: {
    high: string;
    low: string;
  };
  linkedModelStages: string[];
  usageScreens: CentralKpiScreenLink[];
  linkedTabs: CentralKpiScreenLink[];
  changeHistory: CentralKpiHistoryItem[];
  whyChecklist: string[];
}

export const CENTRAL_CENTER_PAGE_LABELS: Record<CentralCenterPageId, string> = {
  'national-dashboard': '전국운영대시보드',
  'model-governance': '모델/규칙 변경 관리',
  'quality-monitoring': '데이터&모델 품질',
  'compliance-audit': '규정 준수 및 감사',
};

export const CENTRAL_KPI_ORDER: CentralKpiId[] = [
  'SIGNAL_QUALITY',
  'POLICY_IMPACT',
  'BOTTLENECK_RISK',
  'DATA_READINESS',
  'GOVERNANCE_SAFETY',
];

export const CENTRAL_KPI_STANDARD: Record<CentralKpiId, CentralKpiStandard> = {
  SIGNAL_QUALITY: {
    id: 'SIGNAL_QUALITY',
    category: '신호',
    scope: '중앙',
    definition: {
      what: '중앙으로 수집된 전체 신호 중 실제 운영 의사결정에 활용 가능한 유효 신호 비율을 측정한다.',
      why: '중복·철회·무효 신호를 줄여 현장센터의 불필요한 개입을 막고, 파이프라인 초반 정확도를 유지하기 위해 필요하다.',
    },
    calculation: {
      numeratorLabel: '유효 신호 건수 (validSignals)',
      denominatorLabel: '전체 수집 신호 건수 (totalSignals)',
      includeRules: [
        'Stage0 이전 수집 완료 + 식별자 유효성 검증 통과 신호 포함',
        '동일 시민·동일 이벤트의 중복 제거 후 남은 대표 신호 포함',
        '행정 목적 사용 동의 상태가 유효한 신호만 포함',
      ],
      excludeRules: [
        '중복 등록 신호, 철회 신호, 무효 포맷 신호 제외',
        '테스트/시뮬레이션 계정 신호 제외',
        '집계 지연으로 아직 검증되지 않은 임시 신호 제외',
      ],
    },
    interpretation: {
      high: '높을수록 입력·검증 체계가 안정적이며, Stage0/Stage1의 선별 부담이 낮아진다.',
      low: '낮을수록 데이터 수집 품질 저하 또는 중복 유입 문제가 커져 초기 선별 효율이 떨어진다.',
    },
    linkedModelStages: ['Reach', 'Stage0', 'Stage1'],
    usageScreens: [
      { page: 'national-dashboard', label: '전국운영대시보드', reason: '상단 KPI 카드 및 지역 비교' },
      { page: 'quality-monitoring', label: '데이터&모델 품질', reason: '데이터 품질 Driver 추적' },
      { page: 'compliance-audit', label: '규정 준수 및 감사', reason: '신호 무효/누락 감사 근거 확인' },
    ],
    linkedTabs: [
      { page: 'model-governance', label: '변경관리', reason: '입력 규칙/검증 기준 변경 영향 확인' },
      { page: 'quality-monitoring', label: '품질', reason: '결측·중복·지연 원인 진단' },
      { page: 'compliance-audit', label: '감사', reason: '신호 제외 근거 및 책임 로그 검증' },
    ],
    changeHistory: [
      {
        version: 'v2.4',
        changedAt: '2026-02-03',
        changedBy: '중앙 데이터거버넌스',
        definitionChange: '“행정 활용 가능” 기준에 동의 유효 상태 항목 명시',
        formulaChange: '유효 신호 분자 집계에서 “검증 대기 신호” 자동 제외 규칙 추가',
        impactedScreens: ['national-dashboard', 'quality-monitoring', 'compliance-audit'],
      },
      {
        version: 'v2.3',
        changedAt: '2026-01-20',
        changedBy: '중앙 운영총괄',
        definitionChange: '중복 신호 처리 정책 문구를 “대표 신호 1건 유지”로 표준화',
        formulaChange: '중복 제거 키를 citizenId+eventDate 기준으로 통일',
        impactedScreens: ['national-dashboard', 'quality-monitoring'],
      },
      {
        version: 'v2.1',
        changedAt: '2025-11-18',
        changedBy: '품질관리 TF',
        definitionChange: '테스트 계정 데이터 제외 조건 명문화',
        formulaChange: '분모에서 테스트 계정 신호 제외',
        impactedScreens: ['national-dashboard', 'compliance-audit'],
      },
    ],
    whyChecklist: [
      '선택한 집계 기간(window)이 동일한지 확인',
      '분자(validSignals)와 분모(totalSignals)의 최신 집계 시각 확인',
      '포함/제외 규칙으로 제외된 신호 건수 확인',
      '최근 변경 이력 중 신호 검증 규칙 변경 여부 확인',
    ],
  },

  POLICY_IMPACT: {
    id: 'POLICY_IMPACT',
    category: '영향',
    scope: '중앙',
    definition: {
      what: '정책·규칙·모델 변경 이후 주요 운영 KPI가 얼마나 흔들렸는지 변동지수(0~100)로 측정한다.',
      why: '정책 변경의 품질을 사후 검증하고, 롤백/재조정 의사결정의 기준선을 확보하기 위해 필요하다.',
    },
    calculation: {
      numeratorLabel: '정책 영향 점수 합 (impactScore)',
      denominatorLabel: '정규화 최대 점수 (maxScore=100)',
      includeRules: [
        '배포 완료(deployed) 또는 롤백(rollback)된 변경 이벤트 포함',
        'SLA, 응답 적시율, 완료율, 데이터 충족률 변동분 반영',
        '영향 기간 내 전국 단위 KPI 변동만 반영',
      ],
      excludeRules: [
        '검토 중(reviewing) 또는 미배포(pending) 이벤트 제외',
        '정기 배치/시스템 점검으로 인한 비정책성 변동 제외',
        '단일 지역 한정 시험 이벤트는 전국지수에서 제외',
      ],
    },
    interpretation: {
      high: '높을수록 정책 변경 후 변동성이 커졌음을 의미하며, 안정화 조치가 필요할 수 있다.',
      low: '낮을수록 정책 변경이 운영에 안정적으로 흡수되었음을 의미한다.',
    },
    linkedModelStages: ['Stage1', 'L1', 'L2', 'Stage2'],
    usageScreens: [
      { page: 'national-dashboard', label: '전국운영대시보드', reason: '정책 영향 KPI 카드/추이 확인' },
      { page: 'model-governance', label: '모델/규칙 변경 관리', reason: '변경별 예측 대비 실제 영향 비교' },
      { page: 'compliance-audit', label: '규정 준수 및 감사', reason: '변경 승인·책임·사유 감사 추적' },
    ],
    linkedTabs: [
      { page: 'model-governance', label: '변경관리', reason: '변경 제안→승인→배포→평가 흐름 검증' },
      { page: 'quality-monitoring', label: '품질', reason: '변경 후 품질 이슈/드리프트 동반 여부 확인' },
      { page: 'compliance-audit', label: '감사', reason: '변경 승인 근거 및 사후 책임 이력 확인' },
    ],
    changeHistory: [
      {
        version: 'v3.0',
        changedAt: '2026-01-24',
        changedBy: '정책평가위원회',
        definitionChange: '“정책 영향” 범위에 모델 배포 이벤트를 명시적으로 포함',
        formulaChange: '영향 점수 가중치에 응답 적시율 항목(+0.2) 추가',
        impactedScreens: ['national-dashboard', 'model-governance', 'compliance-audit'],
      },
      {
        version: 'v2.6',
        changedAt: '2026-01-10',
        changedBy: '중앙 정책기획',
        definitionChange: '변경 후 7일 관찰 창(window)을 표준 기간으로 고정',
        formulaChange: '롤백 이벤트를 영향 점수에 별도 패널티로 반영',
        impactedScreens: ['model-governance', 'compliance-audit'],
      },
      {
        version: 'v2.2',
        changedAt: '2025-10-28',
        changedBy: '운영분석팀',
        definitionChange: '정책 영향의 해석 기준(높을수록 불안정) 문구 표준화',
        formulaChange: '정규화 상수 maxScore를 120→100으로 조정',
        impactedScreens: ['national-dashboard'],
      },
    ],
    whyChecklist: [
      '해당 기간에 반영된 배포/롤백 이벤트 목록 확인',
      '각 이벤트의 KPI 변동분과 가중치 반영값 확인',
      '정책 외 요인으로 분류된 변동이 제외됐는지 확인',
      '최근 공식 변경 이력에서 영향 점수 가중치 수정 여부 확인',
    ],
  },

  BOTTLENECK_RISK: {
    id: 'BOTTLENECK_RISK',
    category: '위험',
    scope: '중앙',
    definition: {
      what: 'SLA 위반, L2 적체, 재접촉 필요를 가중합하여 중앙 운영 병목 위험도를 0~100으로 측정한다.',
      why: '센터 처리 지연을 조기에 감지해 인력/프로세스 개입 우선순위를 정하기 위해 필요하다.',
    },
    calculation: {
      numeratorLabel: '가중 병목 점수 (weightedRisk)',
      denominatorLabel: '최대 위험 점수 (maxRisk=100)',
      includeRules: [
        'SLA 위반률, L2 backlog, 재접촉 필요율을 동일 기간으로 정렬 후 합산',
        '전국 집계 기준으로 센터별 위험값 가중 평균 포함',
        '미해결 상태 케이스만 위험 계산에 포함',
      ],
      excludeRules: [
        '완료/종결된 케이스는 적체 집계에서 제외',
        '테스트 경보 및 시스템 점검 중 생성된 이벤트 제외',
        '중복 재접촉 요청은 1건으로 병합',
      ],
    },
    interpretation: {
      high: '높을수록 병목이 누적되고 있어 중앙 개입(인력/규칙 조정)이 시급하다는 의미다.',
      low: '낮을수록 처리 흐름이 안정적이며 병목 누적 위험이 낮다는 의미다.',
    },
    linkedModelStages: ['L1', 'L2', 'Stage2', 'Stage3'],
    usageScreens: [
      { page: 'national-dashboard', label: '전국운영대시보드', reason: '리스크 Top5 및 지역 병목 비교' },
      { page: 'quality-monitoring', label: '데이터&모델 품질', reason: '운영 병목 Driver 기여도 분석' },
      { page: 'model-governance', label: '모델/규칙 변경 관리', reason: '병목 완화용 규칙 변경 검토' },
    ],
    linkedTabs: [
      { page: 'model-governance', label: '변경관리', reason: 'L2 기준점/재접촉 주기 정책 조정' },
      { page: 'quality-monitoring', label: '품질', reason: '병목 발생 Driver와 지표 임계치 점검' },
      { page: 'compliance-audit', label: '감사', reason: '긴급 개입의 근거와 책임 추적' },
    ],
    changeHistory: [
      {
        version: 'v2.8',
        changedAt: '2026-01-22',
        changedBy: '운영최적화위원회',
        definitionChange: '재접촉 필요 지표를 병목 핵심 구성요소로 승격',
        formulaChange: '가중치 SLA 0.45→0.40, L2Backlog 0.30→0.35 조정',
        impactedScreens: ['national-dashboard', 'quality-monitoring', 'model-governance'],
      },
      {
        version: 'v2.4',
        changedAt: '2025-12-15',
        changedBy: '중앙 운영본부',
        definitionChange: '“미해결 케이스만 반영” 조건을 명문화',
        formulaChange: '분자 집계에서 종료 케이스 제외 로직 추가',
        impactedScreens: ['national-dashboard', 'quality-monitoring'],
      },
      {
        version: 'v2.0',
        changedAt: '2025-09-30',
        changedBy: '초기 표준화 TF',
        definitionChange: '병목 위험 KPI 최초 표준 정의 수립',
        formulaChange: '3요소 가중합 공식 신규 도입',
        impactedScreens: ['national-dashboard'],
      },
    ],
    whyChecklist: [
      'SLA 위반률/L2 적체/재접촉 필요율 3요소 원시값 확인',
      '가중치 적용 후 최종 위험 점수 산출값 확인',
      '종결 케이스가 적체 계산에서 제외됐는지 확인',
      '최근 정책 변경으로 L2 유입량이 급증했는지 확인',
    ],
  },

  DATA_READINESS: {
    id: 'DATA_READINESS',
    category: '준비',
    scope: '중앙',
    definition: {
      what: '필수 데이터 항목과 연계 요건을 충족한 케이스의 비율을 측정한다.',
      why: '불완전 데이터로 인한 잘못된 분류·지연 개입을 방지하고, 모델 입력 신뢰도를 유지하기 위해 필요하다.',
    },
    calculation: {
      numeratorLabel: '준비 완료 케이스 수 (readyCases)',
      denominatorLabel: '전체 평가 대상 케이스 수 (totalCases)',
      includeRules: [
        '필수 필드(연락처·주소·동의정보·기본 프로파일) 충족 케이스 포함',
        '연계 시스템 키 매칭까지 완료된 케이스 포함',
        '집계 기간 내 신규/진행 케이스 포함',
      ],
      excludeRules: [
        '테스트/훈련용 케이스 제외',
        '취소/폐기 상태 케이스 제외',
        '필수 연계 키가 아직 생성되지 않은 임시 케이스 제외',
      ],
    },
    interpretation: {
      high: '높을수록 데이터 준비 상태가 양호해 모델 판정과 운영 개입의 신뢰도가 높다.',
      low: '낮을수록 결측·연계지연이 많아 잘못된 우선순위 결정 위험이 커진다.',
    },
    linkedModelStages: ['Stage0', 'Consent', 'L0', 'L1', 'L2'],
    usageScreens: [
      { page: 'national-dashboard', label: '전국운영대시보드', reason: '데이터 준비도 KPI 카드/지도 시각화' },
      { page: 'quality-monitoring', label: '데이터&모델 품질', reason: '결측/지연 지표 상세 진단' },
      { page: 'compliance-audit', label: '규정 준수 및 감사', reason: '필수 입력 누락 책임 추적' },
    ],
    linkedTabs: [
      { page: 'model-governance', label: '변경관리', reason: '입력 기준/필수 필드 변경 영향 검토' },
      { page: 'quality-monitoring', label: '품질', reason: '결측 필드/적시성 경고 해소' },
      { page: 'compliance-audit', label: '감사', reason: '필수 데이터 누락에 대한 조치 이력 검증' },
    ],
    changeHistory: [
      {
        version: 'v2.5',
        changedAt: '2026-01-18',
        changedBy: '데이터 표준화 위원회',
        definitionChange: '필수 연계 키 매칭 완료 조건을 준비도 정의에 추가',
        formulaChange: '분자 계산에 linkagePending 제외 규칙 추가',
        impactedScreens: ['national-dashboard', 'quality-monitoring', 'compliance-audit'],
      },
      {
        version: 'v2.2',
        changedAt: '2025-12-03',
        changedBy: '중앙 데이터관리',
        definitionChange: '동의 정보 유효성 검사 조건을 명문화',
        formulaChange: '동의 만료 케이스를 분자에서 제외',
        impactedScreens: ['national-dashboard', 'quality-monitoring'],
      },
      {
        version: 'v1.9',
        changedAt: '2025-08-21',
        changedBy: '운영품질팀',
        definitionChange: '취소/폐기 케이스 제외 규칙을 공식 반영',
        formulaChange: '분모에서 취소/폐기 케이스 제외',
        impactedScreens: ['national-dashboard'],
      },
    ],
    whyChecklist: [
      '준비 완료 케이스(readyCases)와 전체 대상(totalCases) 집계 기준 확인',
      '필수 필드 누락과 연계 대기 건수가 몇 건인지 확인',
      '취소/폐기/테스트 케이스 제외 처리 여부 확인',
      '최근 입력 기준 변경으로 준비도 분자가 변했는지 확인',
    ],
  },

  GOVERNANCE_SAFETY: {
    id: 'GOVERNANCE_SAFETY',
    category: '거버넌스',
    scope: '중앙',
    definition: {
      what: '감사·민원 대응에 필요한 근거(로그·설명·책임자)가 모두 갖춰진 케이스 비율을 측정한다.',
      why: '사후 책임소재와 의사결정 정당성을 입증하고, 규정 위반 리스크를 선제적으로 낮추기 위해 필요하다.',
    },
    calculation: {
      numeratorLabel: '감사 준비 완료 건수 (auditReady)',
      denominatorLabel: '감사 대상 전체 건수 (totalAuditable)',
      includeRules: [
        '책임자, 타임스탬프, 변경사유, 근거문서 링크가 모두 존재하는 케이스 포함',
        '정책 변경/긴급 개입/모델 배포 이력 포함',
        '감사 대상 기간 내 생성·변경 이력 포함',
      ],
      excludeRules: [
        '시스템 heartbeat 로그와 운영 무관 이벤트 제외',
        '테스트 시나리오 및 샌드박스 이벤트 제외',
        '감사 대상 기간 밖의 과거 아카이브 이벤트 제외',
      ],
    },
    interpretation: {
      high: '높을수록 감사 대응력과 책임 추적 가능성이 높고, 규정 준수 상태가 안정적이다.',
      low: '낮을수록 근거 누락/책임자 미기재가 많아 감사·민원 리스크가 커진다.',
    },
    linkedModelStages: ['Stage2', 'Stage3', 'PolicyChange'],
    usageScreens: [
      { page: 'national-dashboard', label: '전국운영대시보드', reason: '거버넌스 안전 KPI 요약 모니터링' },
      { page: 'compliance-audit', label: '규정 준수 및 감사', reason: '위반/조치/근거 상세 추적' },
      { page: 'model-governance', label: '모델/규칙 변경 관리', reason: '승인/배포 의사결정 근거 검증' },
    ],
    linkedTabs: [
      { page: 'model-governance', label: '변경관리', reason: '변경 승인·배포 절차 준수 확인' },
      { page: 'quality-monitoring', label: '품질', reason: '로그 누락/근거 누락 패턴 탐지' },
      { page: 'compliance-audit', label: '감사', reason: '규정 위반 이벤트와 책임자 추적' },
    ],
    changeHistory: [
      {
        version: 'v3.1',
        changedAt: '2026-01-26',
        changedBy: '중앙 감사실',
        definitionChange: '“설명근거 링크” 항목을 필수 근거로 승격',
        formulaChange: '분자 조건에 missingExplanation=0 제약 추가',
        impactedScreens: ['national-dashboard', 'compliance-audit', 'model-governance'],
      },
      {
        version: 'v2.9',
        changedAt: '2026-01-09',
        changedBy: '규정준수팀',
        definitionChange: '책임자 미기재 이벤트를 거버넌스 결함으로 분류',
        formulaChange: '분자 집계에서 missingResponsible>0 케이스 제외',
        impactedScreens: ['compliance-audit', 'national-dashboard'],
      },
      {
        version: 'v2.4',
        changedAt: '2025-10-10',
        changedBy: '보안감사위원회',
        definitionChange: '감사 대상 기간을 최근 30일 누적으로 표준화',
        formulaChange: '분모를 최근 30일 감사대상 건수로 고정',
        impactedScreens: ['national-dashboard', 'compliance-audit'],
      },
    ],
    whyChecklist: [
      '감사 준비 완료(auditReady) 건수와 전체 감사대상(totalAuditable) 확인',
      '근거 누락(missingExplanation)과 책임자 누락(missingResponsible) 건수 확인',
      '테스트/비운영 이벤트가 분모에서 제외됐는지 확인',
      '최근 감사정책 변경으로 필수 근거 항목이 바뀌었는지 확인',
    ],
  },
};

export function getCentralKpiStandardById(id: CentralKpiId): CentralKpiStandard {
  return CENTRAL_KPI_STANDARD[id];
}

export function getCentralKpiStandardList(): CentralKpiStandard[] {
  return CENTRAL_KPI_ORDER.map((id) => CENTRAL_KPI_STANDARD[id]);
}

