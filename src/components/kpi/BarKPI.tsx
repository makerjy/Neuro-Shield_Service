/* ═══════════════════════════════════════════════════════════════════════════════
   BarKPI 컴포넌트 - 막대 차트 (가로/세로)
═══════════════════════════════════════════════════════════════════════════════ */

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, LabelList 
} from 'recharts';
import { Download } from 'lucide-react';

interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface BarKPIProps {
  title: string;
  items: BarItem[];
  layout?: 'vertical' | 'horizontal';
  showLabels?: boolean;
  showLegend?: boolean;
  valueFormat?: 'number' | 'percent';
  height?: number;
  colorScheme?: string[];
  onDownload?: () => void;
}

const DEFAULT_COLORS = [
  '#3b82f6', '#60a5fa', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4',
  '#84cc16', '#f97316', '#14b8a6', '#a855f7', '#f43f5e',
];

const GRADIENTS = [
  { start: '#3b82f6', end: '#1d4ed8' },
  { start: '#60a5fa', end: '#3b82f6' },
  { start: '#22c55e', end: '#16a34a' },
  { start: '#f59e0b', end: '#d97706' },
  { start: '#ec4899', end: '#db2777' },
  { start: '#8b5cf6', end: '#7c3aed' },
  { start: '#06b6d4', end: '#0891b2' },
];

export function BarKPI({
  title,
  items,
  layout = 'horizontal',
  showLabels = true,
  valueFormat = 'number',
  height = 160,
  colorScheme,
  onDownload,
}: BarKPIProps) {
  const colors = colorScheme || DEFAULT_COLORS;
  
  const data = items.map((item, idx) => ({
    ...item,
    color: item.color || colors[idx % colors.length],
  }));

  const formatValue = (value: number) => {
    if (valueFormat === 'percent') {
      return `${value.toFixed(1)}%`;
    }
    return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
        <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
        <div className="text-sm font-bold text-gray-900">
          {valueFormat === 'percent' 
            ? `${payload[0].value.toFixed(2)}%`
            : payload[0].value.toLocaleString() + '건'
          }
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <div className="flex items-center gap-1">
          <button className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
            통계표 보기
          </button>
          {onDownload && (
            <button onClick={onDownload} className="p-1 hover:bg-gray-200 rounded transition-colors">
              <Download className="h-3 w-3 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="p-3" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {layout === 'vertical' ? (
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 60, bottom: 5 }}>
              <defs>
                {GRADIENTS.map((g, idx) => (
                  <linearGradient key={idx} id={`barGradH-${idx}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={g.start} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={g.end} stopOpacity={1} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis 
                type="number" 
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickFormatter={formatValue}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis 
                type="category" 
                dataKey="label" 
                tick={{ fontSize: 10, fill: '#374151' }}
                width={55}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={800}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={`url(#barGradH-${idx % GRADIENTS.length})`} />
                ))}
                {showLabels && (
                  <LabelList 
                    dataKey="value" 
                    position="right" 
                    formatter={formatValue}
                    style={{ fontSize: 10, fill: '#374151', fontWeight: 500 }}
                  />
                )}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 25 }}>
              <defs>
                {GRADIENTS.map((g, idx) => (
                  <linearGradient key={idx} id={`barGradV-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={g.start} stopOpacity={1} />
                    <stop offset="100%" stopColor={g.end} stopOpacity={0.9} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 9, fill: '#6b7280' }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={40}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickFormatter={formatValue}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={800}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={`url(#barGradV-${idx % GRADIENTS.length})`} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
