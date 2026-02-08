/**
 * interventionStore.ts
 * ─────────────────────────────────────────────────────────
 * 병목 시그널 + 개입 계획 + 프로그램 번들의
 * 타입 정의 · 더미 시드 · localStorage CRUD
 * ─────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════
// 1. 타입
// ═══════════════════════════════════════════════════════════

export type BottleneckType =
  | 'CONTACT_FAIL'
  | 'NO_SHOW'
  | 'LINK_DELAY'
  | 'WORKLOAD'
  | 'TRAINING_GAP'
  | 'PROCESS_GAP';

export type Impact = 'HIGH' | 'MEDIUM' | 'LOW';

export interface BottleneckEvidence {
  kpi: string;
  value?: number | string;
  trend?: 'UP' | 'DOWN';
  note?: string;
}

export interface BottleneckSignal {
  id: string;
  region: string;
  centerId: string;
  centerName: string;
  weakKpis: string[];
  bottleneckType: BottleneckType;
  impact: Impact;
  evidence: BottleneckEvidence[];
  updatedAt: string;
}

export type InterventionType = 'TRAINING' | 'STAFFING' | 'PROCESS';
export type PlanStatus = 'DRAFT' | 'APPROVED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';
export type PlanCreatedBy = 'AI' | 'ADMIN_EDIT' | 'ADMIN_MANUAL';

export interface InterventionPlan {
  id: string;
  region: string;
  centerId: string;
  centerName: string;
  linkedBottleneckId?: string;
  linkedKpis: string[];
  type: InterventionType;
  title: string;
  description: string;
  staffingAction?: string;
  trainingAction?: string;
  processAction?: string;
  durationDays?: number;
  priority: Impact;
  status: PlanStatus;
  createdBy: PlanCreatedBy;
  adminMemo?: string;
  approvedAt?: string;
  dueAt?: string;
  updatedAt: string;
}

export interface ProgramBundle {
  id: string;
  title: string;
  summary: string;
  includedPlans: string[];
  status: PlanStatus;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════
// 2. 라벨 유틸리티
// ═══════════════════════════════════════════════════════════

export const BOTTLENECK_TYPE_LABELS: Record<BottleneckType, string> = {
  CONTACT_FAIL: '접촉 실패',
  NO_SHOW: '노쇼',
  LINK_DELAY: '연계 지연',
  WORKLOAD: '과부하',
  TRAINING_GAP: '교육 격차',
  PROCESS_GAP: '프로세스 결함',
};

export const IMPACT_LABELS: Record<Impact, string> = { HIGH: '높음', MEDIUM: '중간', LOW: '낮음' };
export const STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: '초안', APPROVED: '승인', IN_PROGRESS: '시행중', DONE: '완료', REJECTED: '반려',
};
export const TYPE_LABELS: Record<InterventionType, string> = {
  TRAINING: '교육', STAFFING: '인력', PROCESS: '프로세스',
};

export const STATUS_COLORS: Record<PlanStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-300',
  APPROVED: 'bg-blue-100 text-blue-700 border-blue-300',
  IN_PROGRESS: 'bg-purple-100 text-purple-700 border-purple-300',
  DONE: 'bg-green-100 text-green-700 border-green-300',
  REJECTED: 'bg-red-100 text-red-700 border-red-300',
};

export const IMPACT_COLORS: Record<Impact, string> = {
  HIGH: 'bg-red-50 text-red-800 border-red-300',
  MEDIUM: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  LOW: 'bg-green-50 text-green-800 border-green-300',
};

// ═══════════════════════════════════════════════════════════
// 3. 시드(더미) 데이터
// ═══════════════════════════════════════════════════════════

const now = () => new Date().toISOString();

export function seedBottlenecks(region: string): BottleneckSignal[] {
  return [
    {
      id: 'BN-001', region, centerId: 'CENTER-001', centerName: '송파구 치매안심센터',
      weakKpis: ['이탈률', '접촉률'],
      bottleneckType: 'CONTACT_FAIL', impact: 'HIGH',
      evidence: [
        { kpi: '접촉 성공률', value: -3.2, trend: 'DOWN', note: '2개월 연속 하락' },
        { kpi: '이탈률', value: +12.9, trend: 'UP', note: '인력 공백 영향' },
      ],
      updatedAt: '2026-02-03T09:00:00Z',
    },
    {
      id: 'BN-002', region, centerId: 'CENTER-002', centerName: '강남구 치매안심센터',
      weakKpis: ['연계 지연', '노쇼율'],
      bottleneckType: 'NO_SHOW', impact: 'MEDIUM',
      evidence: [
        { kpi: '노쇼율', value: 18.5, trend: 'UP', note: '예약 확인 미흡' },
        { kpi: '연계율', value: -2.1, trend: 'DOWN' },
      ],
      updatedAt: '2026-02-02T09:00:00Z',
    },
    {
      id: 'BN-003', region, centerId: 'CENTER-003', centerName: '서초구 치매안심센터',
      weakKpis: ['노쇼율'],
      bottleneckType: 'PROCESS_GAP', impact: 'MEDIUM',
      evidence: [
        { kpi: '노쇼율', value: 15.2, trend: 'UP', note: '리마인더 미발송' },
      ],
      updatedAt: '2026-02-01T09:00:00Z',
    },
    {
      id: 'BN-004', region, centerId: 'CENTER-005', centerName: '마포구 치매안심센터',
      weakKpis: ['이탈률'],
      bottleneckType: 'WORKLOAD', impact: 'HIGH',
      evidence: [
        { kpi: '이탈률', value: +9.4, trend: 'UP', note: '케이스 급증(+40%)' },
        { kpi: '상담 완료율', value: -6.3, trend: 'DOWN' },
      ],
      updatedAt: '2026-02-04T09:00:00Z',
    },
    {
      id: 'BN-005', region, centerId: 'CENTER-004', centerName: '강동구 치매안심센터',
      weakKpis: ['우수'],
      bottleneckType: 'TRAINING_GAP', impact: 'LOW',
      evidence: [
        { kpi: '전체', note: '양호 — 우수사례 확산 후보' },
      ],
      updatedAt: '2026-02-04T09:00:00Z',
    },
  ];
}

// ═══════════════════════════════════════════════════════════
// 4. localStorage CRUD
// ═══════════════════════════════════════════════════════════

const PLANS_KEY = (region: string) => `neuroshield_plans_${region}`;
const BUNDLES_KEY = (region: string) => `neuroshield_bundles_${region}`;

// ─── Plans ───
export function loadPlans(region: string): InterventionPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY(region));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function savePlans(region: string, plans: InterventionPlan[]) {
  localStorage.setItem(PLANS_KEY(region), JSON.stringify(plans));
}

export function upsertPlan(region: string, plan: InterventionPlan): InterventionPlan[] {
  const plans = loadPlans(region);
  const idx = plans.findIndex(p => p.id === plan.id);
  if (idx >= 0) plans[idx] = plan; else plans.push(plan);
  savePlans(region, plans);
  return plans;
}

export function deletePlan(region: string, planId: string): InterventionPlan[] {
  const plans = loadPlans(region).filter(p => p.id !== planId);
  savePlans(region, plans);
  return plans;
}

/** 상태 전이 + 타임스탬프 자동 기록 */
export function transitionPlanStatus(
  region: string,
  planId: string,
  newStatus: PlanStatus,
  memo?: string,
): InterventionPlan[] {
  const plans = loadPlans(region);
  const plan = plans.find(p => p.id === planId);
  if (!plan) return plans;
  plan.status = newStatus;
  plan.updatedAt = now();
  if (newStatus === 'APPROVED') plan.approvedAt = now();
  if (newStatus === 'REJECTED' && memo) plan.adminMemo = memo;
  savePlans(region, plans);
  return plans;
}

// ─── Bundles ───
export function loadBundles(region: string): ProgramBundle[] {
  try {
    const raw = localStorage.getItem(BUNDLES_KEY(region));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveBundles(region: string, bundles: ProgramBundle[]) {
  localStorage.setItem(BUNDLES_KEY(region), JSON.stringify(bundles));
}

// ─── CSV/JSON 내보내기 ───
export function exportPlansAsJson(plans: InterventionPlan[]) {
  const blob = new Blob([JSON.stringify(plans, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intervention_plans_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPlansAsCsv(plans: InterventionPlan[]) {
  const headers = ['ID', '센터', '유형', '제목', '우선순위', '상태', '생성자', '승인일', '마감일', '갱신일'];
  const rows = plans.map(p => [
    p.id, p.centerName, TYPE_LABELS[p.type], p.title,
    IMPACT_LABELS[p.priority], STATUS_LABELS[p.status], p.createdBy,
    p.approvedAt ?? '', p.dueAt ?? '', p.updatedAt,
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intervention_plans_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 유니크 ID 생성 */
export function genId(prefix = 'PLAN') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
