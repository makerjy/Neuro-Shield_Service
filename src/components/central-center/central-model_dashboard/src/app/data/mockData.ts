// 중앙관리센터 모델 적용 대시보드 모의 데이터

// 전역 상태
export const globalStatus = {
  totalSubjects: 1247653,
  primaryScreeningRate: 87.3,
  secondaryScreeningRate: 12.6,
  conversionRate: 14.4,
  centerCount: { basic: 235, regional: 17 },
  primaryStatus: {
    normal: 72.4,
    caution: 15.3,
    abnormal: 12.3
  }
};

// 파이프라인 단계
export const pipelineStages = [
  {
    id: 'total',
    label: '대상자 전체',
    count: 1247653,
    percentage: 100,
    conversionRate: null,
    avgDuration: null
  },
  {
    id: 'primary',
    label: '1차 검사 적용',
    count: 1089353,
    percentage: 87.3,
    conversionRate: 87.3,
    avgDuration: '3.2일'
  },
  {
    id: 'primaryRisk',
    label: '1차 고위험 판정',
    count: 156887,
    percentage: 12.6,
    conversionRate: 14.4,
    avgDuration: '5.7일'
  },
  {
    id: 'secondary',
    label: '2차 검사 진행',
    count: 157204,
    percentage: 12.6,
    conversionRate: 100.2,
    avgDuration: '18.3일'
  },
  {
    id: 'final',
    label: '2차 확정/비확정',
    count: 147856,
    percentage: 11.8,
    conversionRate: 94.1,
    avgDuration: '22.1일'
  }
];

// 1차 검사 데이터
export const primaryScreeningData = {
  applied: 87.3,
  notApplied: 12.7,
  byAge: [
    { ageGroup: '60-64세', applied: 456234, notApplied: 34532 },
    { ageGroup: '65-69세', applied: 378921, notApplied: 42156 },
    { ageGroup: '70-74세', applied: 189456, notApplied: 51234 },
    { ageGroup: '75세+', applied: 64742, notApplied: 30378 }
  ],
  notAppliedReasons: [
    { reason: '데이터 미수집', count: 89234, percentage: 56.3 },
    { reason: '기준 미충족', count: 45678, percentage: 28.8 },
    { reason: '행정보류', count: 23388, percentage: 14.9 }
  ]
};

// 2차 검사 데이터
export const secondaryScreeningData = {
  status: [
    { status: '진행 중', count: 9348, percentage: 5.9 },
    { status: '대기', count: 4712, percentage: 3.0 },
    { status: '완료', count: 143144, percentage: 91.1 }
  ],
  byType: [
    { type: 'PET', count: 45234 },
    { type: 'MRI', count: 67823 },
    { type: 'MRI+PET', count: 23456 },
    { type: 'Biomarker', count: 20691 }
  ],
  results: [
    { result: '고위험', count: 34567, percentage: 23.4 },
    { result: '경계', count: 56789, percentage: 38.4 },
    { result: '비해당', count: 56500, percentage: 38.2 }
  ]
};

// 지역/센터 데이터
export const regionalData = [
  {
    region: '서울',
    centers: 28,
    subjects: 187234,
    primaryRate: 91.2,
    secondaryConversion: 15.3,
    highRiskRate: 24.1,
    avgProcessingDays: 19.8
  },
  {
    region: '경기',
    centers: 34,
    subjects: 245678,
    primaryRate: 89.4,
    secondaryConversion: 14.8,
    highRiskRate: 22.8,
    avgProcessingDays: 20.3
  },
  {
    region: '인천',
    centers: 12,
    subjects: 67834,
    primaryRate: 88.1,
    secondaryConversion: 13.9,
    highRiskRate: 23.5,
    avgProcessingDays: 21.2
  },
  {
    region: '부산',
    centers: 18,
    subjects: 98234,
    primaryRate: 86.7,
    secondaryConversion: 13.2,
    highRiskRate: 22.1,
    avgProcessingDays: 22.1
  },
  {
    region: '대구',
    centers: 14,
    subjects: 67123,
    primaryRate: 85.3,
    secondaryConversion: 12.7,
    highRiskRate: 21.9,
    avgProcessingDays: 21.8
  },
  {
    region: '광주',
    centers: 11,
    subjects: 54321,
    primaryRate: 84.9,
    secondaryConversion: 12.3,
    highRiskRate: 21.2,
    avgProcessingDays: 23.4
  },
  {
    region: '대전',
    centers: 10,
    subjects: 48765,
    primaryRate: 87.6,
    secondaryConversion: 13.8,
    highRiskRate: 22.7,
    avgProcessingDays: 20.8
  },
  {
    region: '울산',
    centers: 8,
    subjects: 34567,
    primaryRate: 88.9,
    secondaryConversion: 14.2,
    highRiskRate: 23.1,
    avgProcessingDays: 19.9
  },
  {
    region: '세종',
    centers: 4,
    subjects: 12345,
    primaryRate: 90.1,
    secondaryConversion: 15.1,
    highRiskRate: 24.8,
    avgProcessingDays: 18.7
  },
  {
    region: '강원',
    centers: 18,
    subjects: 45678,
    primaryRate: 82.1,
    secondaryConversion: 11.2,
    highRiskRate: 19.8,
    avgProcessingDays: 24.5
  },
  {
    region: '충북',
    centers: 13,
    subjects: 43210,
    primaryRate: 83.4,
    secondaryConversion: 11.8,
    highRiskRate: 20.4,
    avgProcessingDays: 23.9
  },
  {
    region: '충남',
    centers: 16,
    subjects: 56789,
    primaryRate: 84.2,
    secondaryConversion: 12.1,
    highRiskRate: 20.9,
    avgProcessingDays: 22.7
  },
  {
    region: '전북',
    centers: 15,
    subjects: 52341,
    primaryRate: 83.8,
    secondaryConversion: 11.9,
    highRiskRate: 20.6,
    avgProcessingDays: 23.2
  },
  {
    region: '전남',
    centers: 19,
    subjects: 51234,
    primaryRate: 81.9,
    secondaryConversion: 10.8,
    highRiskRate: 19.4,
    avgProcessingDays: 25.1
  },
  {
    region: '경북',
    centers: 21,
    subjects: 67890,
    primaryRate: 82.7,
    secondaryConversion: 11.4,
    highRiskRate: 19.9,
    avgProcessingDays: 24.3
  },
  {
    region: '경남',
    centers: 19,
    subjects: 89012,
    primaryRate: 85.6,
    secondaryConversion: 12.9,
    highRiskRate: 21.7,
    avgProcessingDays: 22.5
  },
  {
    region: '제주',
    center: 6,
    subjects: 21398,
    primaryRate: 89.7,
    secondaryConversion: 14.5,
    highRiskRate: 23.8,
    avgProcessingDays: 20.1
  }
];

// 연령 코호트 데이터
export const ageCohortsData = [
  {
    ageGroup: '60-64세',
    primaryRate: 93.0,
    secondaryEntry: 15.8,
    highRiskRate: 18.2,
    subjects: 490766
  },
  {
    ageGroup: '65-69세',
    primaryRate: 90.0,
    secondaryEntry: 14.3,
    highRiskRate: 22.1,
    subjects: 421077
  },
  {
    ageGroup: '70-74세',
    primaryRate: 78.7,
    secondaryEntry: 11.2,
    highRiskRate: 27.8,
    subjects: 240690
  },
  {
    ageGroup: '75세+',
    primaryRate: 68.1,
    secondaryEntry: 8.4,
    highRiskRate: 32.3,
    subjects: 95120
  }
];

// 모델 설명가능성 데이터 (SHAP 스타일: 양수는 위험 증가, 음수는 위험 감소)
export const modelExplainabilityData = [
  { factor: '나이', impact: 28.3 },
  { factor: 'BMI 지수', impact: 15.2 },
  { factor: '만성질환 여부', impact: 12.8 },
  { factor: '가족력', impact: 10.4 },
  { factor: '이전 검사 이력', impact: -18.7 },
  { factor: '생활습관 점수', impact: -12.3 },
  { factor: '정기 건강관리', impact: -8.5 },
  { factor: '운동 빈도', impact: -6.2 }
];

// 정책 로그
export const policyLogs = [
  {
    id: 'log-001',
    version: 'v2.3.1',
    description: '2차 검사 전환 기준 완화',
    appliedDate: '2026-01-15',
    category: '기준 변경'
  },
  {
    id: 'log-002',
    version: 'v2.3.0',
    description: '연령별 가중치 조정',
    appliedDate: '2025-12-20',
    category: '모델 업데이트'
  },
  {
    id: 'log-003',
    version: 'v2.2.5',
    description: '지역별 표준편차 기준 추가',
    appliedDate: '2025-11-05',
    category: '기준 변경'
  },
  {
    id: 'log-004',
    version: 'v2.2.0',
    description: '바이오마커 검사 추가',
    appliedDate: '2025-10-01',
    category: '검사 항목'
  },
  {
    id: 'log-005',
    version: 'v2.1.3',
    description: '데이터 수집 기준 명확화',
    appliedDate: '2025-09-12',
    category: '정책 수정'
  }
];