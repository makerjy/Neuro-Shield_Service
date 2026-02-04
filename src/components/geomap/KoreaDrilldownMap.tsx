import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useResizeObserver } from './useResizeObserver';
import { RegionStat } from './geoStats';

export type Level = 'ctprvn' | 'sig' | 'emd';

export type KoreaDrilldownMapProps = {
  level: Level;
  features: any[];
  stats: RegionStat[];
  onSelect: (nextLevel: Level, code: string) => void;
  indicatorLabel?: string;
  unit?: string;
  year?: number;
  valueFormatter?: (value: number) => string;
};

const MIN_SIZE = 50;

function getFeatureCode(feature: any): string {
  return String(
    feature?.properties?.code ??
      feature?.properties?.CTPRVN_CD ??
      feature?.properties?.SIG_CD ??
      feature?.properties?.EMD_CD ??
      ''
  );
}

function getFeatureName(feature: any): string {
  return String(
    feature?.properties?.name ??
      feature?.properties?.CTP_KOR_NM ??
      feature?.properties?.SIG_KOR_NM ??
      feature?.properties?.EMD_KOR_NM ??
      '-'
  );
}

export function KoreaDrilldownMap({
  level,
  features,
  stats,
  onSelect,
  indicatorLabel = '지표',
  unit = '',
  year,
  valueFormatter
}: KoreaDrilldownMapProps) {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; value: number; code: string } | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomState, setZoomState] = useState(d3.zoomIdentity);

  const statsMap = useMemo(() => new Map(stats.map((s) => [s.code, s.value])), [stats]);

  const featureCollection = useMemo(
    () => ({ type: 'FeatureCollection', features }) as any,
    [features]
  );

  const colorScale = useMemo(() => {
    const values = stats.map((s) => s.value);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 100;
    const domain = min === max ? [min - 1, max + 1] : [min, max];
    return d3
      .scaleSequential((t) => d3.interpolateBlues(0.15 + 0.85 * t))
      .domain(domain as [number, number]);
  }, [stats]);

  const projection = useMemo(() => {
    if (width < MIN_SIZE || height < MIN_SIZE || !features.length) return null;
    return d3.geoIdentity().reflectY(true).fitSize([width, height], featureCollection);
  }, [width, height, featureCollection, features.length]);

  const path = useMemo(() => {
    if (!projection) return null;
    return d3.geoPath(projection);
  }, [projection]);

  const labelData = useMemo(() => {
    if (!path) return [] as { code: string; name: string; x: number; y: number }[];
    return features.map((feature) => {
      const code = getFeatureCode(feature);
      const name = getFeatureName(feature);
      const [x, y] = path.centroid(feature);
      return { code, name, x, y };
    });
  }, [features, path]);

  const applyTransform = (next: d3.ZoomTransform) => {
    if (gRef.current) {
      d3.select(gRef.current).attr('transform', next.toString());
    }
    setZoomState(next);
  };

  useEffect(() => {
    if (!svgRef.current) return;
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 5])
      .on('zoom', (event) => {
        applyTransform(event.transform);
      });
    const selection = d3.select(svgRef.current);
    selection.call(zoomBehavior as any);
    zoomRef.current = zoomBehavior;
  }, [width, height]);

  const handleZoom = (direction: 'in' | 'out') => {
    if (!svgRef.current || !zoomRef.current) return;
    const scale = direction === 'in' ? 1.2 : 0.8;
    const nextK = Math.max(1, Math.min(5, zoomState.k * scale));
    const next = d3.zoomIdentity.translate(zoomState.x, zoomState.y).scale(nextK);
    applyTransform(next);
  };

  const handleClick = (feature: any) => {
    const code = getFeatureCode(feature);
    if (!code) return;
    if (level === 'ctprvn') onSelect('sig', code);
    else if (level === 'sig') onSelect('emd', code);
  };

  return (
    <div ref={ref} className="relative w-full h-full">
      {width < MIN_SIZE || height < MIN_SIZE || !path ? (
        <div className="p-3 text-sm text-gray-500">
          {features.length === 0 ? '지도 데이터가 없습니다.' : '지도 영역이 작아 렌더링을 생략합니다.'}
        </div>
      ) : (
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="block"
          style={{ touchAction: 'none', cursor: 'grab' }}
          onWheel={(event) => {
            event.preventDefault();
            const direction = event.deltaY > 0 ? 0.9 : 1.1;
            const nextK = Math.max(1, Math.min(5, zoomState.k * direction));
            const point = d3.pointer(event, svgRef.current);
            const newX = point[0] - ((point[0] - zoomState.x) / zoomState.k) * nextK;
            const newY = point[1] - ((point[1] - zoomState.y) / zoomState.k) * nextK;
            applyTransform(d3.zoomIdentity.translate(newX, newY).scale(nextK));
          }}
        >
          <rect width={width} height={height} fill="transparent" style={{ pointerEvents: 'all' }} />
          <g ref={gRef} transform={`translate(${zoomState.x}, ${zoomState.y}) scale(${zoomState.k})`}>
            {features.map((feature) => {
              const code = getFeatureCode(feature);
              const value = statsMap.get(code) ?? 0;
              const fill = colorScale(value);
              const d = path(feature) || undefined;
              const isHovered = hoveredCode === code;
              return (
                <path
                  key={code}
                  d={d}
                  fill={fill}
                  stroke={isHovered ? '#0b1020' : '#111827'}
                  strokeWidth={isHovered ? 2.2 : 0.9}
                  fillOpacity={hoveredCode && !isHovered ? 0.65 : 0.95}
                  style={isHovered ? { filter: 'drop-shadow(0 3px 6px rgba(15, 23, 42, 0.35))' } : undefined}
                  onMouseMove={(event) => {
                    setTooltip({
                      x: event.clientX + 12,
                      y: event.clientY + 12,
                      name: getFeatureName(feature),
                      value,
                      code
                    });
                    setHoveredCode(code);
                  }}
                  onMouseLeave={() => {
                    setTooltip(null);
                    setHoveredCode(null);
                  }}
                  onClick={() => handleClick(feature)}
                  style={{ cursor: level === 'emd' ? 'default' : 'pointer' }}
                />
              );
            })}
            {labelData.map((label) => (
              <text
                key={`label-${label.code}`}
                x={label.x}
                y={label.y}
                fontSize={level === 'ctprvn' ? 12 : 10}
                fill="#1e3a8a"
                textAnchor="middle"
                pointerEvents="none"
                style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 }}
              >
                {label.name}
              </text>
            ))}
          </g>
        </svg>
      )}

      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow"
          onClick={() => handleZoom('in')}
          type="button"
        >
          확대
        </button>
        <button
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow"
          onClick={() => handleZoom('out')}
          type="button"
        >
          축소
        </button>
      </div>

      {tooltip && (
        <div
          className="fixed z-[9999] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xl"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-sm font-semibold mb-1">{tooltip.name}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-slate-500">{indicatorLabel}</span>
            <span className="text-base font-bold">
              {valueFormatter ? valueFormatter(tooltip.value) : tooltip.value}
              {!valueFormatter && unit ? <span className="text-xs ml-1">({unit})</span> : null}
            </span>
          </div>
          {typeof year === 'number' && (
            <div className="mt-1 text-[11px] text-slate-500">기준연도: {year}년</div>
          )}
        </div>
      )}
    </div>
  );
}
