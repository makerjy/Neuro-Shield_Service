import type {
  AlertSummary,
  InternalRangeKey,
  KpiKey,
  OpsTodoItem,
  OwnerOrg,
  RegionalQueryState,
  TodoStatus,
} from './opsContracts';
import { findCausePolicy, resolveAssignmentPolicy, getThresholdPolicy, buildInterventionDedupeKey } from './regionalOpsPolicies';

export type OpsTodoSeed = {
  regionKey: string;
  regionLabel: string;
  selectedRegionSgg: string | null;
  selectedRange: InternalRangeKey;
  selectedKpiKey: KpiKey;
  mapLayer: RegionalQueryState['layer'];
  alertSummary: AlertSummary;
  avgExamDelayDays: number;
  overdueFollowups: number;
  longWaitDays: number;
};

export function buildOpsTodos(seed: OpsTodoSeed, baseStatus: TodoStatus = 'open'): OpsTodoItem[] {
  const scopeLabel = seed.selectedRegionSgg ?? `${seed.regionLabel} 관할`;
  return [
    {
      id: 'todo-sla-risk',
      title: 'SLA 위험 구역 우선 개입',
      reason: `기한 준수 위험 ${seed.alertSummary.slaAtRiskRegions}곳이 임계 초과`,
      target: `${scopeLabel} 상위 위험 구역`,
      recommendedAction: '상위 2개 구역 인력 우선 배치',
      dueSlaHours: 24,
      status: baseStatus,
      relatedQueryState: {
        regionKey: seed.regionKey,
        period: seed.selectedRange,
        kpiKey: 'regionalSla',
        areaKey: seed.selectedRegionSgg,
        layer: 'RISK',
      },
    },
    {
      id: 'todo-dx-delay',
      title: '검사 연결 지연 병목 분석',
      reason: `평균 대기 ${Math.round(seed.avgExamDelayDays)}일, 임계 ${seed.longWaitDays}일 기준`,
      target: `${scopeLabel} 검사 지연 구역`,
      recommendedAction: '병목 분석 후 검사 슬롯 증설 요청 생성',
      dueSlaHours: 24,
      status: baseStatus,
      relatedQueryState: {
        regionKey: seed.regionKey,
        period: seed.selectedRange,
        kpiKey: 'regionalDxDelayHotspot',
        areaKey: seed.selectedRegionSgg,
        layer: 'BOTTLENECK',
      },
    },
    {
      id: 'todo-followup',
      title: '후속 연락 지연 해소',
      reason: `후속 연락 지연 ${seed.overdueFollowups.toLocaleString()}건`,
      target: `${scopeLabel} 재접촉 실패 상위 구역`,
      recommendedAction: '재접촉 자동화 확대 및 시간대 재배치',
      dueSlaHours: 48,
      status: baseStatus,
      relatedQueryState: {
        regionKey: seed.regionKey,
        period: seed.selectedRange,
        kpiKey: 'regionalRecontact',
        areaKey: seed.selectedRegionSgg,
        layer: 'BOTTLENECK',
      },
    },
  ];
}

export type AutoInterventionPreview = {
  previewId: string;
  dedupeKey: string;
  regionLabel: string;
  kpiKey: KpiKey;
  stageKey: 'Stage1' | 'Stage2' | 'Stage3';
  causeKey: string;
  ownerOrg: OwnerOrg;
  assigneeId: string;
  assigneeRole: string;
  dueSlaHours: number;
  blockedByDuplicate: boolean;
  blockedReason?: string;
  ruleId: string;
  ruleLabel: string;
};

type ExistingOpenInterventionLite = {
  kpiKey: KpiKey;
  areaLabel: string;
  causeKey: string;
  stageKey: string;
  period: InternalRangeKey;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
};

export function previewAutoInterventions(params: {
  regionKey: string;
  selectedRange: InternalRangeKey;
  selectedRegionSgg: string | null;
  districtOptions: string[];
  existingOpenInterventions: ExistingOpenInterventionLite[];
}): AutoInterventionPreview[] {
  const targets = params.selectedRegionSgg
    ? [params.selectedRegionSgg]
    : params.districtOptions.slice(0, Math.min(4, Math.max(1, params.districtOptions.length)));

  const recipes: Array<{
    kpiKey: KpiKey;
    stageKey: 'Stage1' | 'Stage2' | 'Stage3';
    causeKey: string;
    ruleId: string;
    ruleLabel: string;
  }> = [
    {
      kpiKey: 'regionalSla',
      stageKey: 'Stage1',
      causeKey: 'staff_shortage',
      ruleId: 'RULE-SLA-15',
      ruleLabel: 'SLA 위험 15% 초과',
    },
    {
      kpiKey: 'regionalDxDelayHotspot',
      stageKey: 'Stage2',
      causeKey: 'hospital_slot_delay',
      ruleId: 'RULE-DX-7D',
      ruleLabel: '감별검사 지연 7일 이상',
    },
    {
      kpiKey: 'regionalAdTransitionHotspot',
      stageKey: 'Stage3',
      causeKey: 'contact_failure',
      ruleId: 'RULE-AD-HR-5',
      ruleLabel: 'AD 전환 고위험군 미조치 5건 이상',
    },
  ];

  const existingKeys = new Set(
    params.existingOpenInterventions
      .filter((item) => item.status === 'TODO' || item.status === 'IN_PROGRESS')
      .map((item) =>
        buildInterventionDedupeKey({
          kpiKey: item.kpiKey,
          areaLabel: item.areaLabel,
          causeKey: item.causeKey,
          stageKey: item.stageKey,
          period: item.period,
        }),
      ),
  );

  const previews: AutoInterventionPreview[] = [];
  targets.forEach((target, targetIdx) => {
    recipes.forEach((recipe, recipeIdx) => {
      const causePolicy = findCausePolicy(recipe.causeKey);
      const assignmentPolicy = resolveAssignmentPolicy({
        regionKey: params.regionKey,
        areaKey: target,
        causeKey: recipe.causeKey,
        ownerOrg: causePolicy?.ownerOrg ?? 'regional',
      });
      const threshold = getThresholdPolicy(recipe.kpiKey);
      const dedupeKey = buildInterventionDedupeKey({
        kpiKey: recipe.kpiKey,
        areaLabel: target,
        causeKey: recipe.causeKey,
        stageKey: recipe.stageKey,
        period: params.selectedRange,
      });
      const blockedByDuplicate = existingKeys.has(dedupeKey);

      previews.push({
        previewId: `preview-${targetIdx}-${recipeIdx}`,
        dedupeKey,
        regionLabel: target,
        kpiKey: recipe.kpiKey,
        stageKey: recipe.stageKey,
        causeKey: recipe.causeKey,
        ownerOrg: causePolicy?.ownerOrg ?? 'regional',
        assigneeId: assignmentPolicy.assigneeId,
        assigneeRole: assignmentPolicy.assigneeRole,
        dueSlaHours: threshold?.thresholds.critical ? Math.max(24, Math.round(assignmentPolicy.defaultDueSlaHours)) : assignmentPolicy.defaultDueSlaHours,
        blockedByDuplicate,
        blockedReason: blockedByDuplicate ? '동일 open 개입 존재' : undefined,
        ruleId: recipe.ruleId,
        ruleLabel: recipe.ruleLabel,
      });
    });
  });

  return previews;
}
