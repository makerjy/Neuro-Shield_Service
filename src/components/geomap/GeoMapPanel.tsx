import React, { useEffect, useMemo, useState } from 'react';
import { Palette, ChevronDown, ChevronUp, Eye, EyeOff, Settings2 } from 'lucide-react';
import { KoreaDrilldownMap, Level } from './KoreaDrilldownMap';
import { formatGeoValue, getGeoIndicator } from './geoIndicators';
import { buildComposition, buildMetrics, buildRegionSeries } from './metrics';
import { ChoroplethScale, formatRange, formatNumber as formatChoroplethNumber, COLOR_PALETTES } from '../../lib/choroplethScale';

/* ═════════════════════════════════════════════════════════════
   GeoMap UI State Types - 색상 팔레트 및 범례 컨트롤
═════════════════════════════════════════════════════════════ */
export type MapColorScheme = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'heat';

const COLOR_SCHEME_LABELS: Record<MapColorScheme, string> = {
  blue: '파랑 (Blue)',
  green: '초록 (Green)',
  purple: '보라 (Purple)',
  orange: '주황 (Orange)',
  red: '빨강 (Red)',
  heat: '열지도 (Heat)',
};

// 타입 안전한 색상 팔레트 접근
const getColorPalette = (scheme: MapColorScheme): string[] => {
  return COLOR_PALETTES[scheme] as string[];
};

const GEO_URLS: Record<Level, string> = {
  ctprvn: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json',
  sig: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-geo.json',
  emd: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-submunicipalities-2018-geo.json'
};

const levelLabel: Record<Level, string> = {
  ctprvn: '전국',
  sig: '시/군/구',
  emd: '읍/면/동'
};

export type GeoScope = {
  mode: 'national' | 'regional';
  ctprvnCodes?: string[];
  label?: string;
};

type GeoMapPanelProps = {
  title: string;
  indicatorId: string;
  year?: number;
  scope?: GeoScope;
  fixedLevel?: Level;
  lockedSigCode?: string;
  lockedSigName?: string;
  hideBreadcrumb?: boolean;
  hintText?: string;
  variant?: 'default' | 'portal';
  mapHeight?: number;
  className?: string;
  externalLevel?: Level; // 외부에서 제어하는 레벨 (드릴다운 동기화)
  externalSelectedCode?: string; // 외부에서 선택된 지역 코드
  onRegionSelect?: (payload: { level: Level; code: string; name: string }) => void;
  onGoBack?: () => void; // 상위 레벨로 돌아가기 콜백
  externalColorScheme?: MapColorScheme; // 외부 KPI 기반 색상 스킴
  hideLegendPanel?: boolean; // 하단 범례 패널 숨김
  onSubRegionsChange?: (regions: { code: string; name: string }[]) => void; // 현재 표시 중인 하위 지역 목록 전달
};

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

function normalizeFeatures(features: any[]): any[] {
  return features.map((feature) => {
    const code = getFeatureCode(feature);
    const name = getFeatureName(feature);
    return {
      ...feature,
      id: code,
      properties: {
        ...feature.properties,
        code,
        name
      }
    };
  });
}

function filterByPrefixes(features: any[], prefixes: string[] = []) {
  if (!prefixes.length) return features;
  return features.filter((feature) => {
    const code = getFeatureCode(feature);
    return prefixes.some((prefix) => code.startsWith(prefix));
  });
}

export function GeoMapPanel({
  title,
  indicatorId,
  year = 2026,
  scope = { mode: 'national' },
  fixedLevel,
  lockedSigCode,
  lockedSigName,
  hideBreadcrumb = false,
  hintText,
  variant = 'default',
  mapHeight = 420,
  className,
  externalLevel,
  externalSelectedCode,
  onRegionSelect,
  onGoBack,
  externalColorScheme,
  hideLegendPanel = false,
  onSubRegionsChange
}: GeoMapPanelProps) {
  const indicator = getGeoIndicator(indicatorId);
  const scopeKey = JSON.stringify(scope);
  const isRegional = scope.mode === 'regional';
  const isPortal = variant === 'portal';
  const [ctprvnGeo, setCtprvnGeo] = useState<any[] | null>(null);
  const [sigGeo, setSigGeo] = useState<any[] | null>(null);
  const [emdGeo, setEmdGeo] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolvedCtprvnCode = useMemo(() => {
    const raw = scope.ctprvnCodes?.[0];
    if (!ctprvnGeo) return raw;
    if (raw && ctprvnGeo.some((feature) => getFeatureCode(feature) === raw)) {
      return raw;
    }
    if (!scope.label) return raw;
    const match = ctprvnGeo.find((feature) => {
      const name = getFeatureName(feature);
      return name === scope.label || name.includes(scope.label) || scope.label.includes(name);
    });
    return match ? getFeatureCode(match) : raw;
  }, [ctprvnGeo, scope.ctprvnCodes, scope.label]);
  const scopedCtprvnCodes = resolvedCtprvnCode ? [resolvedCtprvnCode] : scope.ctprvnCodes;
  const initialCtprvn = scopedCtprvnCodes?.[0];
  const defaultLevel: Level = isRegional && scopedCtprvnCodes?.length === 1 ? 'sig' : 'ctprvn';

  const [level, setLevel] = useState<Level>(defaultLevel);
  const [selectedCodes, setSelectedCodes] = useState<{ ctprvn?: string; sig?: string; emd?: string }>({
    ctprvn: initialCtprvn
  });
  const [selectedNames, setSelectedNames] = useState<{ ctprvn?: string; sig?: string; emd?: string }>({});
  
  // ═══ GeoMap UI State: 색상 팔레트 및 범례 컨트롤 ═══
  const [colorScheme, setColorScheme] = useState<MapColorScheme>('blue');
  const [showLegend, setShowLegend] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  // 외부 색상 스킴이 있으면 우선 사용 (KPI 연동)
  const effectiveColorScheme = externalColorScheme ?? colorScheme;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ctprvnRes, sigRes, emdRes] = await Promise.all([
          fetch(GEO_URLS.ctprvn),
          fetch(GEO_URLS.sig),
          fetch(GEO_URLS.emd)
        ]);
        const [ctprvnJson, sigJson, emdJson] = await Promise.all([
          ctprvnRes.json(),
          sigRes.json(),
          emdRes.json()
        ]);
        if (!mounted) return;
        setCtprvnGeo(normalizeFeatures(ctprvnJson?.features ?? []));
        setSigGeo(normalizeFeatures(sigJson?.features ?? []));
        setEmdGeo(normalizeFeatures(emdJson?.features ?? []));
      } catch (err) {
        if (!mounted) return;
        setError('지도 데이터를 불러오는 데 실패했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setLevel(fixedLevel ?? defaultLevel);
    setSelectedCodes({ ctprvn: scopedCtprvnCodes?.[0] });
    setSelectedNames(scope.label ? { ctprvn: scope.label } : {});
  }, [scopeKey, scope.label, defaultLevel, scopedCtprvnCodes?.[0], fixedLevel]);

  useEffect(() => {
    if (!fixedLevel) return;
    if (level !== fixedLevel) setLevel(fixedLevel);
  }, [fixedLevel, level]);

  useEffect(() => {
    if (!lockedSigCode) return;
    setSelectedCodes((prev) => ({ ...prev, sig: lockedSigCode }));
    if (lockedSigName) {
      setSelectedNames((prev) => ({ ...prev, sig: lockedSigName }));
    }
  }, [lockedSigCode, lockedSigName]);

  useEffect(() => {
    if (!isRegional) return;
    if (scopedCtprvnCodes?.length) {
      const locked = scopedCtprvnCodes[0];
      if (selectedCodes.ctprvn !== locked) {
        setSelectedCodes({ ctprvn: locked });
      }
    }
  }, [isRegional, selectedCodes.ctprvn, scopedCtprvnCodes]);

  useEffect(() => {
    if (!isRegional) return;
    if (scope.label && !selectedNames.ctprvn) {
      setSelectedNames((prev) => ({ ...prev, ctprvn: scope.label }));
    }
  }, [isRegional, scope.label, selectedNames.ctprvn]);

  useEffect(() => {
    if (!isRegional) return;
    if (scopedCtprvnCodes?.length && level === 'ctprvn') {
      setLevel('sig');
    }
  }, [isRegional, scopedCtprvnCodes, level]);

  // 외부 레벨 및 선택 코드 변경 시 내부 상태 동기화
  useEffect(() => {
    if (!externalLevel) return;
    
    // 외부 레벨이 전국(ctprvn)이면 선택 상태 초기화
    if (externalLevel === 'ctprvn') {
      setLevel('ctprvn');
      setSelectedCodes({});
      setSelectedNames({});
      return;
    }
    
    // 시군구(sig) 레벨로 변경 - 시도 코드가 필요
    if (externalLevel === 'sig' && externalSelectedCode) {
      const ctprvnCode = externalSelectedCode.slice(0, 2); // 시도 코드 추출
      setLevel('sig');
      setSelectedCodes({ ctprvn: ctprvnCode });
      // 시도 이름 찾기
      const ctprvnFeature = ctprvnGeo?.find(f => getFeatureCode(f).startsWith(ctprvnCode));
      if (ctprvnFeature) {
        setSelectedNames({ ctprvn: getFeatureName(ctprvnFeature) });
      }
      return;
    }
    
    // 읍면동(emd) 레벨로 변경 - 시군구 코드가 필요
    if (externalLevel === 'emd' && externalSelectedCode) {
      const ctprvnCode = externalSelectedCode.slice(0, 2);
      const sigCode = externalSelectedCode.slice(0, 5);
      setLevel('emd');
      setSelectedCodes({ ctprvn: ctprvnCode, sig: sigCode });
      // 시도/시군구 이름 찾기
      const ctprvnFeature = ctprvnGeo?.find(f => getFeatureCode(f).startsWith(ctprvnCode));
      const sigFeature = sigGeo?.find(f => getFeatureCode(f) === sigCode);
      setSelectedNames({
        ctprvn: ctprvnFeature ? getFeatureName(ctprvnFeature) : undefined,
        sig: sigFeature ? getFeatureName(sigFeature) : undefined,
      });
      return;
    }
  }, [externalLevel, externalSelectedCode, ctprvnGeo, sigGeo]);

  const filteredCtprvn = useMemo(() => {
    if (!ctprvnGeo) return [];
    return filterByPrefixes(ctprvnGeo, scopedCtprvnCodes);
  }, [ctprvnGeo, scopedCtprvnCodes]);

  const filteredSig = useMemo(() => {
    if (!sigGeo) return [];
    const prefix = isRegional ? scopedCtprvnCodes?.[0] : selectedCodes.ctprvn;
    if (!prefix) return [];
    return filterByPrefixes(sigGeo, [prefix]);
  }, [sigGeo, selectedCodes.ctprvn, scopedCtprvnCodes, isRegional]);

  const filteredEmd = useMemo(() => {
    const sigCode = lockedSigCode ?? selectedCodes.sig;
    if (!emdGeo || !sigCode) return [];
    return filterByPrefixes(emdGeo, [sigCode]);
  }, [emdGeo, selectedCodes.sig, lockedSigCode]);

  useEffect(() => {
    if (level !== 'sig') return;
    if (selectedCodes.sig || !filteredSig.length) return;
    const first = filteredSig[0];
    const code = getFeatureCode(first);
    if (!code) return;
    setSelectedCodes((prev) => ({ ctprvn: prev.ctprvn, sig: code }));
    setSelectedNames((prev) => ({ ctprvn: prev.ctprvn, sig: getFeatureName(first) }));
  }, [level, filteredSig, selectedCodes.sig]);

  useEffect(() => {
    if (level !== 'emd') return;
    if (selectedCodes.emd || !filteredEmd.length) return;
    const first = filteredEmd[0];
    const code = getFeatureCode(first);
    if (!code) return;
    setSelectedCodes((prev) => ({ ...prev, emd: code }));
    setSelectedNames((prev) => ({ ...prev, emd: getFeatureName(first) }));
  }, [level, filteredEmd, selectedCodes.emd]);

  const currentFeatures = useMemo(() => {
    return level === 'ctprvn' ? filteredCtprvn : level === 'sig' ? filteredSig : filteredEmd;
  }, [level, filteredCtprvn, filteredSig, filteredEmd]);

  // 현재 표시 중인 하위 지역 목록을 외부로 전달
  useEffect(() => {
    if (!onSubRegionsChange || !currentFeatures.length) return;
    const regions = currentFeatures.map((f: any) => ({
      code: getFeatureCode(f),
      name: getFeatureName(f),
    }));
    onSubRegionsChange(regions);
  }, [currentFeatures, onSubRegionsChange]);

  const metricPoints = useMemo(() => {
    if (!currentFeatures.length) return [];
    return buildMetrics(currentFeatures, indicator, year);
  }, [currentFeatures, indicator, year]);

  const stats = useMemo(
    () => metricPoints.map((item) => ({ code: item.code, value: item.value })),
    [metricPoints]
  );

  const handleSelect = (nextLevel: Level, code: string) => {
    const feature = currentFeatures.find((item) => getFeatureCode(item) === code);
    const name = feature ? getFeatureName(feature) : code;

    if (fixedLevel) {
      if (fixedLevel === 'ctprvn') {
        setSelectedCodes({ ctprvn: code });
        setSelectedNames({ ctprvn: name });
        onRegionSelect?.({ level: 'sig', code, name }); // 다음 레벨로 이동
      } else if (fixedLevel === 'sig') {
        setSelectedCodes((prev) => ({ ctprvn: prev.ctprvn, sig: code }));
        setSelectedNames((prev) => ({ ctprvn: prev.ctprvn, sig: name }));
        onRegionSelect?.({ level: 'emd', code, name }); // 다음 레벨로 이동
      } else {
        setSelectedCodes((prev) => ({ ...prev, emd: code }));
        setSelectedNames((prev) => ({ ...prev, emd: name }));
        onRegionSelect?.({ level: 'emd', code, name });
      }
      return;
    }

    // 시도 클릭 -> 시군구(sig) 레벨로 이동
    if (level === 'ctprvn') {
      setSelectedCodes({ ctprvn: code });
      setSelectedNames({ ctprvn: name });
      setLevel(nextLevel); // 'sig'로 변경
      onRegionSelect?.({ level: nextLevel, code, name }); // nextLevel = 'sig'
      return;
    }

    // 시군구 클릭 -> 읍면동(emd) 레벨로 이동
    if (level === 'sig') {
      setSelectedCodes((prev) => ({ ctprvn: prev.ctprvn, sig: code }));
      setSelectedNames((prev) => ({ ctprvn: prev.ctprvn, sig: name }));
      setLevel(nextLevel); // 'emd'로 변경
      onRegionSelect?.({ level: nextLevel, code, name }); // nextLevel = 'emd'
      return;
    }

    // 읍면동 클릭 -> 마지막 레벨
    if (level === 'emd') {
      setSelectedCodes((prev) => ({ ...prev, emd: code }));
      setSelectedNames((prev) => ({ ...prev, emd: name }));
      onRegionSelect?.({ level: 'emd', code, name });
    }
  };

  const handleGoRoot = () => {
    if (fixedLevel) return;
    if (isRegional) return;
    setLevel('ctprvn');
    setSelectedCodes({});
    setSelectedNames({});
    onGoBack?.(); // 외부에 알림
  };

  const handleGoUp = () => {
    if (fixedLevel) return;
    if (isRegional && level === 'sig') return;
    if (level === 'emd') {
      setLevel('sig');
      setSelectedCodes((prev) => ({ ctprvn: prev.ctprvn, sig: prev.sig }));
      setSelectedNames((prev) => ({ ctprvn: prev.ctprvn, sig: prev.sig }));
      onGoBack?.(); // 외부에 알림
      return;
    }
    if (level === 'sig') {
      setLevel('ctprvn');
      setSelectedCodes({ ctprvn: selectedCodes.ctprvn });
      setSelectedNames({ ctprvn: selectedNames.ctprvn });
      onGoBack?.(); // 외부에 알림
    }
  };

  const breadcrumb = [
    { label: '전국', disabled: isRegional, onClick: handleGoRoot },
    ...(selectedNames.ctprvn
      ? [
          {
            label: selectedNames.ctprvn,
            disabled: level === 'ctprvn',
            onClick: () => setLevel('sig')
          }
        ]
      : []),
    ...(selectedNames.sig
      ? [
          {
            label: selectedNames.sig,
            disabled: level === 'sig',
            onClick: () => setLevel('sig')
          }
        ]
      : []),
    ...(selectedNames.emd ? [{ label: selectedNames.emd, disabled: true }] : [])
  ];

  const sortedMetrics = useMemo(
    () => [...metricPoints].sort((a, b) => b.value - a.value),
    [metricPoints]
  );
  const averageValue = metricPoints.length
    ? metricPoints.reduce((sum, item) => sum + item.value, 0) / metricPoints.length
    : null;
  const maxMetric = sortedMetrics[0] ?? null;
  const minMetric = sortedMetrics.length ? sortedMetrics[sortedMetrics.length - 1] : null;
  const top5 = sortedMetrics.slice(0, 5);
  const bottom5 = [...sortedMetrics].reverse().slice(0, 5);
  const medianValue = sortedMetrics.length
    ? sortedMetrics[Math.floor(sortedMetrics.length / 2)]?.value
    : null;

  const activeCode =
    level === 'ctprvn' ? selectedCodes.ctprvn : level === 'sig' ? selectedCodes.sig : selectedCodes.emd;
  const activeByCode = activeCode ? metricPoints.find((item) => item.code === activeCode) : null;
  const activeMetric = activeByCode ?? sortedMetrics[0] ?? null;
  const activeName = activeMetric?.name ?? '선택 없음';
  const activeRank = activeMetric?.rank ?? 0;
  const totalCount = metricPoints.length;
  const activePercentile =
    totalCount > 1 && activeRank
      ? Math.round((1 - (activeRank - 1) / (totalCount - 1)) * 100)
      : totalCount === 1
        ? 100
        : 0;

  const trendYears = useMemo(() => Array.from({ length: 7 }).map((_, idx) => year - 6 + idx), [year]);
  const trendSeries = useMemo(() => {
    if (!activeMetric) return [];
    return buildRegionSeries(activeMetric.code, indicator, trendYears);
  }, [activeMetric, indicator, trendYears]);

  const trendPath = useMemo(() => {
    if (trendSeries.length < 2) return '';
    const values = trendSeries.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const width = 220;
    const height = 70;
    return trendSeries
      .map((item, idx) => {
        const x = (idx / (trendSeries.length - 1)) * width;
        const ratio = max === min ? 0.5 : (item.value - min) / (max - min);
        const y = height - ratio * (height - 10) - 5;
        return `${x},${y}`;
      })
      .join(' ');
  }, [trendSeries]);

  const composition = useMemo(() => {
    if (!activeMetric) return [];
    return buildComposition(activeMetric.code);
  }, [activeMetric]);

  const distribution = useMemo(() => {
    if (!metricPoints.length) return [] as number[];
    const buckets = new Array(12).fill(0);
    const values = metricPoints.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    metricPoints.forEach((item) => {
      const ratio = max === min ? 0.5 : (item.value - min) / (max - min);
      const idx = Math.min(buckets.length - 1, Math.floor(ratio * buckets.length));
      buckets[idx] += 1;
    });
    const maxBucket = Math.max(...buckets, 1);
    return buckets.map((count) => count / maxBucket);
  }, [metricPoints]);

  // ═══ 구간형 Choropleth Scale 생성 (선택된 색상 팔레트 적용) ═══
  const choroplethScale = useMemo(() => {
    const values = metricPoints.map(m => m.value);
    if (values.length === 0) return null;
    return new ChoroplethScale(values, 'quantile', 7, effectiveColorScheme);
  }, [metricPoints, effectiveColorScheme]);

  // 색상 팔레트 변경 시 KoreaDrilldownMap에 전달할 색상 배열
  const currentColors = useMemo(() => {
    return getColorPalette(effectiveColorScheme);
  }, [effectiveColorScheme]);

  const legendBins = useMemo(() => {
    return choroplethScale?.getLegendBins() ?? [];
  }, [choroplethScale]);

  const scaleStats = useMemo(() => {
    return choroplethScale?.getStats() ?? { min: 0, max: 0, avg: 0, total: 0 };
  }, [choroplethScale]);

  const formatDelta = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    if (indicator.unit === '%') {
      return `${sign}${value.toFixed(1)}%p`;
    }
    return `${sign}${formatGeoValue(Math.abs(value), indicator)}`;
  };

  return (
    <div className={`${isPortal ? 'border border-gray-200' : 'border-2 border-gray-300'} bg-white ${className || ''}`}>
      <div className={`${isPortal ? 'border-b border-gray-200' : 'border-b-2 border-gray-300'} px-4 py-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">{indicator.label} · {levelLabel[level]}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            {isRegional && scope.label && (
              <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{scope.label} 전용</span>
            )}
            <span className="rounded-full bg-gray-100 px-2 py-1">기준연도 {year}</span>
          </div>
        </div>
      </div>

      {!hideBreadcrumb && (
        <div className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {breadcrumb.map((item, idx) => (
              <React.Fragment key={`${item.label}-${idx}`}>
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={item.onClick}
                  className={`font-medium ${item.disabled ? 'text-gray-400' : 'text-blue-600 hover:underline'}`}
                >
                  {item.label}
                </button>
                {idx < breadcrumb.length - 1 && <span>/</span>}
              </React.Fragment>
            ))}
            {level !== 'ctprvn' && !(isRegional && level === 'sig') && (
              <button
                type="button"
                onClick={handleGoUp}
                className="ml-2 rounded-full border border-gray-200 px-2 py-0.5 text-gray-600"
              >
                상위로
              </button>
            )}
          </div>
        </div>
      )}

      <div className="px-4 pb-8">
        {!isPortal && metricPoints.length > 0 && (
          <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-gray-500">전체 평균</div>
              <div className="text-base font-semibold text-gray-900">
                {averageValue !== null ? formatGeoValue(averageValue, indicator) : '-'}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-gray-500">최고 지역</div>
              <div className="text-sm font-semibold text-gray-900">{maxMetric?.name ?? '-'}</div>
              <div className="text-xs text-gray-500">{maxMetric ? formatGeoValue(maxMetric.value, indicator) : '-'}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-gray-500">최저 지역</div>
              <div className="text-sm font-semibold text-gray-900">{minMetric?.name ?? '-'}</div>
              <div className="text-xs text-gray-500">{minMetric ? formatGeoValue(minMetric.value, indicator) : '-'}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-gray-500">선택 지역</div>
              <div className="text-sm font-semibold text-gray-900">{activeName}</div>
              <div className="text-xs text-gray-500">
                {activeMetric ? formatGeoValue(activeMetric.value, indicator) : '-'}
              </div>
            </div>
          </div>
        )}

        {(() => {
          const mapBlock = (
            <div>
              <div
                className={`${isPortal ? 'rounded-sm' : 'rounded-lg'} border border-gray-200 bg-gray-50`}
                style={{ height: mapHeight, minHeight: mapHeight }}
              >
                {loading && (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">지도를 불러오는 중...</div>
                )}
                {error && (
                  <div className="flex h-full items-center justify-center text-sm text-red-600">{error}</div>
                )}
                {!loading && !error && (
                  <KoreaDrilldownMap
                    level={level}
                    features={currentFeatures}
                    stats={stats}
                    onSelect={handleSelect}
                    indicatorLabel={indicator.label}
                    unit={indicator.unit}
                    year={year}
                    valueFormatter={(value) => formatGeoValue(value, indicator)}
                    colorPalette={currentColors}
                  />
                )}
              </div>

              {!hideLegendPanel && (<>
              {/* ═══════════════════════════════════════════════════════
                  SGIS Style Legend Control - 드롭다운 패널
                  - 색상 팔레트 선택
                  - 범례 표시/숨김 토글
                  - 접기/펼치기 기능
              ═══════════════════════════════════════════════════════ */}
              <div className="mt-3 relative rounded-xl border border-gray-200 bg-white/95 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  {/* 왼쪽: 범례 영역 (조건부 표시) */}
                  {showLegend && (
                    <div className="flex-1">
                      {/* 범례 헤더 (접기/펼치기) */}
                      <button
                        onClick={() => setLegendCollapsed(!legendCollapsed)}
                        className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900 mb-1.5 font-semibold"
                      >
                        {legendCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        <span>{indicator.label} 단계 (구간형)</span>
                      </button>
                      
                      {/* 범례 상세 (접힘 상태에 따라 표시) */}
                      {!legendCollapsed && (
                        <div className="space-y-1.5 pl-4 border-l-2 border-gray-200">
                          {legendBins.length > 0 ? (
                            legendBins.map((bin, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <div 
                                  className="w-5 h-3.5 rounded-sm border border-gray-300" 
                                  style={{ backgroundColor: bin.color }}
                                />
                                <span className="text-gray-700">
                                  {formatChoroplethNumber(bin.min)} ~ {formatChoroplethNumber(bin.max)}
                                </span>
                                {bin.count !== undefined && (
                                  <span className="text-gray-400">({bin.count}개)</span>
                                )}
                              </div>
                            ))
                          ) : (
                            currentColors.slice(0, 7).map((color, idx) => {
                              const values = metricPoints.map(m => m.value);
                              const min = Math.min(...values, indicator.scale[0]);
                              const max = Math.max(...values, indicator.scale[1]);
                              const range = max - min;
                              const stepSize = range / 7;
                              const minVal = min + (idx * stepSize);
                              const maxVal = idx === 6 ? max : min + ((idx + 1) * stepSize);
                              
                              return (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <div 
                                    className="w-5 h-3.5 rounded-sm border border-gray-300" 
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="text-gray-700">
                                    {formatGeoValue(minVal, indicator)} ~ {formatGeoValue(maxVal, indicator)}
                                  </span>
                                </div>
                              );
                            })
                          )}
                          {/* 통계 요약 */}
                          {scaleStats.total > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-gray-200 text-[11px] text-gray-500">
                              <span>전국 합계: <strong>{scaleStats.total.toLocaleString()}</strong></span>
                              <span className="ml-3">평균: <strong>{scaleStats.avg.toLocaleString()}</strong></span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 접힌 상태: 컬러 바 요약만 표시 */}
                      {legendCollapsed && (
                        <div className="flex items-center gap-1 pl-4">
                          {currentColors.slice(0, 7).map((color, idx) => (
                            <div 
                              key={idx}
                              className="w-5 h-3 rounded-sm"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                          <span className="ml-3 text-xs text-gray-600">
                            {formatChoroplethNumber(scaleStats.min)} ~ {formatChoroplethNumber(scaleStats.max)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 오른쪽: 설정 드롭다운 버튼 */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                      className="flex items-center gap-1.5 h-9 px-3 text-xs text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm"
                    >
                      <Settings2 className="h-4 w-4" />
                      <span>범례 설정</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showSettingsDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* 설정 드롭다운 패널 */}
                    {showSettingsDropdown && (
                      <>
                        {/* 배경 클릭 시 닫기 */}
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowSettingsDropdown(false)} 
                        />
                        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3">
                          {/* 색상 팔레트 선택 */}
                          <div className="mb-3">
                            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                              <Palette className="h-3.5 w-3.5 inline mr-1" />
                              색상 팔레트
                            </label>
                            <select
                              value={colorScheme}
                              onChange={(e) => setColorScheme(e.target.value as MapColorScheme)}
                              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {Object.entries(COLOR_SCHEME_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                            {/* 색상 미리보기 */}
                            <div className="flex gap-1 mt-1.5">
                              {getColorPalette(colorScheme).slice(0, 7).map((color, idx) => (
                                <div 
                                  key={idx}
                                  className="flex-1 h-3 rounded-sm"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                          
                          {/* 범례 표시 토글 */}
                          <div className="border-t border-gray-200 pt-2">
                            <button
                              onClick={() => setShowLegend(!showLegend)}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                            >
                              {showLegend ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                              <span>{showLegend ? '범례 숨기기' : '범례 표시'}</span>
                            </button>
                          </div>
                          
                          {/* 힌트 텍스트 */}
                          <div className="border-t border-gray-200 pt-2 mt-2 text-[11px] text-gray-400">
                            {hintText ?? '지도 클릭 시 하위 행정구역으로 이동'}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              </>)}
            </div>
          );

          if (isPortal) {
            return mapBlock;
          }

          return (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
              {mapBlock}
              {metricPoints.length > 0 && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div>
                    <div className="text-xs text-gray-500">선택 지역</div>
                    <div className="text-base font-semibold text-gray-900">{activeName}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-gray-600">{levelLabel[level]}</span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-gray-500">현재값</div>
                    <div className="font-semibold text-gray-900">
                      {activeMetric ? formatGeoValue(activeMetric.value, indicator) : '-'}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-gray-500">전년 대비</div>
                    <div className={`font-semibold ${activeMetric && activeMetric.yoy >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {activeMetric ? formatDelta(activeMetric.yoy) : '-'}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-gray-500">순위</div>
                    <div className="font-semibold text-gray-900">
                      {activeRank ? `${activeRank} / ${totalCount}` : '-'}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-gray-500 mb-2">최근 7년 추세</div>
                  <svg width="220" height="70" className="block">
                    <polyline points={trendPath} fill="none" stroke="#2563eb" strokeWidth="2" />
                  </svg>
                  <div className="mt-1 text-[11px] text-gray-500">상위 {activePercentile}% 수준</div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-xs text-gray-500">구성 비율</div>
                  {composition.map((item) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{item.name}</span>
                        <span>{item.value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900 mb-3">상·하위 구역</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-gray-500 mb-2">상위 5</div>
                        <div className="space-y-2">
                          {top5.map((item, idx) => (
                            <div key={item.code} className="flex items-center justify-between">
                              <span className="text-gray-700">{idx + 1}. {item.name}</span>
                              <span className="font-semibold text-gray-900">{formatGeoValue(item.value, indicator)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-2">하위 5</div>
                        <div className="space-y-2">
                          {bottom5.map((item, idx) => (
                            <div key={item.code} className="flex items-center justify-between">
                              <span className="text-gray-700">{totalCount - bottom5.length + idx + 1}. {item.name}</span>
                              <span className="font-semibold text-gray-900">{formatGeoValue(item.value, indicator)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900 mb-3">분포 요약</div>
                    <div className="flex items-end gap-1 h-20">
                      {distribution.map((ratio, idx) => (
                        <div
                          key={`bucket-${idx}`}
                          className="w-2 rounded-sm bg-blue-200"
                          style={{ height: `${Math.round(ratio * 100)}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      총 {totalCount}개 구역 · 중앙값 {medianValue ? formatGeoValue(medianValue, indicator) : '-'}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">선택 지역 상위 {activePercentile}% 수준</div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
