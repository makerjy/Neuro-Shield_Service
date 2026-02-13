import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ComposedChart,
  Legend,
} from 'recharts';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import type { RegionalScope } from '../geomap/regions';
import type { InternalRangeKey, KpiKey, InterventionDraft, QueueBreakdown, CauseItem } from './opsContracts';
import { safeOpsText } from '../../lib/uiTextGuard';

interface RegionalCausePageProps {
  region: RegionalScope;
  districtOptions: string[];
  selectedKpiKey: KpiKey;
  selectedRegionSgg: string | null;
  selectedRange: InternalRangeKey;
  onSelectedKpiKeyChange: (kpi: KpiKey) => void;
  onSelectedRegionSggChange: (sgg: string | null) => void;
  onSelectedRangeChange: (range: InternalRangeKey) => void;
  onCreateIntervention?: (draft: InterventionDraft) => void;
}

const RANGE_LABEL: Record<InternalRangeKey, string> = {
  week: '주간',
  month: '월간',
  quarter: '분기',
};

const KPI_LABEL: Record<KpiKey, string> = {
  regionalSla: '신규 유입',
  regionalQueueRisk: '처리 중',
  regionalRecontact: 'SLA 위험',
  regionalDataReadiness: '재접촉 필요',
  regionalGovernance: '센터 리스크',
  regionalAdTransitionHotspot: 'AD 전환 위험',
  regionalDxDelayHotspot: '감별검사 지연',
  regionalScreenToDxRate: '선별→정밀연계 전환율',
};

const hashSeed = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
};

const sv = (seed: string, min: number, max: number) => min + (max - min) * ((hashSeed(seed) % 1000) / 1000);

function buildQueueBreakdown(seed: string): QueueBreakdown[] {
  const raw = [
    { stage: 'contact', label: '접촉', backlog: Math.round(sv(`${seed}-q-contact`, 20, 140)) },
    { stage: 'recontact', label: '재접촉', backlog: Math.round(sv(`${seed}-q-recontact`, 18, 130)) },
    { stage: 'secondary', label: '2차', backlog: Math.round(sv(`${seed}-q-secondary`, 14, 110)) },
    { stage: 'l2', label: 'L2', backlog: Math.round(sv(`${seed}-q-l2`, 12, 95)) },
    { stage: 'tertiary', label: '3차', backlog: Math.round(sv(`${seed}-q-tertiary`, 10, 88)) },
  ];
  const total = raw.reduce((sum, item) => sum + item.backlog, 0);
  return raw.map((item) => ({ ...item, share: total > 0 ? Number(((item.backlog / total) * 100).toFixed(1)) : 0 }));
}

function buildCauseItems(seed: string): CauseItem[] {
  return [
    {
      id: 'staff',
      label: '인력 여유 부족',
      value: Math.round(sv(`${seed}-c-staff`, 8, 40)),
      unit: '%',
      actionHint: safeOpsText('인력 슬롯 재배치가 필요함'),
    },
    {
      id: 'contact',
      label: '연락 실패',
      value: Math.round(sv(`${seed}-c-contact`, 12, 46)),
      unit: '%',
      actionHint: safeOpsText('시간대 재접촉 운영이 필요함'),
    },
    {
      id: 'data',
      label: '데이터 부족',
      value: Math.round(sv(`${seed}-c-data`, 6, 35)),
      unit: '%',
      actionHint: safeOpsText('필수 필드 보완 요청이 필요함'),
    },
    {
      id: 'booking',
      label: '예약 대기',
      value: Math.round(sv(`${seed}-c-booking`, 4, 28)),
      unit: '%',
      actionHint: safeOpsText('예약 슬롯 확장이 필요함'),
    },
    {
      id: 'etc',
      label: '기타 운영 지연',
      value: Math.round(sv(`${seed}-c-etc`, 3, 24)),
      unit: '%',
      actionHint: safeOpsText('운영 동선 점검이 필요함'),
    },
  ].sort((a, b) => b.value - a.value);
}

export function RegionalCausePage({
  region,
  districtOptions,
  selectedKpiKey,
  selectedRegionSgg,
  selectedRange,
  onSelectedKpiKeyChange,
  onSelectedRegionSggChange,
  onSelectedRangeChange,
  onCreateIntervention,
}: RegionalCausePageProps) {
  const [stageImpactOpen, setStageImpactOpen] = useState(false);

  const scopeSeed = `${region.id}-${selectedRegionSgg ?? 'all'}-${selectedKpiKey}-${selectedRange}`;

  const queueBreakdown = useMemo(() => buildQueueBreakdown(scopeSeed), [scopeSeed]);
  const causeTopN = useMemo(() => buildCauseItems(scopeSeed), [scopeSeed]);

  const trend7 = useMemo(
    () => ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'D0'].map((label, idx) => ({
      label,
      backlog: Number(sv(`${scopeSeed}-trend-b-${idx}`, 18, 74).toFixed(1)),
      causeRate: Number(sv(`${scopeSeed}-trend-c-${idx}`, 6, 42).toFixed(1)),
    })),
    [scopeSeed],
  );

  const regionComparison = useMemo(() => {
    return districtOptions.slice(0, 8).map((district, idx) => {
      const base = sv(`${scopeSeed}-cmp-base-${district}`, 15, 75);
      const avg = sv(`${scopeSeed}-cmp-avg`, 20, 60);
      return {
        name: district,
        value: Number(base.toFixed(1)),
        delta: Number((base - avg).toFixed(1)),
      };
    });
  }, [districtOptions, scopeSeed]);

  const stageImpactRows = useMemo(() => {
    return [
      {
        stage: 'Stage1 (ML)',
        signal: Number(sv(`${scopeSeed}-s1-signal`, -18, 22).toFixed(1)),
        queue: Math.round(sv(`${scopeSeed}-s1-queue`, -24, 54)),
        desc: '보조 신호 변화와 처리 큐 변화가 함께 나타남',
      },
      {
        stage: 'Stage2 (ANN)',
        signal: Number(sv(`${scopeSeed}-s2-signal`, -16, 20).toFixed(1)),
        queue: Math.round(sv(`${scopeSeed}-s2-queue`, -18, 46)),
        desc: '보조 신호 변화와 2차 대기 변화가 함께 나타남',
      },
      {
        stage: 'Stage3 (CNN)',
        signal: Number(sv(`${scopeSeed}-s3-signal`, -14, 18).toFixed(1)),
        queue: Math.round(sv(`${scopeSeed}-s3-queue`, -16, 40)),
        desc: '보조 신호 변화와 3차 경로 큐 변화가 함께 나타남',
      },
    ];
  }, [scopeSeed]);

  const operationSuggestions = useMemo(() => {
    return causeTopN.slice(0, 3).map((item) => ({
      title: `${item.label} 비중 ${item.value}${item.unit}`,
      description: item.actionHint,
    }));
  }, [causeTopN]);

  return (
    <div className="h-full overflow-auto bg-gray-50 p-4 space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-800">병목·원인 분석</div>
            <div className="text-[12px] text-gray-500">입력: KPI · 시군구 · 기간 · Stage 영향 토글</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                onCreateIntervention?.({
                  region: selectedRegionSgg,
                  kpiKey: selectedKpiKey,
                  range: selectedRange,
                  source: 'cause',
                })
              }
              className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              개입 만들기
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            value={selectedKpiKey}
            onChange={(event) => onSelectedKpiKeyChange(event.target.value as KpiKey)}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-sm"
          >
            {Object.entries(KPI_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={selectedRegionSgg ?? ''}
            onChange={(event) => onSelectedRegionSggChange(event.target.value || null)}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="">{region.label} 전체</option>
            {districtOptions.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>

          <select
            value={selectedRange}
            onChange={(event) => onSelectedRangeChange(event.target.value as InternalRangeKey)}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="week">주간</option>
            <option value="month">월간</option>
            <option value="quarter">분기</option>
          </select>

          <button
            onClick={() => setStageImpactOpen((prev) => !prev)}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1"
          >
            Stage 영향 {stageImpactOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">단계별 적체 분해</div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={queueBreakdown} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `${Math.round(value)}건`} />
                <Bar dataKey="backlog" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">병목 원인 TopN</div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={causeTopN} layout="vertical" margin={{ top: 8, right: 10, left: 18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="label" type="category" width={90} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">지역 비교 (관할 평균 대비 Δ)</div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={regionComparison} margin={{ top: 8, right: 8, left: -10, bottom: 52 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number, key) => `${Number(value).toFixed(1)}${key === 'delta' ? '%p' : '%'}`} />
                <Legend wrapperStyle={{ fontSize: '12px' }} formatter={(name) => (name === 'value' ? '원인 비중' : '관할 평균 대비 Δ')} />
                <Bar yAxisId="left" dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" dataKey="delta" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">원인 변화 추이</div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend7} margin={{ top: 8, right: 8, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number, key) => `${Number(value).toFixed(1)}${key === 'backlog' ? '건' : '%'}`} />
                <Legend wrapperStyle={{ fontSize: '12px' }} formatter={(name) => (name === 'backlog' ? '적체 건수' : '원인 비중')} />
                <Line type="monotone" dataKey="backlog" stroke="#ef4444" strokeWidth={2.2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="causeRate" stroke="#f59e0b" strokeWidth={2.2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-700">운영 제안</span>
        </div>
        <div className="space-y-2">
          {operationSuggestions.map((item, idx) => (
            <div key={idx} className="p-2 rounded border border-orange-100 bg-orange-50">
              <div className="text-[13px] font-medium text-orange-900">{item.title}</div>
              <div className="text-[12px] text-orange-800">{item.description}</div>
            </div>
          ))}
        </div>
      </div>

      {stageImpactOpen && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">Stage1/2/3 영향 (기본 접힘)</div>
          <div className="space-y-2">
            {stageImpactRows.map((item) => (
              <div key={item.stage} className="p-2 rounded border border-gray-100 bg-gray-50">
                <div className="text-[13px] font-medium text-gray-800">{item.stage}</div>
                <div className="text-[12px] text-gray-600">
                  보조 신호 {item.signal > 0 ? '증가' : '감소'} ({item.signal > 0 ? '+' : ''}{item.signal}%) · 큐 {item.queue > 0 ? '증가' : '감소'} ({item.queue > 0 ? '+' : ''}{item.queue}건)
                </div>
                <div className="text-[11px] text-gray-500">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[12px] text-gray-500">
        기준: {region.label} · {selectedRegionSgg ?? '광역 전체'} · {KPI_LABEL[selectedKpiKey]} · {RANGE_LABEL[selectedRange]}
      </div>
    </div>
  );
}
