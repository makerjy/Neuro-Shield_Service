import React, { useEffect, useMemo, useState } from 'react';
import { KoreaDrilldownMap, Level } from './KoreaDrilldownMap';
import { formatGeoValue, getGeoIndicator } from './geoIndicators';
import { buildComposition, buildMetrics, buildRegionSeries } from './metrics';

const GEO_URLS: Record<Level, string> = {
  ctprvn: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json',
  sig: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-geo.json',
  emd: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-submunicipalities-2018-geo.json'
};

const levelLabel: Record<Level, string> = {
  ctprvn: '시도',
  sig: '시군구',
  emd: '읍면동'
};

const legendColors = ['#eff6ff', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#1e3a8a'];

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
  className?: string;
  onRegionSelect?: (payload: { level: Level; code: string; name: string }) => void;
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
  className,
  onRegionSelect
}: GeoMapPanelProps) {
  const indicator = getGeoIndicator(indicatorId);
  const scopeKey = JSON.stringify(scope);
  const isRegional = scope.mode === 'regional';
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
    setLevel(defaultLevel);
    setSelectedCodes({ ctprvn: scopedCtprvnCodes?.[0] });
    setSelectedNames(scope.label ? { ctprvn: scope.label } : {});
  }, [scopeKey, scope.label, defaultLevel, scopedCtprvnCodes?.[0]]);

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
    if (!emdGeo || !selectedCodes.sig) return [];
    return filterByPrefixes(emdGeo, [selectedCodes.sig]);
  }, [emdGeo, selectedCodes.sig]);

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
    if (level === 'ctprvn') return filteredCtprvn;
    if (level === 'sig') return filteredSig;
    return filteredEmd;
  }, [level, filteredCtprvn, filteredSig, filteredEmd]);

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

    if (level === 'ctprvn') {
      setSelectedCodes({ ctprvn: code });
      setSelectedNames({ ctprvn: name });
      setLevel(nextLevel);
      onRegionSelect?.({ level: 'ctprvn', code, name });
      return;
    }

    if (level === 'sig') {
      setSelectedCodes((prev) => ({ ctprvn: prev.ctprvn, sig: code }));
      setSelectedNames((prev) => ({ ctprvn: prev.ctprvn, sig: name }));
      setLevel(nextLevel);
      onRegionSelect?.({ level: 'sig', code, name });
      return;
    }

    if (level === 'emd') {
      setSelectedCodes((prev) => ({ ...prev, emd: code }));
      setSelectedNames((prev) => ({ ...prev, emd: name }));
      onRegionSelect?.({ level: 'emd', code, name });
    }
  };

  const handleGoRoot = () => {
    if (isRegional) return;
    setLevel('ctprvn');
    setSelectedCodes({});
    setSelectedNames({});
  };

  const handleGoUp = () => {
    if (isRegional && level === 'sig') return;
    if (level === 'emd') {
      setLevel('sig');
      setSelectedCodes((prev) => ({ ctprvn: prev.ctprvn, sig: prev.sig }));
      setSelectedNames((prev) => ({ ctprvn: prev.ctprvn, sig: prev.sig }));
      return;
    }
    if (level === 'sig') {
      setLevel('ctprvn');
      setSelectedCodes({ ctprvn: selectedCodes.ctprvn });
      setSelectedNames({ ctprvn: selectedNames.ctprvn });
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

  const formatDelta = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    if (indicator.unit === '%') {
      return `${sign}${value.toFixed(1)}%p`;
    }
    return `${sign}${formatGeoValue(Math.abs(value), indicator)}`;
  };

  return (
    <div className={`border-2 border-gray-300 bg-white ${className || ''}`}>
      <div className="border-b-2 border-gray-300 px-4 py-3">
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

      <div className="px-4 pb-4">
        {metricPoints.length > 0 && (
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

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
          <div>
            <div
              className="rounded-lg border border-gray-200 bg-gray-50"
              style={{ height: 420, minHeight: 420 }}
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
                />
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${legendColors.join(',')})` }} />
                <span>{indicator.unit} 기준</span>
              </div>
              <div>지도 클릭 시 하위 행정구역으로 이동</div>
            </div>
          </div>

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
      </div>
    </div>
  );
}
