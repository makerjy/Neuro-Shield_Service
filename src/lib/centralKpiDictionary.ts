/* ═══════════════════════════════════════════════════════════════════════════════
   중앙센터(보건복지부) KPI 사전 — 5대 거버넌스 KPI
   ═══════════════════════════════════════════════════════════════════════════════
   - 5개 핵심 KPI: 단일 진실 공급원 (Single Source of Truth)
   - 모든 KPI는 numerator / denominator / window / drillToken 필수
   - AI 진단 문구 금지: 위험 신호 / 참고 / 관리 경로 / 권장만 허용
═══════════════════════════════════════════════════════════════════════════════ */

import type { CentralKpiDefinition, CentralKpiId } from './kpi.types';

export const CENTRAL_KPI_DICTIONARY: Record<CentralKpiId, CentralKpiDefinition> = {
  /* ── 1. 신호 품질 ──────────────────────────────────── */
  SIGNAL_QUALITY: {
    id: 'SIGNAL_QUALITY',
    name: '신호 품질',
    shortName: '신호 품질',
    description: '유효 신호 비율: 행정적으로 활용 가능한 신호의 비율 (중복·철회·무효 제외)',
    formula: 'ValidSignals / TotalSignals × 100',
    numeratorField: 'validSignals',
    denominatorField: 'totalSignals',
    unit: '%',
    higherBetter: true,
    baseline: 88,
    target: 95,
    drillToken: 'VALID_SIGNALS',
  },

  /* ── 2. 정책 영향 ──────────────────────────────────── */
  POLICY_IMPACT: {
    id: 'POLICY_IMPACT',
    name: '정책 영향',
    shortName: '정책 영향',
    description: '정책/규칙 변경 후 KPI 변동지수 (정규화 스코어 0-100)',
    formula: 'PolicyChangeImpactScore (정규화)',
    numeratorField: 'impactScore',
    denominatorField: 'maxScore',
    unit: '%',
    higherBetter: false,   // 높으면 변동이 크다 = 불안정
    baseline: 35,
    target: 20,
    drillToken: 'POLICY_IMPACT_SCORE',
    auxiliaryKeys: ['rollbackCount', 'warningRegions'],
  },

  /* ── 3. 병목 위험 ──────────────────────────────────── */
  BOTTLENECK_RISK: {
    id: 'BOTTLENECK_RISK',
    name: '병목 위험',
    shortName: '병목 위험',
    description: 'SLA 위반·적체·재접촉 필요의 가중합 (0-100 스케일)',
    formula: '(SLAViolation×0.4 + L2Backlog×0.35 + RecontactNeed×0.25)',
    numeratorField: 'weightedRisk',
    denominatorField: 'maxRisk',
    unit: '%',
    higherBetter: false,
    baseline: 45,
    target: 30,
    drillToken: 'BOTTLENECK_SCORE',
    auxiliaryKeys: ['slaViolationRate', 'l2BacklogCount'],
  },

  /* ── 4. 데이터 준비도 ──────────────────────────────── */
  DATA_READINESS: {
    id: 'DATA_READINESS',
    name: '데이터 준비도',
    shortName: '데이터 준비',
    description: '필수 데이터 기준을 충족하는 케이스 비율',
    formula: 'ReadyCases / TotalCases × 100',
    numeratorField: 'readyCases',
    denominatorField: 'totalCases',
    unit: '%',
    higherBetter: true,
    baseline: 85,
    target: 95,
    drillToken: 'DATA_READY_CASES',
    auxiliaryKeys: ['missingFieldRate', 'linkagePendingRate'],
  },

  /* ── 5. 거버넌스 안전 ──────────────────────────────── */
  GOVERNANCE_SAFETY: {
    id: 'GOVERNANCE_SAFETY',
    name: '거버넌스 안전',
    shortName: '거버넌스',
    description: '감사·민원 대응 시 필수 근거가 확보된 비율 (로그·설명근거·책임자)',
    formula: 'AuditReady / TotalAuditable × 100',
    numeratorField: 'auditReady',
    denominatorField: 'totalAuditable',
    unit: '%',
    higherBetter: true,
    baseline: 90,
    target: 98,
    drillToken: 'AUDIT_READY',
    auxiliaryKeys: ['missingResponsible', 'missingExplanation'],
  },
};

/* ─────────────────────────────────────────────────────────────
   편의 함수
───────────────────────────────────────────────────────────── */

/** 모든 중앙 KPI를 배열로 반환 */
export function getCentralKpiList(): CentralKpiDefinition[] {
  return Object.values(CENTRAL_KPI_DICTIONARY);
}

/** ID로 KPI 정의 조회 */
export function getCentralKpiById(id: CentralKpiId): CentralKpiDefinition {
  return CENTRAL_KPI_DICTIONARY[id];
}

/** Funnel 단계 레이블 상수 */
export const FUNNEL_STAGE_LABELS: { stage: string; label: string; color: string }[] = [
  { stage: 'Reach',    label: '접근(Reach)',     color: '#94a3b8' },
  { stage: 'Stage0',   label: '0차 스크리닝',    color: '#60a5fa' },
  { stage: 'Stage1',   label: '1차 위험 신호',    color: '#3b82f6' },
  { stage: 'Consent',  label: '동의 획득',        color: '#8b5cf6' },
  { stage: 'L0',       label: 'L0 자동배정',      color: '#a78bfa' },
  { stage: 'L1',       label: 'L1 일반상담',      color: '#c084fc' },
  { stage: 'L2',       label: 'L2 심층상담',      color: '#e879f9' },
  { stage: 'Stage2',   label: '2차 연결',         color: '#22c55e' },
  { stage: 'Stage3',   label: '3차 추적관리',     color: '#14b8a6' },
];

/** KPI 카드 색상 매핑 */
export const CENTRAL_KPI_COLORS: Record<CentralKpiId, { bg: string; text: string; border: string; icon: string; hex: string }> = {
  SIGNAL_QUALITY:     { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-300',    icon: '📡', hex: '#2563eb' },
  POLICY_IMPACT:      { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-300',  icon: '📋', hex: '#7c3aed' },
  BOTTLENECK_RISK:    { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-300',     icon: '⚠️', hex: '#dc2626' },
  DATA_READINESS:     { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', icon: '📊', hex: '#059669' },
  GOVERNANCE_SAFETY:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300',   icon: '🛡️', hex: '#d97706' },
};
