import React from 'react';
import { GeoMapPanel as CoreGeoMapPanel } from './geomap/GeoMapPanel';
import type { Level } from './geomap/KoreaDrilldownMap';

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
  children
}: GeoMapPanelProps) {
  return (
    <div className="relative rounded-md border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            <div className="text-xs text-gray-500">선택 지표 기반</div>
          </div>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">기준 {year ?? 2026}</span>
        </div>
      </div>
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
