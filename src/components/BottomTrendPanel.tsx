import React from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
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
  title = '주간 처리량 추이',
  xKey = 'week',
  primaryKey = 'throughput',
  secondaryKey = 'slaRate',
  primaryColor = CHART_COLORS.primary,
  secondaryColor = CHART_COLORS.accent,
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

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">{footerLabel}</div>
      </div>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar yAxisId="left" dataKey={primaryKey} fill={primaryColor} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey={secondaryKey} stroke={secondaryColor} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
