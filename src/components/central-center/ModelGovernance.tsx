import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { TabContext } from '../../lib/useTabContext';
import { fetchPolicyChanges } from '../../lib/centralApi';
import type { PolicyChangeEvent } from '../../mocks/mockCentralOps';

interface ModelGovernanceProps {
  context?: TabContext;
  onNavigate?: (page: string, ctx?: Partial<TabContext>) => void;
}

type GovernanceStage = 'Stage1' | 'Stage2' | 'Stage3';
type GovernanceChangeType =
  | 'model_version_change'
  | 'rule_parameter_change'
  | 'guardrail_change';
type ImpactStatus = 'none' | 'watch' | 'warning';
type ScopeType = '전국' | '광역' | '파일럿';
type KpiImpactKey =
  | 'signalQuality'
  | 'policyImpact'
  | 'bottleneckRisk'
  | 'dataReadiness'
  | 'dataQuality'
  | 'governanceSafety';

interface GovernanceExtension {
  stage: GovernanceStage;
  changeType: GovernanceChangeType;
  targetName: string;
  summaryLine: string;
  scope: ScopeType;
  scopeDetail: string;
  beforeLabel: string;
  beforeValue: string;
  afterLabel: string;
  afterValue: string;
  reason?: string;
  observedKpis: KpiImpactKey[];
  sparklineByKpi: Partial<Record<KpiImpactKey, number[]>>;
  deltaPpByKpi: Partial<Record<KpiImpactKey, number>>;
  topRegions: string[];
}

interface GovernanceRow {
  event: PolicyChangeEvent;
  extension: GovernanceExtension;
  stageLinkedKpis: KpiImpactKey[];
  impactKpis: KpiImpactKey[];
  impactStatus: ImpactStatus;
  rollback: boolean;
}

interface ImpactMiniChartProps {
  points: number[];
  stroke: string;
  chartId: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const STAGE_KPI_LINKS: Record<GovernanceStage, KpiImpactKey[]> = {
  Stage1: ['signalQuality', 'bottleneckRisk'],
  Stage2: ['dataReadiness', 'bottleneckRisk'],
  Stage3: ['governanceSafety', 'dataQuality'],
};

const KPI_META: Record<KpiImpactKey, { label: string; chipClass: string; stroke: string }> = {
  signalQuality: {
    label: '신호품질',
    chipClass: 'bg-blue-50 text-blue-700 border-blue-200',
    stroke: '#2563eb',
  },
  policyImpact: {
    label: '정책영향',
    chipClass: 'bg-violet-50 text-violet-700 border-violet-200',
    stroke: '#7c3aed',
  },
  bottleneckRisk: {
    label: '병목',
    chipClass: 'bg-red-50 text-red-700 border-red-200',
    stroke: '#dc2626',
  },
  dataReadiness: {
    label: '데이터 준비도',
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    stroke: '#059669',
  },
  dataQuality: {
    label: '데이터 품질',
    chipClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    stroke: '#0891b2',
  },
  governanceSafety: {
    label: '거버넌스',
    chipClass: 'bg-amber-50 text-amber-700 border-amber-200',
    stroke: '#d97706',
  },
};

const CHANGE_TYPE_LABEL: Record<GovernanceChangeType, string> = {
  model_version_change: '모델 버전 변경',
  rule_parameter_change: '규칙 파라미터 변경',
  guardrail_change: 'Guardrail 변경',
};

const IMPACT_STATUS_META: Record<ImpactStatus, { label: string; className: string }> = {
  none: { label: '영향 없음', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  watch: { label: '주의', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  warning: { label: '경고', className: 'bg-red-50 text-red-700 border-red-200' },
};

const FALLBACK_STAGE_BY_TYPE: Record<PolicyChangeEvent['type'], GovernanceStage> = {
  rule_threshold: 'Stage1',
  model_version: 'Stage2',
  ruleset: 'Stage2',
  contact_rule: 'Stage3',
};

const FALLBACK_CHANGE_TYPE_BY_TYPE: Record<PolicyChangeEvent['type'], GovernanceChangeType> = {
  rule_threshold: 'rule_parameter_change',
  model_version: 'model_version_change',
  ruleset: 'guardrail_change',
  contact_rule: 'guardrail_change',
};

const CHANGE_EXTENSION_BY_ID: Record<string, GovernanceExtension> = {
  chg_20260124: {
    stage: 'Stage1',
    changeType: 'rule_parameter_change',
    targetName: 'L2 분류 기준점',
    summaryLine: '60~64 구간 누락 대응을 위해 기준점 하향 시나리오를 검토.',
    scope: '광역',
    scopeDetail: '경기도 6개 센터',
    beforeLabel: '파라미터',
    beforeValue: '점수 ≥ 65 → L2',
    afterLabel: '파라미터',
    afterValue: '점수 ≥ 60 → L2 (검토)',
    reason:
      '최근 3개월 구간에서 60~64점 케이스의 이탈 비율이 높게 관측되어 기준점 조정 시나리오를 검토 중입니다.',
    observedKpis: ['policyImpact'],
    sparklineByKpi: {
      signalQuality: [89.8, 89.7, 89.8, 89.8, 89.9, 89.8, 89.8],
      bottleneckRisk: [41.5, 41.7, 41.8, 41.9, 41.8, 41.8, 41.9],
      policyImpact: [24.0, 24.8, 25.6, 26.1, 26.4, 26.2, 26.0],
    },
    deltaPpByKpi: {
      signalQuality: 0.0,
      bottleneckRisk: 0.4,
      policyImpact: 2.0,
    },
    topRegions: ['경기 안산시', '경기 시흥시', '경기 부천시'],
  },
  chg_20260120: {
    stage: 'Stage1',
    changeType: 'rule_parameter_change',
    targetName: 'L2 분류 기준점',
    summaryLine: '기준점 상향 적용 후 Stage1 신호와 병목 변동을 추적.',
    scope: '전국',
    scopeDetail: '전국 17개 시도',
    beforeLabel: '파라미터',
    beforeValue: '점수 ≥ 60 → L2',
    afterLabel: '파라미터',
    afterValue: '점수 ≥ 65 → L2',
    observedKpis: ['policyImpact'],
    sparklineByKpi: {
      signalQuality: [88.9, 89.1, 89.3, 89.5, 89.7, 89.8, 89.8],
      bottleneckRisk: [44.0, 43.4, 42.9, 42.3, 41.9, 41.5, 41.1],
      policyImpact: [31.2, 30.4, 29.8, 29.1, 28.8, 28.5, 28.1],
    },
    deltaPpByKpi: {
      signalQuality: 0.9,
      bottleneckRisk: -2.9,
      policyImpact: -3.1,
    },
    topRegions: ['부산 해운대구', '대구 달서구', '경기 안산시'],
  },
  chg_20260115: {
    stage: 'Stage3',
    changeType: 'guardrail_change',
    targetName: 'L3 재접촉 주기',
    summaryLine: '재접촉 간격 조정 이후 거버넌스/데이터 품질 변동을 관측.',
    scope: '광역',
    scopeDetail: '서울특별시',
    beforeLabel: '운영 규칙',
    beforeValue: '재접촉 7일 주기',
    afterLabel: '운영 규칙',
    afterValue: '재접촉 5일 주기',
    observedKpis: ['policyImpact'],
    sparklineByKpi: {
      governanceSafety: [95.0, 95.1, 95.3, 95.6, 95.8, 95.9, 96.1],
      dataQuality: [94.2, 94.4, 94.5, 94.6, 94.8, 94.8, 94.9],
      policyImpact: [27.5, 27.2, 27.0, 26.8, 26.6, 26.4, 26.3],
    },
    deltaPpByKpi: {
      governanceSafety: 1.1,
      dataQuality: 0.7,
      policyImpact: -1.2,
    },
    topRegions: ['서울 강남구', '서울 송파구', '서울 관악구'],
  },
  chg_20260110: {
    stage: 'Stage2',
    changeType: 'model_version_change',
    targetName: '위험 예측 모델',
    summaryLine: '모델 버전 교체 이후 Stage2 데이터 준비도와 병목 지표를 추적.',
    scope: '전국',
    scopeDetail: '전국 17개 시도',
    beforeLabel: '모델 버전',
    beforeValue: 'v3.1.4',
    afterLabel: '모델 버전',
    afterValue: 'v3.2.0',
    observedKpis: ['policyImpact'],
    sparklineByKpi: {
      dataReadiness: [93.2, 93.3, 93.5, 93.6, 93.7, 93.8, 93.8],
      bottleneckRisk: [45.0, 44.3, 43.8, 43.4, 43.0, 42.7, 42.4],
      policyImpact: [25.4, 24.8, 24.2, 23.8, 23.2, 22.8, 22.3],
    },
    deltaPpByKpi: {
      dataReadiness: 0.6,
      bottleneckRisk: -2.6,
      policyImpact: -3.1,
    },
    topRegions: ['부산 해운대구', '대구 달서구', '경기 안산시'],
  },
  chg_20260105: {
    stage: 'Stage2',
    changeType: 'rule_parameter_change',
    targetName: '독거 위험 가중치',
    summaryLine: '가중치 상향 후 운영 병목 변동이 확대되어 롤백.',
    scope: '전국',
    scopeDetail: '전국 17개 시도',
    beforeLabel: '가중치',
    beforeValue: '1.20',
    afterLabel: '가중치',
    afterValue: '1.35 (이후 1.20 롤백)',
    observedKpis: ['policyImpact'],
    sparklineByKpi: {
      dataReadiness: [93.5, 93.3, 93.1, 92.9, 93.0, 93.2, 93.4],
      bottleneckRisk: [40.2, 43.6, 46.8, 48.1, 47.4, 44.0, 41.4],
      policyImpact: [34.0, 39.2, 46.4, 52.1, 57.2, 50.6, 41.3],
    },
    deltaPpByKpi: {
      dataReadiness: -0.1,
      bottleneckRisk: 1.2,
      policyImpact: 7.3,
    },
    topRegions: ['부산 해운대구', '대구 달서구', '경기 안산시'],
  },
};

function formatDateTime(dateValue: string): { date: string; time: string } {
  const date = new Date(dateValue);
  return {
    date: date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    time: date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  };
}

function toUniqueKpis(kpis: KpiImpactKey[]): KpiImpactKey[] {
  return Array.from(new Set(kpis));
}

function deriveImpactStatus(event: PolicyChangeEvent): ImpactStatus {
  const maxAbs = Math.max(0, ...event.impactSummary.map((item) => Math.abs(item.changePp)));
  if (event.status === 'rollback' || maxAbs >= 2.0) return 'warning';
  if (maxAbs >= 0.5 || event.status === 'deployed') return 'watch';
  return 'none';
}

function buildFallbackExtension(event: PolicyChangeEvent): GovernanceExtension {
  const stage = FALLBACK_STAGE_BY_TYPE[event.type];
  const stageLinked = STAGE_KPI_LINKS[stage];
  return {
    stage,
    changeType: FALLBACK_CHANGE_TYPE_BY_TYPE[event.type],
    targetName: event.title,
    summaryLine: 'KPI 변동 관측을 위해 기본 변경 메타데이터를 사용합니다.',
    scope: event.affectedRegions[0] === '전국' ? '전국' : '광역',
    scopeDetail: event.affectedRegions.join(', '),
    beforeLabel: '설정',
    beforeValue: event.version,
    afterLabel: '설정',
    afterValue: event.version,
    reason: event.reason,
    observedKpis: ['policyImpact'],
    sparklineByKpi: {
      [stageLinked[0]]: [0, 0, 0, 0, 0, 0, 0],
      [stageLinked[1]]: [0, 0, 0, 0, 0, 0, 0],
      policyImpact: [0, 0, 0, 0, 0, 0, 0],
    },
    deltaPpByKpi: {
      [stageLinked[0]]: 0,
      [stageLinked[1]]: 0,
      policyImpact: 0,
    },
    topRegions: event.affectedRegions.slice(0, 3),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const valid =
    normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized.padEnd(6, '0').slice(0, 6);

  const r = parseInt(valid.slice(0, 2), 16);
  const g = parseInt(valid.slice(2, 4), 16);
  const b = parseInt(valid.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildSmoothPath(coords: Array<{ x: number; y: number }>): string {
  if (!coords.length) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

  const d = [`M ${coords[0].x} ${coords[0].y}`];
  for (let i = 0; i < coords.length - 1; i += 1) {
    const current = coords[i];
    const next = coords[i + 1];
    const controlX = (current.x + next.x) / 2;
    d.push(`C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`);
  }
  return d.join(' ');
}

function buildAreaPath(
  linePath: string,
  coords: Array<{ x: number; y: number }>,
  baseline: number,
): string {
  if (!linePath || coords.length < 2) return '';
  const first = coords[0];
  const last = coords[coords.length - 1];
  return `${linePath} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
}

function ImpactMiniChart({ points, stroke, chartId }: ImpactMiniChartProps) {
  if (points.length < 2) {
    return <div className="h-20 w-full rounded-lg border border-slate-100 bg-slate-50" />;
  }

  const safeId = chartId.replace(/[^a-zA-Z0-9_-]/g, '');
  const top = 4;
  const bottom = 32;
  const baseline = 31;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = 100 / (points.length - 1);
  const coords = points.map((point, index) => ({
    x: Number((index * stepX).toFixed(2)),
    y: Number((bottom - ((point - min) / range) * (bottom - top)).toFixed(2)),
  }));

  const linePath = buildSmoothPath(coords);
  const areaPath = buildAreaPath(linePath, coords, baseline);
  const last = coords[coords.length - 1];
  const first = coords[0];

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-2">
      <svg viewBox="0 0 100 34" className="h-16 w-full">
        <defs>
          <linearGradient id={`fill-${safeId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
          <radialGradient id={`halo-${safeId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.42" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </radialGradient>
        </defs>

        {[6, 14, 22, 30].map((y) => (
          <line
            key={`${safeId}-grid-${y}`}
            x1={0}
            y1={y}
            x2={100}
            y2={y}
            stroke="#e2e8f0"
            strokeDasharray="2.5 2.5"
            strokeWidth={0.6}
          />
        ))}

        <path d={areaPath} fill={`url(#fill-${safeId})`} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth={2.1} strokeLinecap="round" />

        <circle cx={first.x} cy={first.y} r={1.6} fill="#ffffff" stroke={stroke} strokeWidth={1.2} />
        <circle cx={last.x} cy={last.y} r={4.6} fill={`url(#halo-${safeId})`} />
        <circle cx={last.x} cy={last.y} r={2.1} fill="#ffffff" stroke={stroke} strokeWidth={1.4} />
      </svg>

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
        <span>D1 {points[0].toFixed(1)}</span>
        <span>{min.toFixed(1)} ~ {max.toFixed(1)}</span>
        <span>D7 {points[points.length - 1].toFixed(1)}</span>
      </div>
    </div>
  );
}

export function ModelGovernance({ context, onNavigate }: ModelGovernanceProps) {
  const [selectedId, setSelectedId] = useState<string>(context?.changeId ?? '');
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});
  const [policyChanges, setPolicyChanges] = useState<PolicyChangeEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetchPolicyChanges()
      .then((rows) => {
        if (cancelled) return;
        setPolicyChanges(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setPolicyChanges([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<GovernanceRow[]>(() => {
    return [...policyChanges]
      .sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime())
      .map((event) => {
        const extension = CHANGE_EXTENSION_BY_ID[event.id] ?? buildFallbackExtension(event);
        const stageLinkedKpis = STAGE_KPI_LINKS[extension.stage];
        const impactKpis = toUniqueKpis([...stageLinkedKpis, ...extension.observedKpis]);

        return {
          event,
          extension,
          stageLinkedKpis,
          impactKpis,
          impactStatus: deriveImpactStatus(event),
          rollback: event.status === 'rollback',
        };
      });
  }, [policyChanges]);

  useEffect(() => {
    if (context?.changeId) {
      setSelectedId(context.changeId);
    }
  }, [context?.changeId]);

  useEffect(() => {
    if (!rows.length) return;
    const exists = rows.some((row) => row.event.id === selectedId);
    if (!exists) {
      setSelectedId(rows[0].event.id);
    }
  }, [rows, selectedId]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.event.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId],
  );

  const summary = useMemo(() => {
    const now = Date.now();
    const recentRows = rows.filter(
      (row) => now - new Date(row.event.deployedAt).getTime() <= THIRTY_DAYS_MS,
    );
    const baseRows = recentRows.length > 0 ? recentRows : rows;

    const impactedCount = baseRows.filter((row) => row.impactStatus !== 'none').length;
    const rollbackCount = baseRows.filter((row) => row.rollback).length;

    const stageDistribution: Record<GovernanceStage, number> = {
      Stage1: 0,
      Stage2: 0,
      Stage3: 0,
    };

    baseRows.forEach((row) => {
      stageDistribution[row.extension.stage] += 1;
    });

    const impactRatio = baseRows.length
      ? Number(((impactedCount / baseRows.length) * 100).toFixed(1))
      : 0;

    return {
      recentCount: baseRows.length,
      impactRatio,
      rollbackCount,
      stageDistribution,
    };
  }, [rows]);

  if (!selectedRow) {
    return (
      <div className="p-4 text-sm text-slate-500">
        모델/규칙 변경 이력을 불러오지 못했습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">모델/규칙 변경 영향 관리</h1>
        <p className="mt-1 text-xs text-slate-500">
          무엇을 바꿨고, 그 결과 어떤 KPI가 흔들렸는지 Stage1~3 운영 흐름에 맞춰 확인합니다.
        </p>
      </div>

      <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-700">
          <span>
            최근 30일 변경 건수 <strong className="ml-1 text-slate-900">{summary.recentCount}건</strong>
          </span>
          <span>
            영향 KPI 발생 비율 <strong className="ml-1 text-slate-900">{summary.impactRatio}%</strong>
          </span>
          <span>
            롤백 발생 건수 <strong className="ml-1 text-slate-900">{summary.rollbackCount}건</strong>
          </span>
          <span>
            Stage별 변경 분포{' '}
            <strong className="ml-1 text-slate-900">
              Stage1 {summary.stageDistribution.Stage1} · Stage2 {summary.stageDistribution.Stage2} · Stage3 {summary.stageDistribution.Stage3}
            </strong>
          </span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">변경 이력 (KPI 영향 기준)</CardTitle>
          <p className="text-[11px] text-slate-500">행 선택 시 하단 패널에서 변경 상세와 KPI 변동을 함께 확인합니다.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-xs">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 text-left font-semibold">변경일시</th>
                  <th className="px-3 py-2 text-left font-semibold">변경 유형</th>
                  <th className="px-3 py-2 text-left font-semibold">Stage</th>
                  <th className="px-3 py-2 text-left font-semibold">대상 모델/규칙명</th>
                  <th className="px-3 py-2 text-left font-semibold">변경 요약</th>
                  <th className="px-3 py-2 text-left font-semibold">영향 KPI</th>
                  <th className="px-3 py-2 text-left font-semibold">영향 상태</th>
                  <th className="px-3 py-2 text-left font-semibold">롤백 여부</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const selected = selectedRow.event.id === row.event.id;
                  const { date, time } = formatDateTime(row.event.deployedAt);
                  const expanded = Boolean(expandedReasons[row.event.id]);
                  const impactMeta = IMPACT_STATUS_META[row.impactStatus];

                  return (
                    <React.Fragment key={row.event.id}>
                      <tr
                        onClick={() => setSelectedId(row.event.id)}
                        className={`cursor-pointer border-b border-slate-100 transition-colors ${
                          selected ? 'bg-blue-50/40' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-start gap-2">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedReasons((prev) => ({
                                  ...prev,
                                  [row.event.id]: !prev[row.event.id],
                                }));
                              }}
                              className="mt-0.5 rounded p-0.5 text-slate-500 hover:bg-slate-100"
                              aria-label="변경 사유 펼치기"
                            >
                              {expanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <div>
                              <div className="font-medium text-slate-900">{date}</div>
                              <div className="text-[11px] text-slate-500">{time}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {CHANGE_TYPE_LABEL[row.extension.changeType]}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="inline-flex rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {row.extension.stage}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top font-medium text-slate-900">{row.extension.targetName}</td>
                        <td className="px-3 py-2 align-top text-slate-700">{row.extension.summaryLine}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap gap-1">
                            {row.impactKpis.map((kpiKey) => {
                              const kpi = KPI_META[kpiKey];
                              return (
                                <span
                                  key={`${row.event.id}-${kpiKey}`}
                                  className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${kpi.chipClass}`}
                                >
                                  {kpi.label}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-medium ${impactMeta.className}`}
                          >
                            {impactMeta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          {row.rollback ? (
                            <span className="text-[11px] font-semibold text-red-600">발생</span>
                          ) : (
                            <span className="text-[11px] text-slate-400">없음</span>
                          )}
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="border-b border-slate-100 bg-slate-50/70">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="text-[11px] font-semibold text-slate-600">변경 사유</div>
                            <p className="mt-1 text-xs leading-relaxed text-slate-700">
                              {row.extension.reason || row.event.reason || '사유 기록이 없습니다.'}
                            </p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-6">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">변경 상세</CardTitle>
              <p className="text-[11px] text-slate-500">변경 전/후 설정, 적용 범위, 적용 Stage를 함께 표시합니다.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-[11px] text-slate-500">대상 모델/규칙</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{selectedRow.extension.targetName}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    적용 Stage: {selectedRow.extension.stage}
                  </span>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    적용 범위: {selectedRow.extension.scope}
                  </span>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {selectedRow.extension.scopeDetail}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-[11px] text-slate-500">변경 전</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{selectedRow.extension.beforeValue}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{selectedRow.extension.beforeLabel}</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                  <div className="text-[11px] text-blue-600">변경 후</div>
                  <div className="mt-1 text-sm font-semibold text-blue-900">{selectedRow.extension.afterValue}</div>
                  <div className="mt-0.5 text-[11px] text-blue-700">{selectedRow.extension.afterLabel}</div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-[11px] text-slate-500">Stage 자동 연결 KPI</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedRow.stageLinkedKpis.map((kpiKey) => {
                    const kpi = KPI_META[kpiKey];
                    return (
                      <span
                        key={`stage-link-${kpiKey}`}
                        className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${kpi.chipClass}`}
                      >
                        {kpi.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">KPI 영향</CardTitle>
              <p className="text-[11px] text-slate-500">변경 이후 7일간 KPI 변동 관측</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedRow.stageLinkedKpis.map((kpiKey) => {
                const kpi = KPI_META[kpiKey];
                const points = selectedRow.extension.sparklineByKpi[kpiKey] ?? [];
                const delta = selectedRow.extension.deltaPpByKpi[kpiKey] ?? 0;
                const startValue = points[0] ?? 0;
                const endValue = points[points.length - 1] ?? 0;
                const trendDelta = endValue - startValue;
                const trendLabel =
                  trendDelta > 0.15 ? '상향 관측' : trendDelta < -0.15 ? '하향 관측' : '횡보 관측';
                const trendClass =
                  trendDelta > 0.15
                    ? 'text-emerald-700'
                    : trendDelta < -0.15
                      ? 'text-red-700'
                      : 'text-slate-600';

                return (
                  <div
                    key={`spark-${kpiKey}`}
                    className="rounded-xl border border-slate-200 p-3 shadow-sm"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${hexToRgba(kpi.stroke, 0.16)} 0%, #ffffff 52%, #f8fafc 100%)`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${kpi.chipClass}`}
                      >
                        {kpi.label}
                      </span>
                      <div className="text-right">
                        <div
                          className={`text-xs font-semibold ${
                            delta >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          Δ {delta >= 0 ? '+' : ''}
                          {delta.toFixed(1)}pp
                        </div>
                        <div className="text-[10px] text-slate-500">7일 변동</div>
                      </div>
                    </div>

                    <div className="mt-2">
                      <ImpactMiniChart
                        points={points}
                        stroke={kpi.stroke}
                        chartId={`${selectedRow.event.id}-${kpiKey}`}
                      />
                    </div>

                    <div className="mt-1 flex items-center justify-between">
                      <span className={`text-[10px] font-medium ${trendClass}`}>{trendLabel}</span>
                      <span className="text-[10px] text-slate-500">
                        시작 {startValue.toFixed(1)} → 현재 {endValue.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-[11px] text-slate-500">영향 받은 지역 Top3</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selectedRow.extension.topRegions.slice(0, 3).map((region) => (
                    <span
                      key={`${selectedRow.event.id}-${region}`}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                    >
                      {region}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                표시값은 KPI 변동 관측 및 운영상 영향 확인을 위한 지표입니다.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => onNavigate?.('quality-monitoring', { changeId: selectedRow.event.id })}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  데이터·모델 품질 보기
                  <ExternalLink className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onNavigate?.('compliance-audit', { changeId: selectedRow.event.id })}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  감사 로그 보기
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
