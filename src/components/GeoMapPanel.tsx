import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { GeoMapPanel as CoreGeoMapPanel, MapColorScheme } from './geomap/GeoMapPanel';
import type { Level } from './geomap/KoreaDrilldownMap';
import { getKpiPalette, getKpiPaletteColors, getKpiLabel } from '../lib/choroplethScale';

const periodLabels: Record<'week' | 'month' | 'quarter' | 'year', string> = {
  week: '주간',
  month: '월간',
  quarter: '분기',
  year: '연간(누적)'
};

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
  /* KPI 기반 색상 동기화 */
  selectedKpi?: string;
  /* 드릴 상태 */
  drillLabel?: string;
  canDrillUp?: boolean;
  onDrillUp?: () => void;
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
  selectedKpi,
  drillLabel,
  canDrillUp,
  onDrillUp
}: GeoMapPanelProps) {
  const kpiColorScheme: MapColorScheme = selectedKpi
    ? (getKpiPalette(selectedKpi) as MapColorScheme)
    : 'blue';
  const kpiColors = selectedKpi ? getKpiPaletteColors(selectedKpi) : [];
  const kpiLabel = selectedKpi ? getKpiLabel(selectedKpi) : '';

  return (
    <div className="relative rounded-md border border-gray-200 bg-white">
      {/* ── 헤더: 드릴업 + 제목 + 기간 토글 ── */}
      <div className="border-b border-gray-200 px-4 py-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            {/* 드릴업 버튼 */}
            {canDrillUp && onDrillUp && (
              <button
                type="button"
                className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200 transition"
                onClick={onDrillUp}
                title="상위 단계로 이동"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                상위
              </button>
            )}
            <div>
              <div className="text-sm font-semibold text-gray-900">{title}</div>
              {drillLabel && (
                <div className="text-[11px] text-gray-500 mt-0.5">{drillLabel}</div>
              )}
            </div>
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
                    className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
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
          </div>
        </div>

        {/* KPI 기반 색상 범례 (항상 표시) */}
        {selectedKpi && kpiColors.length > 0 && (
          <div className="mt-2.5 flex items-center gap-3 pt-2 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">{kpiLabel}</span>
            <div className="flex items-center gap-0.5">
              {kpiColors.slice(0, 7).map((color, idx) => (
                <div
                  key={idx}
                  className="w-6 h-2.5 first:rounded-l last:rounded-r"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span>낮음</span>
              <span>→</span>
              <span>높음</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 지도 영역 ── */}
      <div className="relative p-4">
        <CoreGeoMapPanel
          title=""
          indicatorId={indicatorId}
          year={year}
          variant="portal"
          mapHeight={mapHeight}
          highlightCode={highlightCode}
          hideBreadcrumb
          hintText="지도 클릭 시 하위 단계 이동"
          onRegionSelect={onRegionSelect}
          externalColorScheme={kpiColorScheme}
          hideLegendPanel
        />
        {children && (
          <div className="absolute right-6 top-6">{children}</div>
        )}
      </div>
    </div>
  );
}
