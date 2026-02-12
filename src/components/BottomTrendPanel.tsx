import React from 'react';
import {
  Bar,
  CartesianGrid,
  BarChart,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { CHART_COLORS } from '../styles/tokens';
import type { CentralKpiKey } from '../lib/centralKpiTheme';
import { getCentralKpiTheme } from '../lib/centralKpiTheme';

type TrendPoint = { period: string; value: number; delta: number };

type BottomTrendPanelProps = {
  data: Array<Record<string, any>> | null;
  loading?: boolean;
  title?: string;
  xKey?: string;
  primaryKey?: string;
  secondaryKey?: string;
  primaryColor?: string;
  secondaryColor?: string;
  footerLabel?: string;
  /** 중앙 KPI 기반 트렌드 */
  selectedKpi?: CentralKpiKey;
  centralTrend?: TrendPoint[] | null;
};

export function BottomTrendPanel({
  data,
  loading,
  title = '전주 대비 증감률',
  xKey = 'week',
  footerLabel = '최근 12구간',
  selectedKpi,
  centralTrend,
}: BottomTrendPanelProps) {
  if (loading) {
    return <div className="h-56 rounded-md border border-gray-200 bg-gray-50 animate-pulse" />;
  }

  /* ── 중앙 KPI 트렌드가 있으면 해당 데이터로 렌더링 ── */
  if (selectedKpi && centralTrend && centralTrend.length > 0) {
    const theme = getCentralKpiTheme(selectedKpi);
    return (
      <div className="rounded-md border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: theme.primaryColor }}
            />
            <span className="text-sm font-semibold text-gray-900">
              {theme.label} — 주간 추이
            </span>
          </div>
          <div className="text-xs text-gray-500">최근 12주</div>
        </div>
        <div className="mt-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={centralTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => theme.valueFormatter(v)}
                domain={['auto', 'auto']}
              />
              {theme.target != null && (
                <ReferenceLine y={theme.target} stroke="#9ca3af" strokeDasharray="4 4" label={{ value: `목표 ${theme.valueFormatter(theme.target)}`, fontSize: 10, fill: '#9ca3af' }} />
              )}
              <Tooltip
                content={({ payload, label }) => {
                  if (!payload?.[0]) return null;
                  const pt = payload[0].payload as TrendPoint;
                  return (
                    <div className="rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                      <div className="font-semibold text-gray-900">{label}</div>
                      <div style={{ color: theme.primaryColor }}>
                        {theme.label}: {theme.valueFormatter(pt.value)}
                      </div>
                      <div className={pt.delta >= 0 ? (theme.higherIsWorse ? 'text-red-500' : 'text-emerald-500') : (theme.higherIsWorse ? 'text-emerald-500' : 'text-red-500')}>
                        {pt.delta >= 0 ? '▲' : '▼'} {Math.abs(pt.delta).toFixed(1)}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {centralTrend.map((pt, idx) => (
                  <Cell
                    key={idx}
                    fill={theme.primaryColor}
                    fillOpacity={0.75 + (idx / centralTrend.length) * 0.25}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  /* ── 레거시 트렌드 (fallback) ── */

  if (!data) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-4 text-xs text-gray-500">데이터가 없습니다.</div>
    );
  }

  const chartData = data.map((item) => ({
    week: item[xKey] ?? '',
    changeRate: typeof item.changeRate === 'number' ? item.changeRate : 0,
    throughput: typeof item.throughput === 'number' ? item.throughput : 0
  }));

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">{footerLabel}</div>
      </div>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
              domain={['auto', 'auto']}
            />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={1.5} />
            <Tooltip
              content={({ payload, label }) => {
                if (!payload?.[0]) return null;
                const item = payload[0].payload;
                return (
                  <div className="rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                    <div className="font-semibold text-gray-900">{label}</div>
                    <div className="text-gray-600">
                      증감률: <span className={item.changeRate >= 0 ? 'text-emerald-600' : 'text-red-600'}>{item.changeRate > 0 ? '+' : ''}{item.changeRate}%</span>
                    </div>
                    <div className="text-gray-500">처리량: {item.throughput.toLocaleString()}건</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="changeRate" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.changeRate >= 0 ? '#16a34a' : CHART_COLORS.accent}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
