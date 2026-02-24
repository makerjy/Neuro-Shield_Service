import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { InternalRangeKey, KpiKey } from './opsContracts';
import type { RegionalScope } from '../geomap/regions';
import { InfoTooltip } from './InfoTooltip';
import { fetchRegionalReportSummary } from '../../lib/regionalApi';

interface RegionalReportsPageProps {
  region: RegionalScope;
  districtOptions: string[];
  selectedKpiKey: KpiKey;
  selectedRegionSgg: string | null;
  selectedRange: InternalRangeKey;
}

const KPI_LABEL: Record<KpiKey, string> = {
  regionalSla: '처리 SLA',
  regionalQueueRisk: '병목 큐',
  regionalRecontact: '재접촉 필요',
  regionalDataReadiness: '데이터 준비',
  regionalGovernance: '거버넌스/로그 완전성',
  regionalAdTransitionHotspot: 'AD 전환 위험',
  regionalDxDelayHotspot: '감별검사 지연',
  regionalScreenToDxRate: '선별→진단 전환율',
};

const RANGE_LABEL: Record<InternalRangeKey, string> = {
  week: '주간',
  month: '월간',
  quarter: '분기',
};

type ReportFormat = 'pdf' | 'ppt' | 'csv';
type ScopedMode = 'regional' | 'sigungu';
type ReportKpiFilter = KpiKey | 'all';
type MetricKey =
  | 'queue'
  | 'actions'
  | 'pending'
  | 'bottleneckRelief'
  | 'effectRate'
  | 'slaDelta';

const METRIC_LABEL: Record<MetricKey, string> = {
  queue: '누적 대기 건수',
  actions: '개입 실행 건수',
  pending: '미조치 항목',
  bottleneckRelief: '병목 해소율',
  effectRate: '개입 효과 발생 비율',
  slaDelta: 'SLA 위험 변화 Δ',
};

const hashSeed = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
};
const sv = (seed: string, min: number, max: number) => min + (max - min) * ((hashSeed(seed) % 1000) / 1000);

function toPct(v: number) {
  return `${v.toFixed(1)}%`;
}

function toCount(v: number) {
  return `${Math.round(v).toLocaleString()}건`;
}

function formatDelta(v: number, unit: '%' | '건') {
  const sign = v > 0 ? '+' : '';
  if (unit === '%') return `${sign}${v.toFixed(1)}%p`;
  return `${sign}${Math.round(v).toLocaleString()}건`;
}

function formatByUnit(value: number, unit: '%' | '건') {
  if (unit === '%') return `${value.toFixed(1)}%`;
  return `${Math.round(value).toLocaleString()}건`;
}

function getBasePrefix() {
  const marker = '/regional/';
  const idx = window.location.pathname.indexOf(marker);
  if (idx < 0) return '';
  return window.location.pathname.slice(0, idx);
}

function buildRegionalLink(path: string, params: Record<string, string>) {
  const search = new URLSearchParams(params).toString();
  return `${getBasePrefix()}${path}${search ? `?${search}` : ''}`;
}

function metricHelp(scopeLabel: string, rangeLabel: string, metric: MetricKey) {
  const common = {
    scope: `${scopeLabel} 집계`,
    period: `${rangeLabel} 기준`,
  };
  const map = {
    queue: {
      definition: '이번 기간 동안 처리 대기 상태로 남아있는 누적 업무 건수',
      threshold: '기한 7일 초과 업무 우선',
      interpretation: '높을수록 적체 해소 개입 필요',
      nextAction: '병목 원인 분석과 개입·조치 관리에서 우선 처리',
    },
    actions: {
      definition: '이번 기간 실제 실행된 개입 항목 건수',
      threshold: '실행률 80% 미만 시 후속 조치 점검',
      interpretation: '낮을수록 실행 이행 보강 필요',
      nextAction: '개입·조치 관리에서 담당자별 상태 확인',
    },
    pending: {
      definition: '현재 미조치 또는 보류 상태로 남아있는 개입 항목',
      threshold: 'T+3일 초과 시 지연 위험',
      interpretation: '높을수록 리스크 누적 가능성 증가',
      nextAction: '미조치 항목 우선 순서 재정렬',
    },
    bottleneckRelief: {
      definition: '개입 전 대비 적체가 완화된 비율',
      threshold: '(개입 전 적체-개입 후 적체)/개입 전 적체 ×100',
      interpretation: '높을수록 병목 해소 신호가 큼',
      nextAction: '해소율이 낮은 구역에 추가 개입 배치',
    },
    effectRate: {
      definition: 'After 데이터가 수집된 개입 중 개선 방향 수치가 확인된 비율',
      threshold: '개입 완료 후 48시간 내 After 수집',
      interpretation: '낮을수록 증빙 데이터 보강 필요',
      nextAction: '센터 보고 지연 항목에 수집 요청',
    },
    slaDelta: {
      definition: '이번 기간 SLA 위험률 변화(이전 동기간 대비)',
      threshold: '음수일수록 위험률 완화',
      interpretation: '양수면 지연 위험 확대, 음수면 완화',
      nextAction: '양수 구간은 병목 원인 분석 우선',
    },
  } satisfies Record<MetricKey, { definition: string; threshold: string; interpretation: string; nextAction: string }>;
  return {
    definition: map[metric].definition,
    scope: common.scope,
    period: common.period,
    threshold: map[metric].threshold,
    interpretation: map[metric].interpretation,
    nextAction: map[metric].nextAction,
    actionTab: 'reports' as const,
  };
}

export function RegionalReportsPage({
  region,
  districtOptions,
  selectedKpiKey,
  selectedRegionSgg,
  selectedRange,
}: RegionalReportsPageProps) {
  const [scopeMode, setScopeMode] = useState<ScopedMode>(selectedRegionSgg ? 'sigungu' : 'regional');
  const [reportSgg, setReportSgg] = useState<string>(selectedRegionSgg ?? districtOptions[0] ?? '');
  const [reportKpi, setReportKpi] = useState<ReportKpiFilter>(selectedKpiKey);
  const [reportRange, setReportRange] = useState<InternalRangeKey>(selectedRange);
  const [format, setFormat] = useState<ReportFormat>('pdf');

  const effectiveSgg = scopeMode === 'sigungu' ? reportSgg || districtOptions[0] || region.label : '';
  const scopeLabel = scopeMode === 'sigungu' ? effectiveSgg : `${region.label} 광역 전체`;
  const rangeLabel = RANGE_LABEL[reportRange];

  const seed = `${region.id}-${scopeMode}-${effectiveSgg || 'all'}-${reportKpi}-${reportRange}`;

  const fallbackMetrics = useMemo(() => {
    const queueBefore = Math.round(sv(`${seed}-queue-before`, 250, 760));
    const queueAfter = Math.round(sv(`${seed}-queue-after`, 140, 620));
    const actions = Math.round(sv(`${seed}-actions`, 14, 64));
    const pending = Math.round(sv(`${seed}-pending`, 4, 28));
    const effected = Math.max(0, Math.min(actions, Math.round(actions * sv(`${seed}-effect-ratio`, 0.42, 0.89))));
    const bottleneckReliefRaw = ((queueBefore - queueAfter) / Math.max(queueBefore, 1)) * 100;
    const slaPrev = Number(sv(`${seed}-sla-prev`, 11, 24).toFixed(1));
    const slaNow = Number((slaPrev + sv(`${seed}-sla-delta`, -6.4, 4.2)).toFixed(1));
    const slaDelta = Number((slaNow - slaPrev).toFixed(1));

    return {
      queueBefore,
      queueAfter,
      queue: queueAfter,
      actions,
      pending,
      bottleneckRelief: Number(Math.max(-20, Math.min(95, bottleneckReliefRaw)).toFixed(1)),
      effectRate: Number(((effected / Math.max(actions, 1)) * 100).toFixed(1)),
      slaPrev,
      slaNow,
      slaDelta,
    };
  }, [seed]);

  const fallbackCauseTop3 = useMemo(() => {
    const rows = [
      { key: 'contact_failure', label: '연락 미성공', count: Math.round(sv(`${seed}-cause-contact`, 80, 280)) },
      { key: 'staff_shortage', label: '인력 여유 부족', count: Math.round(sv(`${seed}-cause-staff`, 60, 260)) },
      { key: 'hospital_slot_delay', label: '감별검사 슬롯 지연', count: Math.round(sv(`${seed}-cause-hospital`, 50, 220)) },
      { key: 'data_gap', label: '데이터 결측', count: Math.round(sv(`${seed}-cause-data`, 40, 170)) },
      { key: 'external_dependency', label: '외부 연계 지연', count: Math.round(sv(`${seed}-cause-external`, 20, 130)) },
    ];
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return rows
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((row) => ({ ...row, ratio: Number(((row.count / Math.max(total, 1)) * 100).toFixed(1)) }));
  }, [seed]);

  const fallbackInterventionSummary = useMemo(() => {
    return [
      {
        title: '재접촉 슬롯 확대',
        owner: '광역 운영팀',
        stage: 'Stage1',
        count: Math.round(sv(`${seed}-itv-1`, 2, 8)),
        status: '진행',
      },
      {
        title: '검사 연계 슬롯 요청',
        owner: '협약 병원 연계',
        stage: 'Stage2',
        count: Math.round(sv(`${seed}-itv-2`, 1, 6)),
        status: '완료',
      },
      {
        title: '고위험군 후속 연락 강화',
        owner: '광역·기초센터 협업',
        stage: 'Stage3',
        count: Math.round(sv(`${seed}-itv-3`, 1, 5)),
        status: '진행',
      },
    ];
  }, [seed]);

  const fallbackKpiBeforeAfter = useMemo(() => {
    const rows = [
      {
        label: 'SLA 위험률',
        before: fallbackMetrics.slaPrev,
        after: fallbackMetrics.slaNow,
        unit: '%',
        higherBetter: false,
      },
      {
        label: '병목 적체 건수',
        before: fallbackMetrics.queueBefore,
        after: fallbackMetrics.queueAfter,
        unit: '건',
        higherBetter: false,
      },
      {
        label: '개입 효과 발생 비율',
        before: Number(Math.max(15, fallbackMetrics.effectRate - sv(`${seed}-effect-before`, 6, 18)).toFixed(1)),
        after: fallbackMetrics.effectRate,
        unit: '%',
        higherBetter: true,
      },
    ] as const;
    return rows.map((row) => ({
      ...row,
      delta: Number((row.after - row.before).toFixed(1)),
    }));
  }, [fallbackMetrics.effectRate, fallbackMetrics.queueAfter, fallbackMetrics.queueBefore, fallbackMetrics.slaNow, fallbackMetrics.slaPrev, seed]);

  const fallbackUnresolvedTasks = useMemo(() => {
    return [
      {
        title: 'Stage2 검사 연계 지연 구역 후속 조치',
        risk: '높음',
        recommendation: '협약 병원 슬롯 재배치 요청',
      },
      {
        title: 'After 데이터 미수집 개입 항목 정리',
        risk: '중간',
        recommendation: '센터 보고 지연 항목 수집 요청',
      },
      {
        title: '재접촉 미응답 구역 반복 모니터링',
        risk: '중간',
        recommendation: '자동 재접촉 캠페인 확대',
      },
    ];
  }, []);

  const reportSummaryQuery = useQuery({
    queryKey: ['regional-report-summary', region.id, scopeMode, effectiveSgg, reportKpi, reportRange],
    queryFn: async () =>
      fetchRegionalReportSummary({
        regionId: region.id,
        scopeMode,
        sgg: effectiveSgg,
        kpi: reportKpi,
        period: reportRange,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const metrics = reportSummaryQuery.data?.metrics ?? fallbackMetrics;
  const causeTop3 = reportSummaryQuery.data?.causeTop3 ?? fallbackCauseTop3;
  const interventionSummary = reportSummaryQuery.data?.interventionSummary ?? fallbackInterventionSummary;
  const kpiBeforeAfter = reportSummaryQuery.data?.kpiBeforeAfter ?? fallbackKpiBeforeAfter;
  const unresolvedTasks = reportSummaryQuery.data?.unresolvedTasks ?? fallbackUnresolvedTasks;

  const evidenceLinks = useMemo(() => {
    const baseParams = {
      kpi: reportKpi === 'all' ? selectedKpiKey : reportKpi,
      range: reportRange === 'week' ? 'weekly' : reportRange === 'month' ? 'monthly' : 'quarterly',
      ...(scopeMode === 'sigungu' ? { sgg: effectiveSgg } : {}),
    } as Record<string, string>;
    return {
      bottleneck: buildRegionalLink('/regional/bottleneck', baseParams),
      actions: buildRegionalLink('/regional/actions', baseParams),
      ops: buildRegionalLink('/regional/ops', baseParams),
      reports: buildRegionalLink('/regional/reports', baseParams),
    };
  }, [effectiveSgg, reportKpi, reportRange, scopeMode, selectedKpiKey]);

  const narrative = useMemo(() => {
    const topCause = causeTop3[0];
    const interventionTotal = interventionSummary.reduce((sum, row) => sum + row.count, 0);
    const deltaTone =
      metrics.slaDelta > 0
        ? `${metrics.slaDelta.toFixed(1)}%p 상승`
        : `${Math.abs(metrics.slaDelta).toFixed(1)}%p 완화`;

    const line1 = `${rangeLabel} ${scopeLabel}에서는 ${topCause?.label ?? '주요 원인'} 구간 비중이 가장 높았고, 병목 상위 원인은 ${causeTop3.map((c) => c.label).join(', ')} 순으로 나타났습니다.`;
    const line2 = `광역 개입은 총 ${interventionTotal}건 집행되었으며, 특히 ${interventionSummary[0].title} 중심으로 실행되었습니다.`;
    const line3 = `SLA 위험은 이전 동기간 대비 ${deltaTone}했고, 미해결 과제 ${unresolvedTasks.length}건은 다음 기간 권고 조치로 이월됩니다.`;
    return { line1, line2, line3 };
  }, [causeTop3, interventionSummary, metrics.slaDelta, rangeLabel, scopeLabel, unresolvedTasks.length]);

  const reportSections = useMemo(
    () => [
      { id: 1, title: '기간 요약', evidence: evidenceLinks.ops },
      { id: 2, title: '주요 병목 원인 Top3', evidence: evidenceLinks.bottleneck },
      { id: 3, title: '광역 개입 내역 요약', evidence: evidenceLinks.actions },
      { id: 4, title: '개입 전/후 KPI 변화', evidence: evidenceLinks.actions },
      { id: 5, title: '미해결 과제 및 다음 기간 권고', evidence: evidenceLinks.reports },
    ],
    [evidenceLinks.actions, evidenceLinks.bottleneck, evidenceLinks.ops, evidenceLinks.reports],
  );

  const formatLabel: Record<ReportFormat, string> = {
    pdf: 'PDF',
    ppt: 'PPT',
    csv: 'CSV',
  };

  const previewTitle = `${formatLabel[format]} 미리보기 · ${scopeLabel} · ${reportKpi === 'all' ? 'KPI 전체' : KPI_LABEL[reportKpi]} · ${rangeLabel}`;

  return (
    <div className="h-full overflow-auto bg-gray-50 p-4 space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-800">보고서</div>
            <div className="text-[12px] text-gray-500 mt-0.5">
              결과 설명 + 책임 증빙 중심 자동 생성 템플릿
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['pdf', 'ppt', 'csv'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormat(fmt)}
                className={`px-3 py-1.5 rounded border text-sm ${
                  format === fmt
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {formatLabel[fmt]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            value={scopeMode}
            onChange={(e) => setScopeMode(e.target.value as ScopedMode)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="regional">광역 전체</option>
            <option value="sigungu">특정 시군구</option>
          </select>
          <select
            value={effectiveSgg}
            onChange={(e) => setReportSgg(e.target.value)}
            disabled={scopeMode !== 'sigungu'}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400"
          >
            {districtOptions.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
          <select
            value={reportKpi}
            onChange={(e) => setReportKpi(e.target.value as ReportKpiFilter)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="all">KPI 전체</option>
            {Object.entries(KPI_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={reportRange}
            onChange={(e) => setReportRange(e.target.value as InternalRangeKey)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="week">주간</option>
            <option value="month">월간</option>
            <option value="quarter">분기</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-gray-500">{METRIC_LABEL.queue}</div>
            <InfoTooltip help={metricHelp(scopeLabel, rangeLabel, 'queue')} />
          </div>
          <div className="text-xl font-bold text-gray-900 mt-1">{toCount(metrics.queue)}</div>
          <a className="text-[11px] text-blue-700 underline underline-offset-2" href={evidenceLinks.bottleneck}>원본 분석 링크</a>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-gray-500">{METRIC_LABEL.actions}</div>
            <InfoTooltip help={metricHelp(scopeLabel, rangeLabel, 'actions')} />
          </div>
          <div className="text-xl font-bold text-gray-900 mt-1">{toCount(metrics.actions)}</div>
          <a className="text-[11px] text-blue-700 underline underline-offset-2" href={evidenceLinks.actions}>개입 항목 링크</a>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-gray-500">{METRIC_LABEL.pending}</div>
            <InfoTooltip help={metricHelp(scopeLabel, rangeLabel, 'pending')} />
          </div>
          <div className="text-xl font-bold text-gray-900 mt-1">{toCount(metrics.pending)}</div>
          <a className="text-[11px] text-blue-700 underline underline-offset-2" href={evidenceLinks.actions}>미조치 목록 링크</a>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-gray-500">{METRIC_LABEL.bottleneckRelief}</div>
            <InfoTooltip help={metricHelp(scopeLabel, rangeLabel, 'bottleneckRelief')} />
          </div>
          <div className={`text-xl font-bold mt-1 ${metrics.bottleneckRelief >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {toPct(metrics.bottleneckRelief)}
          </div>
          <a className="text-[11px] text-blue-700 underline underline-offset-2" href={evidenceLinks.bottleneck}>병목 근거 링크</a>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-gray-500">{METRIC_LABEL.effectRate}</div>
            <InfoTooltip help={metricHelp(scopeLabel, rangeLabel, 'effectRate')} />
          </div>
          <div className="text-xl font-bold text-gray-900 mt-1">{toPct(metrics.effectRate)}</div>
          <a className="text-[11px] text-blue-700 underline underline-offset-2" href={evidenceLinks.actions}>효과 증빙 링크</a>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-gray-500">{METRIC_LABEL.slaDelta}</div>
            <InfoTooltip help={metricHelp(scopeLabel, rangeLabel, 'slaDelta')} />
          </div>
          <div className={`text-xl font-bold mt-1 ${metrics.slaDelta <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatDelta(metrics.slaDelta, '%')}
          </div>
          <a className="text-[11px] text-blue-700 underline underline-offset-2" href={evidenceLinks.ops}>운영 원본 링크</a>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-700">자동 서술 문장</div>
        <div className="mt-2 space-y-2">
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-800">
            {narrative.line1}
            <a className="ml-2 text-blue-700 underline underline-offset-2 text-[12px]" href={evidenceLinks.bottleneck}>
              [근거]
            </a>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-800">
            {narrative.line2}
            <a className="ml-2 text-blue-700 underline underline-offset-2 text-[12px]" href={evidenceLinks.actions}>
              [근거]
            </a>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-800">
            {narrative.line3}
            <a className="ml-2 text-blue-700 underline underline-offset-2 text-[12px]" href={evidenceLinks.reports}>
              [근거]
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-700 mb-2">{previewTitle}</div>
        <div className="space-y-2">
          {reportSections.map((section) => (
            <div key={section.id} className="rounded border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2">
              <div className="text-[13px] text-gray-800">
                {section.id}. {section.title}
              </div>
              <a href={section.evidence} className="text-[11px] text-blue-700 underline underline-offset-2">
                증빙 링크
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">주요 병목 원인 Top3</div>
          <div className="space-y-2">
            {causeTop3.map((cause, index) => (
              <div key={cause.key} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-medium text-gray-800">
                    {index + 1}. {cause.label}
                  </div>
                  <div className="text-[12px] font-semibold text-gray-900">
                    {toCount(cause.count)} · {toPct(cause.ratio)}
                  </div>
                </div>
                <a href={evidenceLinks.bottleneck} className="text-[11px] text-blue-700 underline underline-offset-2">
                  원본 분석 화면
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">광역 개입 내역 요약</div>
          <div className="space-y-2">
            {interventionSummary.map((item) => (
              <div key={item.title} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-medium text-gray-800">{item.title}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.status === '완료' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                    {item.status}
                  </span>
                </div>
                <div className="text-[12px] text-gray-600 mt-1">
                  {item.stage} · {item.owner} · {item.count}건
                </div>
                <a href={evidenceLinks.actions} className="text-[11px] text-blue-700 underline underline-offset-2">
                  관련 개입 항목
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">개입 전/후 KPI 변화</div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1">지표</th>
                <th className="text-right py-1">Before</th>
                <th className="text-right py-1">After</th>
                <th className="text-right py-1">Δ</th>
                <th className="text-right py-1">증빙</th>
              </tr>
            </thead>
            <tbody>
              {kpiBeforeAfter.map((row) => {
                const improved = row.higherBetter ? row.delta > 0 : row.delta < 0;
                return (
                  <tr key={row.label} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-1 text-gray-700">{row.label}</td>
                    <td className="py-1 text-right text-gray-600">{formatByUnit(row.before, row.unit as '%' | '건')}</td>
                    <td className="py-1 text-right text-gray-600">{formatByUnit(row.after, row.unit as '%' | '건')}</td>
                    <td className={`py-1 text-right font-semibold ${improved ? 'text-emerald-700' : row.delta === 0 ? 'text-gray-700' : 'text-rose-700'}`}>
                      {row.delta > 0 ? '+' : ''}{formatByUnit(row.delta, row.unit as '%' | '건')}
                    </td>
                    <td className="py-1 text-right">
                      <a href={evidenceLinks.actions} className="text-blue-700 underline underline-offset-2">링크</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">미해결 과제 및 다음 기간 권고</div>
          <div className="space-y-2">
            {unresolvedTasks.map((task) => (
              <div key={task.title} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-medium text-gray-800">{task.title}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${task.risk === '높음' ? 'border-rose-300 bg-rose-100 text-rose-700' : 'border-amber-300 bg-amber-100 text-amber-700'}`}>
                    {task.risk}
                  </span>
                </div>
                <div className="text-[12px] text-gray-600 mt-1">권고: {task.recommendation}</div>
                <a href={evidenceLinks.actions} className="text-[11px] text-blue-700 underline underline-offset-2">
                  관련 개입 항목
                </a>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
              {rangeLabel} 요약 PDF
            </button>
            <button className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
              {rangeLabel} 운영 PPT
            </button>
            <button className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
              KPI CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
