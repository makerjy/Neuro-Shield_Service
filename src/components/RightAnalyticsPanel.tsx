import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Legend,
  Line,
  LineChart,
} from 'recharts';
import { ChartCard } from './ChartCard';
import { AlertsCard } from './AlertsCard';
import { Charts as NationalCharts, RiskMatrixPoint, StageByRegion, AgeRiskItem } from '../mocks/mockApi';
import { AlertItem, Charts as RegionalCharts } from '../mocks/mockRegionalApi';
import { CHART_COLORS } from '../styles/tokens';
import type { CentralKpiKey, CentralKpiChartData } from '../lib/centralKpiTheme';
import { getCentralKpiTheme } from '../lib/centralKpiTheme';

const pieColors = ['#2563eb', '#e2e8f0'];

const renderTooltip = (value: any) => [`${value}`, ''];

type RightAnalyticsPanelProps = {
  variant?: 'national' | 'regional';
  charts: NationalCharts | RegionalCharts | null;
  alerts?: AlertItem[];
  loading?: boolean;
  onSelectRegion?: (regionId: string) => void;
  /** 중앙 KPI 기반 차트 */
  selectedKpi?: CentralKpiKey;
  centralChartData?: CentralKpiChartData | null;
};

export function RightAnalyticsPanel({ variant = 'national', charts, alerts, loading, onSelectRegion, selectedKpi, centralChartData }: RightAnalyticsPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-48 rounded-md border border-gray-200 bg-gray-50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!charts) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-4 text-xs text-gray-500">데이터가 없습니다.</div>
    );
  }

  if (variant === 'regional') {
    const regionalCharts = charts as RegionalCharts;
    return (
      <div className="space-y-3">
        <AlertsCard alerts={alerts ?? []} />

        <ChartCard
          title="접촉 성공 비율"
          tableData={regionalCharts.pieContact.map((item) => ({ label: item.name, value: `${item.value}%` }))}
          onTypeChange={() => undefined}
          onDownload={() => undefined}
        >
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={regionalCharts.pieContact} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                  {regionalCharts.pieContact.map((_, idx) => (
                    <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={renderTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="상담 완료 비율"
          tableData={regionalCharts.pieConsult.map((item) => ({ label: item.name, value: `${item.value}%` }))}
          onTypeChange={() => undefined}
          onDownload={() => undefined}
        >
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={regionalCharts.pieConsult} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                  {regionalCharts.pieConsult.map((_, idx) => (
                    <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={renderTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="지표별 현재값"
          tableData={regionalCharts.barMetrics.map((item) => ({ label: item.name, value: item.value }))}
          onTypeChange={() => undefined}
          onDownload={() => undefined}
        >
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalCharts.barMetrics} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="상위 지역"
          tableData={regionalCharts.barTopRegions.map((item) => ({ label: item.name, value: item.value }))}
          onTypeChange={() => undefined}
          onDownload={() => undefined}
        >
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalCharts.barTopRegions} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART_COLORS.secondary} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    );
  }

  const nationalCharts = charts as NationalCharts;

  /* ── 중앙 KPI 기반 3-slot 차트 시스템 ── */
  if (selectedKpi && centralChartData) {
    const theme = getCentralKpiTheme(selectedKpi);
    const { decomposition, decompositionType, causeDistribution, causeType, definitionLine, lastUpdated } = centralChartData;

    const renderDecomposition = () => {
      if (decompositionType === 'donut') {
        return (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={decomposition}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  label={({ name, value }) => `${name} ${value}`}
                >
                  {decomposition.map((d, i) => (
                    <Cell key={i} fill={d.color ?? theme.palette[i % theme.palette.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v}`, '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }
      // stackedBar / timeline → BarChart
      return (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={decomposition} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {decomposition.map((d, i) => (
                  <Cell key={i} fill={d.color ?? theme.palette[Math.min(i + 2, theme.palette.length - 1)]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    };

    const renderCause = () => {
      if (causeType === 'donut') {
        const causeColors = [theme.primaryColor, '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9'];
        return (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={causeDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  label={({ name, value }) => `${name} ${value}`}
                >
                  {causeDistribution.map((_, i) => (
                    <Cell key={i} fill={causeColors[i % causeColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v}`, '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }
      if (causeType === 'lineRank') {
        return (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={causeDistribution} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={50} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill={theme.primaryColor} radius={[0, 3, 3, 0]} fillOpacity={0.8}>
                  {causeDistribution.map((_, i) => (
                    <Cell key={i} fill={theme.palette[Math.min(i + 3, theme.palette.length - 1)]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      // bar / heatBar
      return (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={causeDistribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {causeDistribution.map((_, i) => (
                  <Cell key={i} fill={causeType === 'heatBar'
                    ? theme.palette[Math.min(i + 1, theme.palette.length - 1)]
                    : theme.primaryColor
                  } fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    };

    return (
      <div className="space-y-3">
        {/* Slot 1: KPI 정의 요약 */}
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: theme.primaryColor }}
            />
            <span className="text-sm font-semibold text-gray-900">{theme.label}</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{definitionLine}</p>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">
            <span>단위: {theme.unit}</span>
            {theme.target && <span>목표: {theme.valueFormatter(theme.target)}</span>}
            <span>갱신: {lastUpdated}</span>
          </div>
        </div>

        {/* Slot 2: 핵심 분해 차트 */}
        <ChartCard
          title={`${theme.shortLabel} — 구성 분해`}
          tableData={decomposition.map((d) => ({ label: d.name, value: String(d.value) }))}
          onTypeChange={() => undefined}
          onDownload={() => undefined}
        >
          {renderDecomposition()}
        </ChartCard>

        {/* Slot 3: 원인 기여도/분포 */}
        <ChartCard
          title={`${theme.shortLabel} — 원인 분포`}
          tableData={causeDistribution.map((d) => ({ label: d.name, value: String(d.value) }))}
          onTypeChange={() => undefined}
          onDownload={() => undefined}
        >
          {renderCause()}
        </ChartCard>
      </div>
    );
  }

  /* ── 레거시 national 차트 (fallback) ── */

  const SLA_THRESHOLD = 95;
  const DATA_THRESHOLD = 93;

  const STAGE_COLORS: Record<string, string> = {
    incoming: CHART_COLORS.primary,
    inProgress: '#0ea5e9',
    needRecontact: '#f59e0b',
    slaBreach: CHART_COLORS.accent,
    completed: '#16a34a'
  };

  const STAGE_LABELS: Record<string, string> = {
    incoming: '신규',
    inProgress: '처리중',
    needRecontact: '재접촉 필요',
    slaBreach: 'SLA 위반',
    completed: '완료'
  };

  const quadrantColor = (pt: RiskMatrixPoint) => {
    if (pt.slaRate >= SLA_THRESHOLD && pt.dataRate >= DATA_THRESHOLD) return '#16a34a';
    if (pt.slaRate >= SLA_THRESHOLD && pt.dataRate < DATA_THRESHOLD) return '#f59e0b';
    if (pt.slaRate < SLA_THRESHOLD && pt.dataRate >= DATA_THRESHOLD) return '#f59e0b';
    return CHART_COLORS.accent;
  };

  const matrixTableData = nationalCharts.riskMatrix.map((pt) => ({
    label: pt.regionName,
    value: `SLA ${pt.slaRate}% · Data ${pt.dataRate}%`
  }));

  const stageTableData = nationalCharts.stageByRegion.map((r) => ({
    label: r.regionName,
    value: `${r.incoming + r.inProgress + r.needRecontact + r.slaBreach + r.completed}건`
  }));

  return (
    <div className="space-y-3">
      {/* 1) SLA × 데이터 충족률 리스크 매트릭스 */}
      <ChartCard
        title="SLA × 데이터 충족률 리스크 매트릭스"
        tableData={matrixTableData}
        onTypeChange={() => undefined}
        onDownload={() => undefined}
      >
        {nationalCharts.riskMatrix.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-gray-400">
            데이터 부족 — 지역별 SLA·데이터 지표 로딩 중
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  dataKey="dataRate"
                  name="데이터 충족률"
                  unit="%"
                  domain={[70, 100]}
                  tick={{ fontSize: 10 }}
                  label={{ value: '데이터 충족률(%)', position: 'insideBottom', offset: -4, fontSize: 10, fill: '#6b7280' }}
                />
                <YAxis
                  type="number"
                  dataKey="slaRate"
                  name="SLA 준수율"
                  unit="%"
                  domain={[70, 100]}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'SLA 준수율(%)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 10, fill: '#6b7280' }}
                />
                <ZAxis type="number" dataKey="totalCases" range={[40, 300]} name="케이스 수" />
                <ReferenceLine x={DATA_THRESHOLD} stroke="#9ca3af" strokeDasharray="4 4" />
                <ReferenceLine y={SLA_THRESHOLD} stroke="#9ca3af" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const pt = payload[0].payload as RiskMatrixPoint;
                    return (
                      <div className="rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                        <div className="font-semibold text-gray-900">{pt.regionName}</div>
                        <div className="text-gray-600">SLA: {pt.slaRate}% · Data: {pt.dataRate}%</div>
                        <div className="text-gray-500">케이스: {pt.totalCases.toLocaleString()}건</div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={nationalCharts.riskMatrix}
                  onClick={(entry) => onSelectRegion?.(entry.regionId)}
                  cursor="pointer"
                >
                  {nationalCharts.riskMatrix.map((pt, idx) => (
                    <Cell key={idx} fill={quadrantColor(pt)} fillOpacity={0.85} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* 2) 연령대별 미처리/지연 리스크(%) */}
      <ChartCard
        title="연령대별 미처리/지연 리스크(%)"
        tableData={(nationalCharts.ageRisk ?? []).map((item) => ({
          label: item.ageGroup,
          value: `SLA ${item.slaViolation}% · 재접촉 ${item.recontactNeed}%`
        }))}
        onTypeChange={() => undefined}
        onDownload={() => undefined}
      >
        {!nationalCharts.ageRisk || nationalCharts.ageRisk.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-gray-400">
            데이터 부족 — 연령대별 리스크 데이터 로딩 중
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nationalCharts.ageRisk} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="ageGroup" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  content={({ payload, label }) => {
                    if (!payload?.length) return null;
                    return (
                      <div className="rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                        <div className="mb-1 font-semibold text-gray-900">{label}</div>
                        {payload.map((p) => (
                          <div key={p.dataKey as string} className="flex items-center gap-1.5 text-gray-600">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                            {p.dataKey === 'slaViolation' ? 'SLA 위반률' : '재접촉 필요율'}: {Number(p.value).toFixed(1)}%
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-[10px] text-gray-600">
                      {value === 'slaViolation' ? 'SLA 위반률' : '재접촉 필요율'}
                    </span>
                  )}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                />
                <Bar dataKey="slaViolation" fill={CHART_COLORS.accent} radius={[3, 3, 0, 0]} />
                <Bar dataKey="recontactNeed" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="KPI 구성 분포"
        tableData={nationalCharts.barKpi.map((item) => ({ label: item.name, value: item.value }))}
        onTypeChange={() => undefined}
        onDownload={() => undefined}
      >
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={nationalCharts.barKpi} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="센터 부하 분포"
        tableData={nationalCharts.barLoadByCenter.map((item) => ({ label: item.name, value: item.value }))}
        onTypeChange={() => undefined}
        onDownload={() => undefined}
      >
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={nationalCharts.barLoadByCenter} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill={CHART_COLORS.secondary} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
