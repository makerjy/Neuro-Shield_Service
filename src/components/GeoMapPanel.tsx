import React from 'react';
import { GeoMapPanel as CoreGeoMapPanel } from './geomap/GeoMapPanel';
import type { Level } from './geomap/KoreaDrilldownMap';

const periodLabels: Record<'week' | 'month' | 'quarter' | 'year', string> = {
  week: '주간',
  month: '월간',
  quarter: '분기',
  year: '연간(누적)'
};

const modeOptions = [
  { id: 'fill' as const, label: '열지도' },
  { id: 'dot' as const, label: '점' },
  { id: 'bubble' as const, label: '버블' }
];

export type GeoMapPanelProps = {
  title: string;
  indicatorId: string;
  year?: number;
  mapMode: 'fill' | 'dot' | 'bubble';
  mapAlpha: number;
  mapHeight?: number;
  highlightCode?: string;
  onRegionSelect?: (payload: { level: Level; code: string; name: string }) => void;
  children?: React.ReactNode;
  /* 중앙 패널 헤더 컨트롤 */
  period?: 'week' | 'month' | 'quarter' | 'year';
  onPeriodChange?: (p: 'week' | 'month' | 'quarter' | 'year') => void;
  onModeChange?: (m: 'fill' | 'dot' | 'bubble') => void;
};

export function GeoMapPanel({
  title,
  indicatorId,
  year,
  mapMode,
  mapAlpha,
  mapHeight = 520,
  highlightCode,
  onRegionSelect,
  children,
  period,
  onPeriodChange,
  onModeChange
}: GeoMapPanelProps) {
  return (
    <div className="relative rounded-md border border-gray-200 bg-white">
      {/* ── 헤더: 제목 + 기간 토글 + 시각화 모드 ── */}
      <div className="border-b border-gray-200 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
              기준 {year ?? 2026}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* 기간 토글 */}
            {period && onPeriodChange && (
              <div className="flex items-center gap-1">
                {(['week', 'month', 'quarter', 'year'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                      period === v
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    onClick={() => onPeriodChange(v)}
                  >
                    {periodLabels[v]}
                  </button>
                ))}
              </div>
            )}

            {/* 시각화 유형 */}
            {onModeChange && (
              <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
                {modeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                      mapMode === opt.id
                        ? 'bg-slate-700 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    onClick={() => onModeChange(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 지도 영역 ── */}
      <div className="relative p-4">
        <CoreGeoMapPanel
          title=""
          indicatorId={indicatorId}
          year={year}
          variant="portal"
          mapHeight={mapHeight}
          mapMode={mapMode}
          mapAlpha={mapAlpha}
          highlightCode={highlightCode}
          hideBreadcrumb
          hintText="지도 클릭 시 하위 단계 이동"
          onRegionSelect={onRegionSelect}
        />
        <div className="absolute right-6 top-6">{children}</div>
      </div>
    </div>
  );
}
