import type {
  AssignmentPolicy,
  CausePolicy,
  KpiKey,
  OwnerOrg,
  ThresholdPolicy,
} from './opsContracts';

export const CAUSE_POLICIES: CausePolicy[] = [
  {
    causeKey: 'staff_shortage',
    ownerOrg: 'center',
    actionable: true,
    regionalNeed: 'high',
    escalationPath: [
      { toOrgRole: 'centerLead', channel: 'internal', slaHours: 12 },
      { toOrgRole: 'regionalDutyOfficer', channel: 'email', slaHours: 24 },
    ],
    defaultActions: [
      {
        title: '담당 인력 우선 재배치',
        steps: ['상위 2개 구역 담당 인력 재배치', '48시간 후 재측정'],
        expectedEffectTags: ['SLA 개선', '적체 해소'],
      },
    ],
  },
  {
    causeKey: 'contact_failure',
    ownerOrg: 'center',
    actionable: true,
    regionalNeed: 'high',
    escalationPath: [
      { toOrgRole: 'centerLead', channel: 'internal', slaHours: 12 },
      { toOrgRole: 'regionalCallOps', channel: 'sms', slaHours: 24 },
    ],
    defaultActions: [
      {
        title: '재접촉 자동화 확대',
        steps: ['고실패 시간대 재배치', '자동 재시도 횟수 상향'],
        expectedEffectTags: ['SLA 개선', '적체 해소'],
      },
    ],
  },
  {
    causeKey: 'hospital_slot_delay',
    ownerOrg: 'hospital',
    actionable: false,
    regionalNeed: 'high',
    escalationPath: [
      { toOrgRole: 'hospitalLead', channel: 'email', slaHours: 12 },
      { toOrgRole: 'regionalPartnershipManager', channel: 'internal', slaHours: 24 },
    ],
    defaultActions: [
      {
        title: '검사 슬롯 증설 요청',
        steps: ['협약 병원 슬롯 확보 요청', '우선 순위 대상 재할당'],
        expectedEffectTags: ['감별검사 지연 감소', 'SLA 개선'],
      },
    ],
  },
  {
    causeKey: 'data_gap',
    ownerOrg: 'system',
    actionable: true,
    regionalNeed: 'medium',
    escalationPath: [
      { toOrgRole: 'systemOps', channel: 'internal', slaHours: 24 },
      { toOrgRole: 'regionalDataSteward', channel: 'email', slaHours: 48 },
    ],
    defaultActions: [
      {
        title: '필수 필드 보완 요청',
        steps: ['누락 필드 재수집', '센터 입력 지연 점검'],
        expectedEffectTags: ['거버넌스 보완'],
      },
    ],
  },
  {
    causeKey: 'external_dependency',
    ownerOrg: 'external',
    actionable: false,
    regionalNeed: 'medium',
    escalationPath: [
      { toOrgRole: 'externalPartner', channel: 'email', slaHours: 24 },
      { toOrgRole: 'regionalDutyOfficer', channel: 'internal', slaHours: 48 },
    ],
    defaultActions: [
      {
        title: '외부 연계 지연 티켓 생성',
        steps: ['외부 파트너 지연 원인 요청', '대체 경로 운영 적용'],
        expectedEffectTags: ['적체 해소'],
      },
    ],
  },
];

export const THRESHOLD_POLICIES: ThresholdPolicy[] = [
  {
    kpiKey: 'regionalSla',
    thresholds: { watch: 12, critical: 18 },
    trendRules: [
      { type: 'increasing_streak', metric: 'ratio', days: 3, deltaMin: 1.5 },
      { type: 'no_decrease', metric: 'ratio', days: 5 },
    ],
  },
  {
    kpiKey: 'regionalDxDelayHotspot',
    thresholds: { watch: 30, critical: 45 },
    trendRules: [
      { type: 'increasing_streak', metric: 'count', days: 3, deltaMin: 5 },
      { type: 'rebound', metric: 'count', days: 4 },
    ],
  },
  {
    kpiKey: 'regionalQueueRisk',
    thresholds: { watch: 180, critical: 260 },
    trendRules: [
      { type: 'increasing_streak', metric: 'count', days: 3, deltaMin: 20 },
      { type: 'no_decrease', metric: 'count', days: 5 },
    ],
  },
  {
    kpiKey: 'regionalRecontact',
    thresholds: { watch: 14, critical: 20 },
    trendRules: [
      { type: 'increasing_streak', metric: 'ratio', days: 4, deltaMin: 1.2 },
      { type: 'rebound', metric: 'ratio', days: 4 },
    ],
  },
];

export const ASSIGNMENT_POLICIES: AssignmentPolicy[] = [
  {
    regionKey: 'seoul',
    ownerOrg: 'center',
    assigneeId: 'center-lead-seoul',
    assigneeRole: '서울센터 운영총괄',
    defaultDueSlaHours: 48,
  },
  {
    regionKey: 'seoul',
    ownerOrg: 'hospital',
    assigneeId: 'hospital-partner-seoul',
    assigneeRole: '협약 병원 담당',
    defaultDueSlaHours: 72,
  },
  {
    regionKey: 'seoul',
    ownerOrg: 'system',
    assigneeId: 'system-ops-core',
    assigneeRole: '시스템 운영',
    defaultDueSlaHours: 72,
  },
  {
    regionKey: 'seoul',
    ownerOrg: 'external',
    assigneeId: 'external-link-manager',
    assigneeRole: '외부 연계 담당',
    defaultDueSlaHours: 96,
  },
];

export function findCausePolicy(causeKey: string): CausePolicy | undefined {
  return CAUSE_POLICIES.find((policy) => policy.causeKey === causeKey);
}

export function resolveAssignmentPolicy(params: {
  regionKey: string;
  areaKey?: string | null;
  causeKey?: string | null;
  ownerOrg: OwnerOrg;
}): AssignmentPolicy {
  const exact =
    ASSIGNMENT_POLICIES.find(
      (policy) =>
        policy.regionKey === params.regionKey &&
        policy.ownerOrg === params.ownerOrg &&
        (policy.areaKey == null || policy.areaKey === params.areaKey) &&
        (policy.causeKey == null || policy.causeKey === params.causeKey),
    ) ??
    ASSIGNMENT_POLICIES.find(
      (policy) => policy.regionKey === params.regionKey && policy.ownerOrg === params.ownerOrg,
    );

  if (exact) return exact;

  return {
    regionKey: params.regionKey,
    ownerOrg: params.ownerOrg,
    assigneeId: 'regional-duty-officer',
    assigneeRole: '광역 당직 담당',
    defaultDueSlaHours: 72,
  };
}

export function getThresholdPolicy(kpiKey: KpiKey): ThresholdPolicy | undefined {
  return THRESHOLD_POLICIES.find((policy) => policy.kpiKey === kpiKey);
}

export function buildInterventionDedupeKey(input: {
  kpiKey: KpiKey;
  areaLabel: string;
  causeKey: string;
  stageKey: string;
  period: string;
}): string {
  return `${input.kpiKey}|${input.areaLabel}|${input.causeKey}|${input.stageKey}|${input.period}`;
}
