import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeaderBar } from '../components/HeaderBar';
import { LeftKpiPanel } from '../components/LeftKpiPanel';
import { GeoMapPanel } from '../components/GeoMapPanel';
import { MapLegendAndControls } from '../components/MapLegendAndControls';
import { RightAnalyticsPanel } from '../components/RightAnalyticsPanel';
import { BottomTrendPanel } from '../components/BottomTrendPanel';
import { fetchRegionalDashboard, RegionKey } from '../mocks/mockRegionalApi';
import {
  REGIONAL_SCOPE,
  findEmdLabel,
  findSigunguByEmd,
  findSigunguLabel,
  getEmdOptions,
  getSigunguOptions
} from '../mocks/mockRegionalGeo';

const MAP_INDICATOR = 'anomaly_score';

export function RegionalDashboard() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [selectedSigungu, setSelectedSigungu] = useState('');
  const [selectedEmd, setSelectedEmd] = useState('');
  const [mapMode, setMapMode] = useState<'fill' | 'dot' | 'bubble'>('fill');
  const [mapLevels, setMapLevels] = useState(7);
  const [mapAlpha, setMapAlpha] = useState(0.95);

  const [data, setData] = useState<any | null>(null);
  const [status, setStatus] = useState<'loadingInitial' | 'loadingRegion' | 'ready' | 'empty' | 'partial' | 'error'>('loadingInitial');
  const [lastUpdated, setLastUpdated] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const didInit = useRef(false);

  const sigunguOptions = useMemo(() => getSigunguOptions(), []);
  const emdOptions = useMemo(() => (selectedSigungu ? getEmdOptions(selectedSigungu) : []), [selectedSigungu]);

  const regionLabel = useMemo(() => {
    if (selectedEmd) {
      const sigLabel = findSigunguLabel(findSigunguByEmd(selectedEmd) ?? selectedSigungu) || REGIONAL_SCOPE.label;
      const emdLabel = findEmdLabel(selectedEmd) || selectedEmd;
      return `${sigLabel} ${emdLabel}`;
    }
    if (selectedSigungu) {
      return findSigunguLabel(selectedSigungu) || selectedSigungu;
    }
    return REGIONAL_SCOPE.label;
  }, [selectedEmd, selectedSigungu]);

  const regionKey = useMemo<RegionKey>(() => {
    if (selectedEmd) {
      return { level: 'eupmyeondong', regionId: selectedEmd, name: regionLabel };
    }
    if (selectedSigungu) {
      return { level: 'sigungu', regionId: selectedSigungu, name: regionLabel };
    }
    return { level: 'regional', regionId: REGIONAL_SCOPE.id, name: REGIONAL_SCOPE.label };
  }, [selectedEmd, selectedSigungu, regionLabel]);

  const loadDashboard = useCallback(
    async (mode: 'initial' | 'region' | 'refresh') => {
      if (mode === 'initial') setStatus('loadingInitial');
      if (mode === 'region') setStatus('loadingRegion');
      if (mode === 'refresh') setIsRefreshing(true);
      try {
        const next = await fetchRegionalDashboard(regionKey);
        const hasEmpty = next.map.length === 0;
        setData(next);
        setStatus(hasEmpty ? 'empty' : 'ready');
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
    if (didInit.current) return;
    loadDashboard('initial');
    didInit.current = true;
  }, [loadDashboard]);

  useEffect(() => {
    if (!didInit.current) return;
    loadDashboard('region');
  }, [regionKey, period, loadDashboard]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadDashboard('refresh');
    }, 5000);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  const handleMapSelect = useCallback((payload: { level: 'ctprvn' | 'sig' | 'emd'; code: string; name: string }) => {
    if (payload.level === 'sig') {
      setSelectedSigungu(payload.code);
      setSelectedEmd('');
      return;
    }
    if (payload.level === 'emd') {
      setSelectedEmd(payload.code);
      const parent = findSigunguByEmd(payload.code);
      if (parent) setSelectedSigungu(parent);
      return;
    }
    setSelectedSigungu('');
    setSelectedEmd('');
  }, []);

  const highlightCode = selectedEmd || selectedSigungu || undefined;
  const showLoading = status === 'loadingInitial' || status === 'loadingRegion';

  return (
    <div className="min-h-screen bg-[#f5f6f7] text-gray-900">
      <HeaderBar
        period={period}
        onPeriodChange={setPeriod}
        showMetricSelect={false}
        metricId={undefined}
        metricOptions={undefined}
        onMetricChange={undefined}
        sidoOptions={[{ code: REGIONAL_SCOPE.id, label: REGIONAL_SCOPE.label }]}
        sigunguOptions={sigunguOptions}
        selectedSido={REGIONAL_SCOPE.id}
        selectedSigungu={selectedSigungu}
        onSidoChange={() => undefined}
        onSigunguChange={(value) => {
          setSelectedSigungu(value);
          setSelectedEmd('');
        }}
        secondaryPlaceholder="시군구"
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2.6fr)_minmax(0,1.4fr)]">
          <LeftKpiPanel variant="regional" kpi={data?.kpi ?? null} loading={showLoading} />

          <div className="space-y-4">
            <GeoMapPanel
              title="관할 GeoMap"
              indicatorId={MAP_INDICATOR}
              year={2026}
              scope={{ mode: 'regional', ctprvnCodes: [REGIONAL_SCOPE.ctprvnCode], label: REGIONAL_SCOPE.label }}
              mapMode={mapMode}
              mapAlpha={mapAlpha}
              mapHeight={520}
              highlightCode={highlightCode}
              statsOverride={data?.map ? data.map.map((item: any) => ({ code: item.regionId, value: item.anomalyScore })) : []}
              lockedSigCode={selectedSigungu}
              lockedSigName={findSigunguLabel(selectedSigungu)}
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
              선택 권역: <span className="font-semibold text-gray-800">{regionLabel}</span> · 기준 지표: <span className="font-semibold text-gray-800">이상징후 점수</span>
            </div>

            <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
              <div className="text-xs text-gray-500">읍면동 선택</div>
              <select
                className="mt-2 w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                value={selectedEmd}
                onChange={(event) => setSelectedEmd(event.target.value)}
              >
                <option value="">읍면동</option>
                {emdOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <RightAnalyticsPanel variant="regional" charts={data?.charts ?? null} alerts={data?.alerts ?? []} loading={showLoading} />
        </div>

        <div className="mt-4">
          <BottomTrendPanel
            data={data?.charts?.trend ?? null}
            loading={showLoading}
            title="대기시간 · 이탈률 추이"
            xKey="t"
            primaryKey="waitMin"
            secondaryKey="dropoutRate"
            primaryColor="#2563eb"
            secondaryColor="#ef4444"
            footerLabel={period === 'week' ? '주간 기준' : period === 'month' ? '월간 기준' : '분기 기준'}
          />
        </div>
      </main>
    </div>
  );
}
