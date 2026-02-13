import React from 'react';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  ReferenceLine,
  Cell,
  LabelList,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

export type ChartUnit = '건' | '%' | '점' | '일' | '%p';

type NamedValue = { name: string; value: number };

type TrendValue = {
  label: string;
  regional: number;
  national?: number;
  district?: number;
};

type DeltaValue = {
  name: string;
  value: number;
  delta: number;
};

const AXIS_TICK_STYLE = { fontSize: 11, fill: '#6b7280' } as const;
const GRID_STROKE = '#e5e7eb';

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatDelta(value: number, unit: '건' | '점' | '%p' = '%p'): string {
  if (unit === '건') return `${value > 0 ? '+' : ''}${Math.round(value)}건`;
  if (unit === '점') return `${value > 0 ? '+' : ''}${Math.round(value)}점`;
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%p`;
}

export function formatByUnit(value: number, unit: ChartUnit): string {
  if (unit === '건') return `${formatNumber(value)}건`;
  if (unit === '점') return `${Math.round(value)}점`;
  if (unit === '일') return `${Math.round(value)}일`;
  if (unit === '%') return formatPercent(value, 1);
  return formatDelta(value, '%p');
}

function formatLabelByUnit(value: number, unit: ChartUnit): string {
  if (unit === '건') return `${formatCompact(value)}건`;
  if (unit === '점') return `${formatCompact(value)}점`;
  if (unit === '일') return `${Math.round(value)}일`;
  if (unit === '%') return `${value.toFixed(1)}%`;
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%p`;
}

function getDomain(unit: ChartUnit, values: number[]): [number, number | 'auto'] {
  if (unit === '%') return [0, 100];
  const max = values.length ? Math.max(...values) : 0;
  return [0, Math.max(1, Math.ceil(max * 1.12))];
}

function ChartTooltip({
  active,
  payload,
  label,
  valueUnit,
  deltaKeys = [],
  deltaUnit = '%p',
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
  valueUnit: ChartUnit;
  deltaKeys?: string[];
  deltaUnit?: ChartUnit;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-md border border-gray-200 bg-white px-2.5 py-2 shadow-lg">
      {label != null && <div className="text-[11px] font-semibold text-gray-700 mb-1">{String(label)}</div>}
      <div className="space-y-1">
        {payload.map((item, idx) => {
          const numeric = typeof item.value === 'number' ? item.value : 0;
          const isDelta = item.name ? deltaKeys.includes(item.name) : false;
          const unit: ChartUnit = isDelta ? deltaUnit : valueUnit;
          return (
            <div key={`${item.name ?? idx}-${idx}`} className="grid grid-cols-[1fr_auto] items-center gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-gray-600">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color ?? '#94a3b8' }}
                />
                <span className="truncate">{item.name ?? `value-${idx + 1}`}</span>
              </div>
              <span className="font-semibold text-gray-900 tabular-nums">{formatByUnit(numeric, unit)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartHeader({
  title,
  subtitle,
  scopeLabel,
  action,
}: {
  title: string;
  subtitle?: string;
  scopeLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate">{title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {scopeLabel && <span className="text-gray-400">· {scopeLabel}</span>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  scopeLabel,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  scopeLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <ChartHeader title={title} subtitle={subtitle} scopeLabel={scopeLabel} action={action} />
      {children}
    </div>
  );
}

export function ChartEmpty({ message = '데이터가 없습니다.' }: { message?: string }) {
  return (
    <div className="h-[220px] rounded-lg border border-dashed border-gray-200 bg-gray-50 text-[12px] text-gray-500 flex items-center justify-center">
      {message}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <div className="animate-pulse rounded-lg bg-gray-200" style={{ height }} />;
}

export function KpiTrendLine({
  title,
  subtitle,
  data,
  unit,
  color,
  markerIndex,
  regionalLabel = '광역',
  nationalLabel = '전국 참고',
  districtLabel,
  scopeLabel,
}: {
  title: string;
  subtitle?: string;
  data: TrendValue[];
  unit: ChartUnit;
  color: string;
  markerIndex?: number | null;
  regionalLabel?: string;
  nationalLabel?: string;
  districtLabel?: string;
  scopeLabel?: string;
}) {
  if (!data.length) return <ChartCard title={title} subtitle={subtitle}><ChartEmpty /></ChartCard>;

  const valueSeries = data.flatMap((row) => [row.regional, row.national ?? 0, row.district ?? 0]);
  const domain = getDomain(unit, valueSeries);
  const markerLabel = markerIndex != null && markerIndex >= 0 && markerIndex < data.length ? data[markerIndex].label : null;

  return (
    <ChartCard title={title} subtitle={subtitle} scopeLabel={scopeLabel}>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK_STYLE} interval="preserveStartEnd" />
            <YAxis tick={AXIS_TICK_STYLE} tickCount={6} domain={domain} />
            <Tooltip content={<ChartTooltip valueUnit={unit} />} />
            <Line type="monotone" dataKey="regional" name={regionalLabel} stroke={color} strokeWidth={2.2} dot={{ r: 2.6, fill: color }}>
              <LabelList
                dataKey="regional"
                position="top"
                formatter={(value: number) => formatLabelByUnit(value, unit)}
                style={{ fontSize: 10, fill: color, fontWeight: 600 }}
              />
            </Line>
            <Line type="monotone" dataKey="national" name={nationalLabel} stroke="#9ca3af" strokeWidth={1.6} dot={false} strokeDasharray="4 3" />
            {districtLabel && (
              <Line type="monotone" dataKey="district" name={districtLabel} stroke="#ef4444" strokeWidth={1.8} dot={{ r: 2.2, fill: '#ef4444' }} />
            )}
            {markerLabel && <ReferenceLine x={markerLabel} stroke="#2563eb" strokeDasharray="4 3" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function TopNHorizontalBar({
  title,
  subtitle,
  data,
  unit,
  color,
  scopeLabel,
  maxItems = 7,
  onItemClick,
}: {
  title: string;
  subtitle?: string;
  data: NamedValue[];
  unit: ChartUnit;
  color: string;
  scopeLabel?: string;
  maxItems?: number;
  onItemClick?: (item: NamedValue) => void;
}) {
  const rows = data.slice(0, maxItems);
  if (!rows.length) return <ChartCard title={title} subtitle={subtitle}><ChartEmpty /></ChartCard>;

  const domain = getDomain(unit, rows.map((row) => row.value));

  return (
    <ChartCard title={title} subtitle={subtitle} scopeLabel={scopeLabel}>
      <div style={{ height: 230 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 52, left: 24, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
            <XAxis type="number" tick={AXIS_TICK_STYLE} tickCount={6} domain={domain} />
            <YAxis dataKey="name" type="category" tick={AXIS_TICK_STYLE} width={88} />
            <Tooltip content={<ChartTooltip valueUnit={unit} />} />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value: number) => formatLabelByUnit(value, unit)}
                style={{ fontSize: 10, fill: '#334155', fontWeight: 600 }}
              />
              {rows.map((row, idx) => (
                <Cell
                  key={`${row.name}-${idx}`}
                  cursor={onItemClick ? 'pointer' : 'default'}
                  onClick={() => onItemClick?.(row)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function DonutBreakdown({
  title,
  subtitle,
  data,
  unit,
  scopeLabel,
  colors = ['#f97316', '#fb923c', '#f59e0b', '#ef4444', '#d97706'],
  onSliceClick,
}: {
  title: string;
  subtitle?: string;
  data: NamedValue[];
  unit: ChartUnit;
  scopeLabel?: string;
  colors?: string[];
  onSliceClick?: (item: NamedValue) => void;
}) {
  if (!data.length) return <ChartCard title={title} subtitle={subtitle}><ChartEmpty /></ChartCard>;

  return (
    <ChartCard title={title} subtitle={subtitle} scopeLabel={scopeLabel}>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={44}
              outerRadius={76}
              paddingAngle={2}
              labelLine={false}
              label={({ name, value }) => `${name}: ${formatLabelByUnit(Number(value), unit)}`}
              onClick={(entry) => {
                if (!entry) return;
                const item = { name: String(entry.name), value: Number(entry.value) };
                onSliceClick?.(item);
              }}
            >
              {data.map((item, idx) => (
                <Cell key={`${item.name}-${idx}`} fill={colors[idx % colors.length]} cursor={onSliceClick ? 'pointer' : 'default'} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueUnit={unit} />} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function StageContribution({
  title,
  subtitle,
  scopeLabel,
  data,
  unit,
  colorScale,
}: {
  title: string;
  subtitle?: string;
  scopeLabel?: string;
  data: NamedValue[];
  unit: ChartUnit;
  colorScale?: string[];
}) {
  if (!data.length) return <ChartCard title={title} subtitle={subtitle}><ChartEmpty /></ChartCard>;

  const rawMax = Math.max(...data.map((item) => item.value));
  const displayUnit: ChartUnit = unit === '%' && rawMax > 100 ? '점' : unit;
  const domain = getDomain(displayUnit, data.map((item) => item.value));
  const palette = colorScale ?? ['#ef4444', '#f97316', '#f59e0b', '#fb7185', '#dc2626'];
  const note =
    unit === '%' && rawMax > 100
      ? '원천값이 100을 넘어 기여도 점수로 표시'
      : subtitle;

  return (
    <ChartCard title={title} subtitle={note} scopeLabel={scopeLabel}>
      <div style={{ height: 230 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 10, left: -8, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="name" tick={AXIS_TICK_STYLE} interval={0} angle={-20} textAnchor="end" height={56} />
            <YAxis tick={AXIS_TICK_STYLE} tickCount={6} domain={domain} />
            <Tooltip content={<ChartTooltip valueUnit={displayUnit} />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="value"
                position="top"
                formatter={(value: number) => formatLabelByUnit(value, displayUnit)}
                style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
              />
              {data.map((item, idx) => (
                <Cell key={`${item.name}-${idx}`} fill={palette[idx % palette.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function DeltaScatterOrBar({
  title,
  subtitle,
  scopeLabel,
  data,
  valueUnit,
  deltaUnit = '%p',
  barColor = '#2563eb',
  lineColor = '#ef4444',
}: {
  title: string;
  subtitle?: string;
  scopeLabel?: string;
  data: DeltaValue[];
  valueUnit: ChartUnit;
  deltaUnit?: ChartUnit;
  barColor?: string;
  lineColor?: string;
}) {
  if (!data.length) return <ChartCard title={title} subtitle={subtitle}><ChartEmpty /></ChartCard>;

  const valueDomain = getDomain(valueUnit, data.map((row) => row.value));
  const maxDelta = Math.max(...data.map((row) => Math.abs(row.delta)), 1);
  const deltaDomain: [number, number] = [-Math.ceil(maxDelta * 1.2), Math.ceil(maxDelta * 1.2)];

  return (
    <ChartCard title={title} subtitle={subtitle} scopeLabel={scopeLabel}>
      <div style={{ height: 236 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="name" tick={AXIS_TICK_STYLE} interval={0} angle={-28} textAnchor="end" height={58} />
            <YAxis yAxisId="left" tick={AXIS_TICK_STYLE} tickCount={6} domain={valueDomain} />
            <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK_STYLE} tickCount={5} domain={deltaDomain} />
            <ReferenceLine yAxisId="right" y={0} stroke="#cbd5e1" />
            <Tooltip
              content={
                <ChartTooltip
                  valueUnit={valueUnit}
                  deltaKeys={['평균 대비 Δ']}
                  deltaUnit={deltaUnit}
                />
              }
            />
            <Bar yAxisId="left" dataKey="value" name="KPI 값" fill={barColor} radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="value"
                position="top"
                formatter={(value: number) => formatLabelByUnit(value, valueUnit)}
                style={{ fontSize: 10, fill: '#334155', fontWeight: 600 }}
              />
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="delta" name="평균 대비 Δ" stroke={lineColor} strokeWidth={2} dot={{ r: 2.5 }}>
              <LabelList
                dataKey="delta"
                position="top"
                formatter={(value: number) => formatLabelByUnit(value, deltaUnit)}
                style={{ fontSize: 10, fill: lineColor, fontWeight: 600 }}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
