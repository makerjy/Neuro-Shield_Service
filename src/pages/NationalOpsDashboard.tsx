import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeaderBar } from '../components/HeaderBar';
import { LeftKpiPanel } from '../components/LeftKpiPanel';
import { GeoMapPanel } from '../components/GeoMapPanel';
import { MapLegendAndControls } from '../components/MapLegendAndControls';
import { RightAnalyticsPanel } from '../components/RightAnalyticsPanel';
import { BottomTrendPanel } from '../components/BottomTrendPanel';
import { fetchDashboard, RegionKey } from '../mocks/mockApi';
import { SIDO_OPTIONS, SIGUNGU_OPTIONS } from '../mocks/mockGeo';
import { GEO_INDICATORS } from '../components/geomap/geoIndicators';

const metricOptions = GEO_INDICATORS.map((item) => ({ id: item.id, label: item.label }));

export function NationalOpsDashboard() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [metricId, setMetricId] = useState(metricOptions[0]?.id ?? 'total_cases');
  const [selectedSido, setSelectedSido] = useState('all');
  const [selectedSigungu, setSelectedSigungu] = useState('');
  const [mapMode, setMapMode] = useState<'fill' | 'dot' | 'bubble'>('fill');
  const [mapLevels, setMapLevels] = useState(7);
  const [mapAlpha, setMapAlpha] = useState(0.95);

  const [data, setData] = useState<any | null>(null);
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
        const next = await fetchDashboard(regionKey);
        const hasEmpty = next.map.length === 0;
        const hasPartial = next.charts.barKpi.length === 0 || next.charts.weeklyTrend.length === 0;
        setData(next);
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
      />

      <main className="mx-auto max-w-[1400px] px-6 py-6">
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2.6fr)_minmax(0,1.4fr)]">
          <LeftKpiPanel kpi={data?.kpi ?? null} loading={showLoading} partial={partial} />

          <div className="space-y-4">
            <GeoMapPanel
              title="전국 GeoMap"
              indicatorId={metricId}
              year={2026}
              mapMode={mapMode}
              mapAlpha={mapAlpha}
              mapHeight={520}
              highlightCode={highlightCode}
              onRegionSelect={handleMapSelect}
            >
              <MapLegendAndControls
                mode={mapMode}
                levels={mapLevels}
                alpha={mapAlpha}
                onModeChange={setMapMode}
                onLevelsChange={setMapLevels}
                onAlphaChange={setMapAlpha}
                onReset={() => {
                  setMapMode('fill');
                  setMapLevels(7);
                  setMapAlpha(0.95);
                }}
                minLabel="낮음"
                maxLabel="높음"
              />
            </GeoMapPanel>
            <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
              선택 권역: <span className="font-semibold text-gray-800">{regionLabel}</span> · 선택 지표: <span className="font-semibold text-gray-800">{metricLabel}</span>
            </div>
          </div>

          <RightAnalyticsPanel charts={data?.charts ?? null} loading={showLoading} />
        </div>

        <div className="mt-4">
          <BottomTrendPanel data={data?.charts?.weeklyTrend ?? null} loading={showLoading} />
        </div>
      </main>
    </div>
  );
}
