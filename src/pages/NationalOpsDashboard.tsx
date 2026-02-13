import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeaderBar } from '../components/HeaderBar';
import { LeftKpiPanel } from '../components/LeftKpiPanel';
import { GeoMapPanel } from '../components/GeoMapPanel';
import { RightAnalyticsPanel } from '../components/RightAnalyticsPanel';
import { BottomTrendPanel } from '../components/BottomTrendPanel';
import { fetchDashboard, fetchCentralDashboard, RegionKey } from '../mocks/mockApi';
import { SIDO_OPTIONS, SIGUNGU_OPTIONS } from '../mocks/mockGeo';
import { GEO_INDICATORS } from '../components/geomap/geoIndicators';
import { getKpiLabel } from '../lib/choroplethScale';
import type { KpiHeaderOption } from '../components/HeaderBar';
import type { CentralKpiKey } from '../lib/centralKpiTheme';
import type { CentralDashboardData } from '../lib/centralKpiTheme';
import { getCentralKpiTheme } from '../lib/centralKpiTheme';

const metricOptions = GEO_INDICATORS.map((item) => ({ id: item.id, label: item.label }));

/* 사건 단계 색상 / 라벨 (RightAnalyticsPanel과 공유) */
const STAGE_LEGEND = [
  { key: 'incoming', label: '신규', color: '#2563eb' },
  { key: 'inProgress', label: '처리중', color: '#0ea5e9' },
  { key: 'needRecontact', label: '재접촉 필요', color: '#f59e0b' },
  { key: 'slaBreach', label: 'SLA 위반', color: '#ef4444' },
  { key: 'completed', label: '완료', color: '#16a34a' }
];

/* KPI 색상 매핑은 lib/choroplethScale.ts의 KPI_PALETTE_MAP 유틸리티로 통합 */

export function NationalOpsDashboard() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('week');
  const [metricId, setMetricId] = useState(metricOptions[0]?.id ?? 'total_cases');
  const [selectedSido, setSelectedSido] = useState('all');
  const [selectedSigungu, setSelectedSigungu] = useState('');
  const [mapMode, setMapMode] = useState<'fill' | 'dot' | 'bubble'>('fill');
  const [mapLevels, setMapLevels] = useState(7);
  const [mapAlpha, setMapAlpha] = useState(0.95);
  const [selectedKpi, setSelectedKpi] = useState<CentralKpiKey>('signalQuality');

  const [data, setData] = useState<any | null>(null);
  const [centralData, setCentralData] = useState<CentralDashboardData | null>(null);
  const [status, setStatus] = useState<'loadingInitial' | 'loadingRegion' | 'ready' | 'empty' | 'partial' | 'error'>('loadingInitial');
  const [lastUpdated, setLastUpdated] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const didInit = useRef(false);

  const sigunguOptions = useMemo(() => {
    if (selectedSido === 'all') return [];
    return SIGUNGU_OPTIONS[selectedSido] ?? [];
  }, [selectedSido]);

  const regionLabel = useMemo(() => {
    if (selectedSido === 'all') return '전국';
    const sidoLabel = SIDO_OPTIONS.find((item) => item.code === selectedSido)?.label ?? selectedSido;
    if (!selectedSigungu) return sidoLabel;
    const sigLabel = sigunguOptions.find((item) => item.code === selectedSigungu)?.label ?? selectedSigungu;
    return `${sidoLabel} ${sigLabel}`;
  }, [selectedSido, selectedSigungu, sigunguOptions]);

  const regionKey = useMemo<RegionKey>(() => {
    if (selectedSido === 'all') {
      return { level: 'nation', name: '전국' };
    }
    if (selectedSigungu) {
      return {
        level: 'sigungu',
        sidoCode: selectedSido,
        sigunguCode: selectedSigungu,
        name: regionLabel
      };
    }
    return {
      level: 'sido',
      sidoCode: selectedSido,
      name: regionLabel
    };
  }, [selectedSido, selectedSigungu, regionLabel]);

  const loadDashboard = useCallback(
    async (mode: 'initial' | 'region' | 'refresh') => {
      if (mode === 'initial') setStatus('loadingInitial');
      if (mode === 'region') setStatus('loadingRegion');
      if (mode === 'refresh') setIsRefreshing(true);
      try {
        const [next, central] = await Promise.all([
          fetchDashboard(regionKey),
          fetchCentralDashboard(regionKey),
        ]);
        const hasEmpty = next.map.length === 0;
        const hasPartial = next.charts.barKpi.length === 0 || next.charts.weeklyTrend.length === 0;
        setData(next);
        setCentralData(central);
        setStatus(hasEmpty ? 'empty' : hasPartial ? 'partial' : 'ready');
        setLastUpdated(new Date().toLocaleString('ko-KR'));
      } catch (error) {
        setStatus('error');
      } finally {
        setIsRefreshing(false);
      }
    },
    [regionKey]
  );

  useEffect(() => {
    loadDashboard('initial');
    didInit.current = true;
  }, [loadDashboard]);

  useEffect(() => {
    if (!didInit.current) return;
    loadDashboard('region');
  }, [regionKey, metricId, period, loadDashboard]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadDashboard('refresh');
    }, 5000);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  const handleMapSelect = useCallback((payload: { level: 'ctprvn' | 'sig' | 'emd'; code: string; name: string }) => {
    if (payload.level === 'ctprvn') {
      setSelectedSido(payload.code);
      setSelectedSigungu('');
      return;
    }
    if (payload.level === 'sig') {
      const code = payload.code;
      setSelectedSido(code.slice(0, 2));
      setSelectedSigungu(code);
      return;
    }
    if (payload.level === 'emd') {
      const code = payload.code;
      setSelectedSido(code.slice(0, 2));
      setSelectedSigungu(code);
    }
  }, []);

  const highlightCode = selectedSigungu || (selectedSido !== 'all' ? selectedSido : undefined);
  const metricLabel = metricOptions.find((item) => item.id === metricId)?.label ?? '지표';

  /* ── 드릴업 핸들러 (브라우저 history back 대신 상위 행정구역으로 이동) ── */
  const canDrillUp = selectedSido !== 'all';
  const drillUp = useCallback(() => {
    if (selectedSigungu) {
      setSelectedSigungu('');
      return;
    }
    if (selectedSido !== 'all') {
      setSelectedSido('all');
    }
  }, [selectedSido, selectedSigungu]);

  /* ── 지역명 역조회 맵 ── */
  const regionLookup = useMemo(() => {
    const map = new Map<string, string>();
    SIDO_OPTIONS.forEach(s => map.set(s.code, s.label));
    Object.values(SIGUNGU_OPTIONS).forEach(options => {
      (options as Array<{ code: string; label: string }>).forEach(s => map.set(s.code, s.label));
    });
    return map;
  }, []);

  /* ── 리스크 Top-5: 현재 드릴 레벨의 하위 구역 기준 ── */
  const top5Regions = useMemo(() => {
    if (!data?.map) return [];
    return [...data.map]
      .sort((a: any, b: any) => b.loadScore - a.loadScore)
      .slice(0, 5)
      .map((item: any) => ({
        ...item,
        name: regionLookup.get(item.regionId) ?? item.regionId,
      }));
  }, [data?.map, regionLookup]);

  /* ── 헤더 KPI 요약 — 새 5-KPI 시스템 ── */
  const centralKpiSummaries = centralData?.kpiSummaries ?? [];

  const showLoading = status === 'loadingInitial' || status === 'loadingRegion';
  const partial = status === 'partial';

  return (
    <div className="min-h-screen bg-[#f5f6f7] text-gray-900">
      <HeaderBar
        period={period}
        onPeriodChange={setPeriod}
        metricId={metricId}
        metricOptions={metricOptions}
        onMetricChange={setMetricId}
        sidoOptions={SIDO_OPTIONS}
        sigunguOptions={sigunguOptions}
        selectedSido={selectedSido}
        selectedSigungu={selectedSigungu}
        onSidoChange={(value) => {
          setSelectedSido(value);
          setSelectedSigungu('');
        }}
        onSigunguChange={(value) => setSelectedSigungu(value)}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={() => loadDashboard('refresh')}
        centralKpiSummaries={centralKpiSummaries}
        selectedKpi={selectedKpi}
        onSelectKpi={(key) => setSelectedKpi(key as CentralKpiKey)}
        regionLabel={regionLabel}
        canDrillUp={canDrillUp}
        onDrillUp={drillUp}
      />

      <main className="mx-auto max-w-[1400px] px-6 py-6 pb-12">
        {status === 'error' && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            데이터 요청에 문제가 있습니다. 다시 시도해 주세요.
          </div>
        )}
        {status === 'empty' && (
          <div className="mb-4 rounded-md border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600">
            조회 가능한 값이 없습니다. 조건을 바꿔 다시 시도해 주세요.
          </div>
        )}
        {status === 'partial' && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            일부 지표만 제공됩니다.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2.4fr)_minmax(0,1.3fr)]">
          <LeftKpiPanel kpi={data?.kpi ?? null} loading={showLoading} partial={partial} selectedKpi={selectedKpi} onSelectKpi={(key) => setSelectedKpi(key as CentralKpiKey)} centralData={centralData} regionLabel={regionLabel} />

          <div className="space-y-3">
            <GeoMapPanel
              title="전국 GeoMap"
              indicatorId={metricId}
              year={2026}
              mapMode={mapMode}
              mapAlpha={mapAlpha}
              mapHeight={420}
              highlightCode={highlightCode}
              onRegionSelect={handleMapSelect}
              period={period}
              onPeriodChange={setPeriod}
              selectedKpi={selectedKpi}
              drillLabel={regionLabel !== '전국' ? regionLabel : undefined}
              canDrillUp={canDrillUp}
              onDrillUp={drillUp}
              externalLevel={selectedSido === 'all' ? 'ctprvn' : selectedSigungu ? 'emd' : 'sig'}
              externalSelectedCode={selectedSigungu || (selectedSido !== 'all' ? selectedSido : undefined)}
            />

            {/* ── 리스크 Top-5 (현재 드릴 레벨 하위 구역 기준) ── */}
            {top5Regions.length > 0 && (
              <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700">
                    리스크 Top-5 ({regionLabel} 하위 구역)
                  </span>
                  <span className="text-[10px] text-gray-400">{getCentralKpiTheme(selectedKpi).label} 기준</span>
                </div>
                <div className="space-y-1">
                  {top5Regions.map((item: any, idx: number) => (
                    <button
                      key={item.regionId}
                      type="button"
                      className="flex items-center justify-between w-full rounded px-2 py-1.5 text-xs hover:bg-gray-50 transition"
                      onClick={() =>
                        handleMapSelect({
                          level: selectedSido === 'all' ? 'ctprvn' : 'sig',
                          code: item.regionId,
                          name: item.name,
                        })
                      }
                    >
                      <span className="text-gray-700">
                        <span className="inline-block w-5 font-semibold text-gray-900">{idx + 1}</span>
                        {item.name}
                      </span>
                      <span
                        className={`font-medium ${
                          item.riskGrade === 'critical'
                            ? 'text-red-600'
                            : item.riskGrade === 'warn'
                              ? 'text-amber-600'
                              : 'text-gray-600'
                        }`}
                      >
                        {item.loadScore.toFixed(1)}점
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 사건 단계 범례 (항상 표시) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-gray-200 bg-white px-4 py-2.5">
              <span className="text-[11px] font-semibold text-gray-600">사건 단계</span>
              {STAGE_LEGEND.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              ))}
              <span className="ml-auto text-[11px] text-gray-400">
                {regionLabel} · {metricLabel}
              </span>
            </div>
          </div>

          <RightAnalyticsPanel charts={data?.charts ?? null} loading={showLoading} selectedKpi={selectedKpi} centralChartData={centralData?.chartData?.[selectedKpi] ?? null} />
        </div>

        <div className="mt-4">
          <BottomTrendPanel data={data?.charts?.weeklyTrend ?? null} loading={showLoading} selectedKpi={selectedKpi} centralTrend={centralData?.chartData?.[selectedKpi]?.trend ?? null} />
        </div>
      </main>
    </div>
  );
}
