import React from 'react';
import {
  Bar,
  CartesianGrid,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { CHART_COLORS } from '../styles/tokens';

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
};

export function BottomTrendPanel({
  data,
  loading,
  title = '전주 대비 증감률',
  xKey = 'week',
  footerLabel = '최근 12구간'
}: BottomTrendPanelProps) {
  if (loading) {
    return <div className="h-56 rounded-md border border-gray-200 bg-gray-50 animate-pulse" />;
  }

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
