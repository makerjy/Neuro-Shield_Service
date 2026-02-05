/* ═══════════════════════════════════════════════════════════════════════════════
   DonutKPI 컴포넌트 - 도넛 차트 (내부 라벨 표시)
═══════════════════════════════════════════════════════════════════════════════ */

import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { Download } from 'lucide-react';

interface DonutItem {
  name: string;
  value: number;
  color?: string;
}

interface DonutKPIProps {
  title: string;
  items: DonutItem[];
  valueFormat?: 'percent' | 'number';
  showCenterTotal?: boolean;
  showSlicePercent?: boolean;
  minLabelPercent?: number;
  totalLabel?: string;
  totalValue?: number;
  height?: number;
  onDownload?: () => void;
}

const DEFAULT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export function DonutKPI({
  title,
  items,
  valueFormat = 'percent',
  showCenterTotal = true,
  showSlicePercent = true,
  minLabelPercent = 5,
  totalLabel = '총합',
  totalValue,
  height = 180,
  onDownload,
}: DonutKPIProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 데이터 준비
  const data = useMemo(() => {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    return items.map((item, idx) => ({
      ...item,
      color: item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      percent: total > 0 ? (item.value / total) * 100 : 0,
    }));
  }, [items]);

  const total = useMemo(() => {
    return totalValue ?? items.reduce((sum, item) => sum + item.value, 0);
  }, [items, totalValue]);

  // 활성화된 섹터 렌더링
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
    
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 2}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15))' }}
        />
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 2}
          outerRadius={innerRadius + 2}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };

  // 슬라이스 내부 라벨
  const renderLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;
    
    // 너무 작은 조각은 라벨 숨김
    if (!showSlicePercent || percent * 100 < minLabelPercent) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  // 센터 라벨 컴포넌트
  const CenterLabel = () => {
    const displayItem = activeIndex !== null ? data[activeIndex] : null;
    
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {displayItem ? (
          <>
            <div className="text-xs text-gray-500 font-medium">{displayItem.name}</div>
            <div className="text-lg font-bold" style={{ color: displayItem.color }}>
              {valueFormat === 'percent' 
                ? `${displayItem.percent.toFixed(2)}%`
                : displayItem.value.toLocaleString()
              }
            </div>
            <div className="text-[10px] text-gray-400">
              {displayItem.value.toLocaleString()}건
            </div>
          </>
        ) : showCenterTotal ? (
          <>
            <div className="text-xs text-gray-500 font-medium">{totalLabel}</div>
            <div className="text-xl font-bold text-gray-800">
              {total.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400">건</div>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <div className="flex items-center gap-1">
          <button 
            className="px-2 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
          >
            통계표 보기
          </button>
          {onDownload && (
            <button 
              onClick={onDownload}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <Download className="h-3 w-3 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="p-3">
        <div className="relative" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {data.map((item, idx) => (
                  <linearGradient key={`gradient-${idx}`} id={`donutGradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={item.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={item.color} stopOpacity={0.8} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                activeIndex={activeIndex ?? undefined}
                activeShape={renderActiveShape}
                label={renderLabel}
                labelLine={false}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((entry, idx) => (
                  <Cell 
                    key={`cell-${idx}`} 
                    fill={`url(#donutGradient-${idx})`}
                    stroke="none"
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <CenterLabel />
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
          {data.map((item, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <span 
                className="w-2.5 h-2.5 rounded-full shadow-sm" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] text-gray-600">
                {item.name}
              </span>
              <span className="text-[11px] font-semibold text-gray-800">
                {item.percent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
