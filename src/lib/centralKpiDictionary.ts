/* ═══════════════════════════════════════════════════════════════════════════════
   중앙센터(보건복지부) KPI 사전 — Stage0~3 + L0~L2 운영감사형
   ═══════════════════════════════════════════════════════════════════════════════
   - 5개 핵심 KPI: 단일 진실 공급원 (Single Source of Truth)
   - 모든 KPI는 numerator / denominator / window / drillToken 필수
   - AI 진단 문구 금지: 위험 신호 / 참고 / 관리 경로 / 권장만 허용
═══════════════════════════════════════════════════════════════════════════════ */

import type { CentralKpiDefinition, CentralKpiId } from './kpi.types';

export const CENTRAL_KPI_DICTIONARY: Record<CentralKpiId, CentralKpiDefinition> = {
  /* ── 1. 위험 신호 탐지율 ──────────────────────────────────── */
  RISK_SIGNAL_DETECTION: {
    id: 'RISK_SIGNAL_DETECTION',
    name: '위험 신호 탐지율',
    shortName: '신호 탐지',
    description: 'Stage0 처리 건수 중 Stage1 위험 신호로 플래그된 비율',
    formula: 'Stage1Flagged / Stage0Processed × 100',
    numeratorField: 'stage1Flagged',
    denominatorField: 'stage0Processed',
    unit: '%',
    higherBetter: false,    // 높으면 위험 신호 많다는 뜻 → 감시 지표
    baseline: 12,
    target: 15,             // 15% 이하 유지 권장
    drillToken: 'STAGE1_FLAGGED',
  },

  /* ── 2. 동의 전환율 ──────────────────────────────────────── */
  CONSENT_CONVERSION: {
    id: 'CONSENT_CONVERSION',
    name: '동의 전환율',
    shortName: '동의 전환',
    description: 'Stage1 플래그 건 중 동의(ConsentGranted)로 전환된 비율 + median(Flagged→Granted) 리드타임',
    formula: 'ConsentGranted / Stage1Flagged × 100',
    numeratorField: 'consentGranted',
    denominatorField: 'stage1Flagged',
    unit: '%',
    higherBetter: true,
    baseline: 55,
    target: 70,
    drillToken: 'CONSENT_GRANTED',
    auxiliaryKeys: ['medianFlaggedToGrantedDays'],
  },

  /* ── 3. L2 적체율 ────────────────────────────────────────── */
  L2_QUEUE_BACKLOG: {
    id: 'L2_QUEUE_BACKLOG',
    name: 'L2 적체율',
    shortName: 'L2 적체',
    description: 'L2 대기열 잔여 건수 / L2 배정 건수 + first-action latency 분포',
    formula: 'L2QueueBacklog / L2Assigned × 100',
    numeratorField: 'l2QueueBacklog',
    denominatorField: 'l2Assigned',
    unit: '%',
    higherBetter: false,
    baseline: 25,
    target: 15,
    drillToken: 'L2_FIRST_ACTION_TAKEN',
    auxiliaryKeys: ['firstActionLatencyMedianHours', 'backlogCount'],
  },

  /* ── 4. 2차 연결률 ───────────────────────────────────────── */
  STAGE2_LINKAGE: {
    id: 'STAGE2_LINKAGE',
    name: '2차 연결률',
    shortName: '2차 연결',
    description: 'Stage2 신청 건 중 실제 연결(LinkedOutcome) 비율 + 병목 원인 + median 리드타임',
    formula: 'Stage2LinkedOutcome / Stage2Applied × 100',
    numeratorField: 'stage2Linked',
    denominatorField: 'stage2Applied',
    unit: '%',
    higherBetter: true,
    baseline: 60,
    target: 75,
    drillToken: 'STAGE2_LINKED',
    auxiliaryKeys: ['medianAppliedToLinkedDays', 'blockedCount', 'blockedReasons'],
  },

  /* ── 5. MCI 추적등록률 ───────────────────────────────────── */
  MCI_FOLLOWUP_ENROLL: {
    id: 'MCI_FOLLOWUP_ENROLL',
    name: 'MCI 추적등록률',
    shortName: 'MCI 등록',
    description: 'Stage2 관리 경로(MCI_TRACK) 설정 건 중 추적등록(FollowupEnrolled) 비율',
    formula: 'FollowupEnrolled / Stage2CarePathway(MCI_TRACK) × 100',
    numeratorField: 'followupEnrolled',
    denominatorField: 'stage2MciTrack',
    unit: '%',
    higherBetter: true,
    baseline: 40,
    target: 60,
    drillToken: 'FOLLOWUP_ENROLLED',
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
export const CENTRAL_KPI_COLORS: Record<CentralKpiId, { bg: string; text: string; border: string; icon: string }> = {
  RISK_SIGNAL_DETECTION: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', icon: '🔍' },
  CONSENT_CONVERSION:    { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-300', icon: '✅' },
  L2_QUEUE_BACKLOG:      { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', icon: '⏳' },
  STAGE2_LINKAGE:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', icon: '🔗' },
  MCI_FOLLOWUP_ENROLL:   { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', icon: '📋' },
};
