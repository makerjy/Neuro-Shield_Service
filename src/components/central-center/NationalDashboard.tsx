import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  HelpCircle,
  Share2,
  Printer,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  UserPlus,
  Table2,
  BarChart3,
  Download
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { GeoMapPanel } from '../geomap/GeoMapPanel';
import { GEO_INDICATORS, getGeoIndicator, formatGeoValue } from '../geomap/geoIndicators';
import { REGIONAL_SCOPES } from '../geomap/regions';

type RegionValue = {
  regionCode: string;
  regionName: string;
  level: 'sido' | 'sigungu';
  value: number;
  unit: string;
  rank: number;
};

type KpiCard = {
  key: string;
  label: string;
  value: number;
  unit: string;
  delta: number;
  status: 'normal' | 'warn' | 'risk';
  threshold: { warn: number; risk: number };
  lastUpdatedAt: string;
};

type TrendPoint = { period: string; value: number };

type RankItem = { regionName: string; value: number; rank: number };

type AlertItem = {
  id: string;
  severity: 'low' | 'medium' | 'high';
  kpiKey: string;
  regionName: string;
  reason: string;
  createdAt: string;
  ackStatus: 'unack' | 'acked';
  owner: string | null;
};

type ViewLevel = 1 | 2 | 3;

type SelectItem = {
  code: string;
  name: string;
};

const PERIODS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];

const KPI_DEFS = [
  { key: 'total_cases', label: '총 케이스 수', unit: '건', direction: 'high', warn: 14000, risk: 17000 },
  { key: 'sla_compliance', label: 'SLA 준수율', unit: '%', direction: 'high', warn: 92, risk: 88 },
  { key: 'response_time', label: '평균 응답시간', unit: '분', direction: 'low', warn: 18, risk: 24 },
  { key: 'case_resolution', label: '케이스 처리율', unit: '%', direction: 'high', warn: 90, risk: 85 },
  { key: 'data_quality', label: '데이터 품질', unit: '%', direction: 'high', warn: 93, risk: 90 },
  { key: 'waitlist_pressure', label: '대기/병목 지수', unit: '점', direction: 'low', warn: 70, risk: 85 },
  { key: 'followup_dropout', label: '추적 이탈 비율', unit: '%', direction: 'low', warn: 18, risk: 24 },
  { key: 'high_risk_rate', label: '고위험군 비율', unit: '%', direction: 'low', warn: 22, risk: 30 },
  { key: 'screening_coverage', label: '1차 선별 완료율', unit: '%', direction: 'high', warn: 85, risk: 78 },
  { key: 'accessibility_score', label: '접근성 점수', unit: '점', direction: 'high', warn: 75, risk: 65 }
] as const;

const MAP_KPIS = [
  'total_cases',
  'referral',
  'wait_time',
  'recontact',
  'waitlist_pressure',
  'accessibility_score'
];

const ALERTS: AlertItem[] = [
  {
    id: 'AL-2401',
    severity: 'high',
    kpiKey: 'waitlist_pressure',
    regionName: '경기',
    reason: '대기/병목 지수 급등',
    createdAt: '2026-02-04 08:20',
    ackStatus: 'unack',
    owner: null
  },
  {
    id: 'AL-2392',
    severity: 'medium',
    kpiKey: 'followup_dropout',
    regionName: '전북',
    reason: '추적 이탈 비율 상승',
    createdAt: '2026-02-04 07:45',
    ackStatus: 'acked',
    owner: '김담당'
  },
  {
    id: 'AL-2381',
    severity: 'low',
    kpiKey: 'data_shortage',
    regionName: '강원',
    reason: '데이터 부족률 증가',
    createdAt: '2026-02-03 17:10',
    ackStatus: 'unack',
    owner: null
  }
];

const MEMO_LOG = [
  { id: 'M1', author: '이운영', note: '고위험군 비율 상승 원인 분석 착수', time: '2026-02-04 09:05' },
  { id: 'M2', author: '김담당', note: '대기 지표 개선 계획 수립 예정', time: '2026-02-04 09:30' }
];

const hashSeed = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const seededValue = (seed: string, min: number, max: number) => {
  const ratio = (hashSeed(seed) % 1000) / 1000;
  return min + (max - min) * ratio;
};

const renderChartActions = () => (
  <div className="flex items-center gap-2 text-xs text-gray-600">
    <button type="button" className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
      <Table2 className="h-3.5 w-3.5" />
      표보기
    </button>
    <button type="button" className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
      <BarChart3 className="h-3.5 w-3.5" />
      유형
    </button>
    <button type="button" className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
      <Download className="h-3.5 w-3.5" />
      저장
    </button>
  </div>
);

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-sm bg-gray-100 ${className || ''}`} />
);

export function NationalDashboard() {
  const indicatorOptions = useMemo(
    () => GEO_INDICATORS.filter((item) => MAP_KPIS.includes(item.id)),
    []
  );
  const [viewLevel, setViewLevel] = useState<ViewLevel>(1);
  const [selectedKpiId, setSelectedKpiId] = useState(indicatorOptions[0]?.id ?? 'total_cases');
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[PERIODS.length - 1]);
  const [selectedRegionCode, setSelectedRegionCode] = useState(REGIONAL_SCOPES[0]?.ctprvnCode ?? '11');
  const [selectedSig, setSelectedSig] = useState<SelectItem | null>(null);
  const [selectedEmd, setSelectedEmd] = useState<SelectItem | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState('2026-02-04 09:00');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRegionLoading, setIsRegionLoading] = useState(false);
  const [dataState] = useState<'ready' | 'empty' | 'partial' | 'error'>('ready');

  const selectedRegion = useMemo(
    () => REGIONAL_SCOPES.find((item) => item.ctprvnCode === selectedRegionCode) ?? REGIONAL_SCOPES[0],
    [selectedRegionCode]
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleRegionChange = (code: string) => {
    setSelectedRegionCode(code);
    setIsRegionLoading(true);
    setTimeout(() => setIsRegionLoading(false), 500);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdatedAt('2026-02-04 09:15');
      setIsRefreshing(false);
    }, 800);
  };

  const selectedIndicator = getGeoIndicator(selectedKpiId);

  const regionValues: RegionValue[] = useMemo(() => {
    const indicator = getGeoIndicator(selectedKpiId);
    return REGIONAL_SCOPES.map((region) => {
      const value = seededValue(`${selectedKpiId}-${region.id}-${selectedPeriod}`, indicator.scale[0], indicator.scale[1]);
      return {
        regionCode: region.ctprvnCode,
        regionName: region.label,
        level: 'sido',
        value,
        unit: indicator.unit,
        rank: 0
      };
    });
  }, [selectedKpiId, selectedPeriod]);

  const rankedRegions = useMemo(() => {
    const sorted = [...regionValues].sort((a, b) => b.value - a.value).map((item, index) => ({
      ...item,
      rank: index + 1
    }));
    return {
      top: sorted.slice(0, 5).map((item) => ({ regionName: item.regionName, value: item.value, rank: item.rank })),
      bottom: sorted.slice(-5).reverse().map((item) => ({ regionName: item.regionName, value: item.value, rank: item.rank }))
    };
  }, [regionValues]);

  const contextKey = useMemo(() => {
    if (viewLevel === 1) return selectedRegionCode;
    if (viewLevel === 2) return selectedSig?.code ?? selectedRegionCode;
    return selectedEmd?.code ?? selectedSig?.code ?? selectedRegionCode;
  }, [viewLevel, selectedRegionCode, selectedSig, selectedEmd]);

  const kpiCards: KpiCard[] = useMemo(() => {
    const now = lastUpdatedAt;
    return KPI_DEFS.map((def) => {
      const current = seededValue(`${def.key}-${contextKey}-${selectedPeriod}`, 0, 1);
      const base = def.unit === '건'
        ? Math.round(10000 + current * 9000)
        : Number((def.unit === '점' ? 60 + current * 35 : 80 + current * 18).toFixed(1));
      const prev = def.unit === '건'
        ? Math.round(base * (0.96 + current * 0.08))
        : Number((base * (0.96 + current * 0.06)).toFixed(1));
      const delta = Number((base - prev).toFixed(1));
      const value = base;

      const warn = def.warn;
      const risk = def.risk;
      let status: 'normal' | 'warn' | 'risk' = 'normal';
      if (def.direction === 'high') {
        if (value < risk) status = 'risk';
        else if (value < warn) status = 'warn';
      } else {
        if (value > risk) status = 'risk';
        else if (value > warn) status = 'warn';
      }

      return {
        key: def.key,
        label: def.label,
        value,
        unit: def.unit,
        delta,
        status,
        threshold: { warn, risk },
        lastUpdatedAt: now
      };
    });
  }, [contextKey, selectedPeriod, lastUpdatedAt]);

  const trendSeries: TrendPoint[] = useMemo(() => {
    return PERIODS.slice(-7).map((period) => {
      const value = seededValue(`${selectedKpiId}-${contextKey}-${period}`, selectedIndicator.scale[0], selectedIndicator.scale[1]);
      return { period, value: Number(value.toFixed(1)) };
    });
  }, [selectedKpiId, contextKey, selectedIndicator.scale]);

  const distributionSummary = useMemo(() => {
    const top = Math.round(seededValue(`dist-top-${contextKey}`, 18, 28));
    const bottom = Math.round(seededValue(`dist-bottom-${contextKey}`, 18, 28));
    const mid = Math.max(0, 100 - top - bottom);
    return [
      { label: '상위 그룹', value: top, color: '#2563eb' },
      { label: '중간 그룹', value: mid, color: '#60a5fa' },
      { label: '하위 그룹', value: bottom, color: '#93c5fd' }
    ];
  }, [contextKey]);

  const compositionData = useMemo(() => {
    const high = Math.round(seededValue(`high-${contextKey}`, 12, 32));
    const monitor = 100 - high;
    return [
      { name: '고위험군', value: high, color: '#2563eb' },
      { name: '관찰군', value: monitor, color: '#93c5fd' }
    ];
  }, [contextKey]);

  const eventPoints = useMemo(() => {
    const flag = Math.round(seededValue(`event-${contextKey}`, 0, 3));
    if (flag === 0) return [] as { period: string; label: string }[];
    return [
      { period: PERIODS[PERIODS.length - 3], label: '대기 급등' },
      { period: PERIODS[PERIODS.length - 2], label: '품질 저하' }
    ];
  }, [contextKey]);

  const causeBreakdown = useMemo(() => {
    const wait = Math.round(seededValue(`cause-wait-${contextKey}`, 18, 32));
    const dropout = Math.round(seededValue(`cause-drop-${contextKey}`, 12, 26));
    const quality = Math.round(seededValue(`cause-quality-${contextKey}`, 10, 22));
    const access = Math.max(0, 100 - wait - dropout - quality);
    return [
      { label: '대기/병목', value: wait },
      { label: '이탈', value: dropout },
      { label: '품질 저하', value: quality },
      { label: '접근성 저하', value: access }
    ];
  }, [contextKey]);

  const isLoading = isInitialLoading || isRegionLoading;
  const partialKeys = dataState === 'partial' ? new Set(['data_quality', 'waitlist_pressure']) : new Set<string>();

  const alertSummary = useMemo(() => {
    const high = ALERTS.filter((item) => item.severity === 'high').length;
    const medium = ALERTS.filter((item) => item.severity === 'medium').length;
    const low = ALERTS.filter((item) => item.severity === 'low').length;
    return { high, medium, low };
  }, []);

  const hasActionRequired = ALERTS.some((item) => item.ackStatus === 'unack');
  const isDataDelayed = dataState === 'partial';
  const noRecentChange = eventPoints.length === 0;

  const contextPath = useMemo(() => {
    const parts = [selectedRegion.label];
    if (selectedSig?.name) parts.push(selectedSig.name);
    if (selectedEmd?.name) parts.push(selectedEmd.name);
    return parts.join(' > ');
  }, [selectedRegion.label, selectedSig, selectedEmd]);

  const handleGoUp = () => {
    if (viewLevel === 3) {
      setViewLevel(2);
      setSelectedEmd(null);
      return;
    }
    if (viewLevel === 2) {
      setViewLevel(1);
      setSelectedSig(null);
      setSelectedEmd(null);
    }
  };

  const renderKpiCard = (card: KpiCard, compact = false) => (
    <div
      key={card.key}
      className={`border border-gray-200 rounded-sm bg-white p-3 ${partialKeys.has(card.key) ? 'opacity-50' : ''}`}
    >
      <div className="text-xs text-gray-500 mb-1">{card.label}</div>
      <div className={`${compact ? 'text-lg' : 'text-xl'} font-bold text-gray-900`}>
        {card.value}
        <span className="text-xs font-semibold ml-1">{card.unit}</span>
      </div>
      {partialKeys.has(card.key) && (
        <div className="mt-1 text-[11px] text-gray-400">일부 지표 갱신 지연</div>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>Δ {card.delta >= 0 ? '+' : ''}{card.delta}{card.unit}</span>
        <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] ${
          card.status === 'normal'
            ? 'bg-emerald-50 text-emerald-700'
            : card.status === 'warn'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-red-50 text-red-700'
        }`}>
          {card.status === 'normal' ? '정상' : card.status === 'warn' ? '주의' : '위험'}
        </span>
      </div>
    </div>
  );

  const renderLevel1 = () => (
    <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <select
            value={selectedRegionCode}
            onChange={(event) => handleRegionChange(event.target.value)}
            className="border border-gray-200 rounded-sm px-2 py-1 bg-white"
          >
            {REGIONAL_SCOPES.map((region) => (
              <option key={region.id} value={region.ctprvnCode}>
                {region.label}
              </option>
            ))}
          </select>
          <select
            value={selectedKpiId}
            onChange={(event) => setSelectedKpiId(event.target.value)}
            className="border border-gray-200 rounded-sm px-2 py-1 bg-white"
          >
            {indicatorOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <GeoMapPanel
          title="전국 GeoMap"
          indicatorId={selectedKpiId}
          year={Number(selectedPeriod)}
          scope={{ mode: 'national' }}
          variant="portal"
          mapHeight={520}
          hintText="시군구 클릭 시 운영 분석 화면으로 이동"
          onRegionSelect={({ level, code, name }) => {
            if (level === 'ctprvn') {
              handleRegionChange(code);
              return;
            }
            if (level === 'sig') {
              handleRegionChange(code.slice(0, 2));
              setSelectedSig({ code, name });
              setSelectedEmd(null);
              setViewLevel(2);
            }
          }}
        />

        {dataState === 'error' && (
          <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            데이터를 불러오지 못했습니다. 다시 시도해 주세요.
          </div>
        )}
        {dataState === 'empty' && (
          <div className="rounded-sm border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            선택 지표의 데이터가 부족합니다. 다른 지표로 변경하거나 다시 시도해 주세요.
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <SkeletonBlock key={`s-${idx}`} className="h-24" />
              ))
            : kpiCards.slice(0, 4).map((card) => renderKpiCard(card))}
        </div>

        <div className="border border-gray-200 rounded-sm bg-white p-4">
          <div className="text-sm font-semibold text-gray-900 mb-2">경보 요약</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-sm border border-gray-200 p-2 text-center">
              <div className="text-gray-500">위험</div>
              <div className="text-lg font-bold text-red-700">{alertSummary.high}</div>
            </div>
            <div className="rounded-sm border border-gray-200 p-2 text-center">
              <div className="text-gray-500">주의</div>
              <div className="text-lg font-bold text-amber-700">{alertSummary.medium}</div>
            </div>
            <div className="rounded-sm border border-gray-200 p-2 text-center">
              <div className="text-gray-500">정상</div>
              <div className="text-lg font-bold text-blue-700">{alertSummary.low}</div>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-sm bg-white p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">상·하위 지역</div>
          {isLoading ? (
            <SkeletonBlock className="h-28" />
          ) : (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-gray-500 mb-2">상위 5</div>
                <div className="space-y-2">
                  {rankedRegions.top.map((item) => (
                    <div key={item.regionName} className="flex items-center justify-between">
                      <span>{item.rank}. {item.regionName}</span>
                      <span className="font-semibold">{formatGeoValue(item.value, selectedIndicator)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-2">하위 5</div>
                <div className="space-y-2">
                  {rankedRegions.bottom.map((item) => (
                    <div key={item.regionName} className="flex items-center justify-between">
                      <span>{item.rank}. {item.regionName}</span>
                      <span className="font-semibold">{formatGeoValue(item.value, selectedIndicator)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const renderLevel2 = () => {
    const sigName = selectedSig?.name ?? `${selectedRegion.label} 권역 1`;
    const sigCode = selectedSig?.code ?? `${selectedRegion.ctprvnCode}010`;
    return (
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
                선택 시군구: {sigName}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
                선택 지표: {selectedIndicator.label}
              </span>
            </div>
          </div>
          <GeoMapPanel
            title="읍면동 GeoMap"
            indicatorId={selectedKpiId}
            year={Number(selectedPeriod)}
            scope={{ mode: 'regional', ctprvnCodes: [selectedRegion.ctprvnCode], label: selectedRegion.label }}
            variant="portal"
            mapHeight={480}
            fixedLevel="emd"
            lockedSigCode={sigCode}
            lockedSigName={sigName}
            hideBreadcrumb
            hintText="읍면동 클릭 시 로컬 분석 화면으로 이동"
            onRegionSelect={({ level, code, name }) => {
              if (level !== 'emd') return;
              setSelectedEmd({ code, name });
              setViewLevel(3);
            }}
          />
        </div>

        <div className="space-y-4">
          <div className="border border-gray-200 rounded-sm bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-900">선택 지표 추세 (최근 7기간)</div>
              {renderChartActions()}
            </div>
            {isLoading ? (
              <SkeletonBlock className="h-40" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="border border-gray-200 rounded-sm bg-white p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">읍면동 분포 요약</div>
            <div className="space-y-2 text-xs">
              {distributionSummary.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between">
                    <span>{item.label}</span>
                    <span className="font-semibold">{item.value}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-sm bg-gray-100">
                    <div className="h-2 rounded-sm" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {['waitlist_pressure', 'followup_dropout', 'data_quality'].map((key) => {
              const card = kpiCards.find((item) => item.key === key) ?? kpiCards[0];
              return renderKpiCard(card, true);
            })}
          </div>
        </div>
      </section>
    );
  };

  const renderLevel3 = () => (
    <section className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
        <div className="border border-gray-200 rounded-sm bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-900">KPI 타임라인</div>
            {renderChartActions()}
          </div>
          {isLoading ? (
            <SkeletonBlock className="h-44" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 text-xs text-gray-500">
                {eventPoints.length === 0 ? '최근 변화 포인트 없음' : '최근 변화 포인트'}
              </div>
              <div className="mt-2 space-y-1 text-xs">
                {eventPoints.map((item) => (
                  <div key={item.period} className="flex items-center justify-between">
                    <span>{item.period}</span>
                    <span className="font-semibold text-gray-700">{item.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border border-gray-200 rounded-sm bg-white p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">원인 분해</div>
          <div className="space-y-3 text-xs">
            {causeBreakdown.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between">
                  <span>{item.label}</span>
                  <span className="font-semibold">{item.value}%</span>
                </div>
                <div className="mt-1 h-2 rounded-sm bg-gray-100">
                  <div className="h-2 rounded-sm bg-blue-500" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="border border-gray-200 rounded-sm bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-900">경보 히스토리</div>
            <span className="text-xs text-gray-500">총 {ALERTS.length}건</span>
          </div>
          <div className="space-y-3">
            {ALERTS.map((alert) => (
              <div key={alert.id} className="border border-gray-200 rounded-sm p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-800">
                    [{alert.regionName}] {alert.reason}
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 ${
                    alert.severity === 'high'
                      ? 'bg-red-50 text-red-700'
                      : alert.severity === 'medium'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700'
                  }`}>
                    {alert.severity === 'high' ? '위험' : alert.severity === 'medium' ? '주의' : '정상'}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-gray-500">
                  <span>{alert.createdAt}</span>
                  <span className={`inline-flex items-center gap-1 ${
                    alert.ackStatus === 'acked' ? 'text-emerald-700' : 'text-gray-500'
                  }`}>
                    {alert.ackStatus === 'acked' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {alert.ackStatus === 'acked' ? '확인됨' : '미확인'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-gray-200 rounded-sm bg-white p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">조치 메모 로그</div>
            <div className="space-y-2 text-xs">
              {MEMO_LOG.map((memo) => (
                <div key={memo.id} className="border border-gray-200 rounded-sm p-2">
                  <div className="flex items-center justify-between text-gray-500">
                    <span>{memo.author}</span>
                    <span>{memo.time}</span>
                  </div>
                  <div className="mt-1 text-gray-800">{memo.note}</div>
                </div>
              ))}
            </div>
            <textarea
              className="mt-3 w-full rounded-sm border border-gray-200 p-2 text-xs"
              rows={3}
              placeholder="조치 메모를 입력하세요"
            />
            <div className="mt-2 flex justify-end">
              <button className="rounded-sm border border-gray-200 px-3 py-1 text-xs text-gray-600">메모 저장</button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-sm bg-white p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">담당자 지정 / 상태 변경</div>
            <div className="flex items-center gap-2 text-xs">
              <select className="flex-1 border border-gray-200 rounded-sm px-2 py-1">
                <option>담당자 선택</option>
                <option>김담당</option>
                <option>이운영</option>
                <option>박분석</option>
              </select>
              <button className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1 text-gray-600">
                <UserPlus className="h-4 w-4" />
                지정
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <select className="flex-1 border border-gray-200 rounded-sm px-2 py-1">
                <option>상태 변경</option>
                <option>정상</option>
                <option>주의</option>
                <option>위험</option>
              </select>
              <button className="rounded-sm border border-gray-200 px-2 py-1">저장</button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-sm bg-white p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">보조 지표</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span>센터 커버리지</span>
                <span className="font-semibold">{Math.round(seededValue(`cover-${contextKey}`, 60, 92))}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>가용성</span>
                <span className="font-semibold">{Math.round(seededValue(`avail-${contextKey}`, 55, 88))}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>접근성 점수</span>
                <span className="font-semibold">{Math.round(seededValue(`access-${contextKey}`, 45, 95))}점</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="bg-white text-gray-900">
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="max-w-[1800px] mx-auto px-6 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">전국 정신건강복지센터 운영 대시보드</div>
              <div className="text-xs text-gray-500">운영 지표 모니터링 · 관제/분석 전용</div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <button className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
                <HelpCircle className="h-4 w-4" />
                가이드
              </button>
              <button className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
                <Share2 className="h-4 w-4" />
                공유
              </button>
              <button className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
                <Printer className="h-4 w-4" />
                출력
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-1">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-2.5 py-1 border rounded-sm ${
                    selectedPeriod === period
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
                단위/기준: 건 · % · 분 · 점
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
                마지막 갱신 {lastUpdatedAt}
              </span>
              {isRefreshing && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
                  갱신 중
                </span>
              )}
            </div>
            <button
              className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1 text-gray-600"
              onClick={handleRefresh}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <div className="flex items-center gap-2 text-gray-600">
              <span className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
                선택 권역: {contextPath}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
                선택 지표: {selectedIndicator.label}
              </span>
            </div>
            {viewLevel > 1 && (
              <button
                className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1 text-gray-600"
                onClick={handleGoUp}
              >
                <ChevronLeft className="h-4 w-4" />
                상위로
              </button>
            )}
          </div>

          {viewLevel === 3 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1">
                상태: {kpiCards[0]?.status === 'risk' ? '위험' : kpiCards[0]?.status === 'warn' ? '주의' : '정상'}
              </span>
              {hasActionRequired && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                  조치 필요
                </span>
              )}
              {isDataDelayed && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                  일부 지표 지연
                </span>
              )}
              {noRecentChange && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600">
                  최근 변화 없음
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">
        {viewLevel === 1 && renderLevel1()}
        {viewLevel === 2 && renderLevel2()}
        {viewLevel === 3 && renderLevel3()}
      </div>
    </div>
  );
}
