import React, { useState } from 'react';
import { KPI as NationalKpi } from '../mocks/mockApi';
import { KPI as RegionalKpi } from '../mocks/mockRegionalApi';
import {
  formatCount,
  formatPercent,
  formatSignedPercent,
  formatSignedTimeMMSS,
  formatTimeMMSS
} from '../utils/format';
import { REGIONAL_THRESHOLDS, THRESHOLDS } from '../styles/tokens';
import type { CentralKpiKey, CentralDashboardData } from '../lib/centralKpiTheme';
import { getCentralKpiTheme, getCentralKpiStatus } from '../lib/centralKpiTheme';

type LeftKpiPanelProps = {
  variant?: 'national' | 'regional';
  kpi: NationalKpi | RegionalKpi | null;
  loading?: boolean;
  partial?: boolean;
  selectedKpi?: string;
  onSelectKpi?: (key: string) => void;
  centralData?: CentralDashboardData | null;
  regionLabel?: string;
};

type CardItem = {
  key: string;
  title: string;
  value: string;
  sub: string;
  status?: 'normal' | 'warn' | 'risk';
};

const statusClass = (status?: 'normal' | 'warn' | 'risk') => {
  if (status === 'risk') return 'border-red-500 text-red-600';
  if (status === 'warn') return 'border-amber-400 text-amber-600';
  return 'border-gray-200 text-gray-900';
};

export function LeftKpiPanel({ variant = 'national', kpi, loading, partial, selectedKpi, onSelectKpi, centralData, regionLabel }: LeftKpiPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-24 rounded-md border border-gray-200 bg-gray-50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (variant === 'regional') {
    const data = kpi as RegionalKpi | null;
    const items: CardItem[] = data
      ? [
          {
            key: 'contactSuccessRate',
            title: '접촉 성공률',
            value: formatPercent(data.contactSuccessRate, 1),
            sub: `전주 대비 ${formatSignedPercent(data.wowDelta.contactSuccessRate, 1)}`,
            status: data.contactSuccessRate <= REGIONAL_THRESHOLDS.contactSuccessRate ? 'warn' : 'normal'
          },
          {
            key: 'consultCompletionRate',
            title: '상담 완료율',
            value: formatPercent(data.consultCompletionRate, 1),
            sub: `전주 대비 ${formatSignedPercent(data.wowDelta.consultCompletionRate, 1)}`,
            status: data.consultCompletionRate <= REGIONAL_THRESHOLDS.consultCompletionRate ? 'warn' : 'normal'
          },
          {
            key: 'linkageRate',
            title: '연계율',
            value: formatPercent(data.linkageRate, 1),
            sub: `전주 대비 ${formatSignedPercent(data.wowDelta.linkageRate, 1)}`
          },
          {
            key: 'dropoutRate',
            title: '이탈률',
            value: formatPercent(data.dropoutRate, 1),
            sub: `전주 대비 ${formatSignedPercent(data.wowDelta.dropoutRate, 1)}`,
            status: data.dropoutRate >= REGIONAL_THRESHOLDS.dropoutRate ? 'risk' : 'normal'
          },
          {
            key: 'recontactSuccessRate',
            title: '재접촉 성공률',
            value: formatPercent(data.recontactSuccessRate, 1),
            sub: `전주 대비 ${formatSignedPercent(data.wowDelta.recontactSuccessRate, 1)}`
          },
          {
            key: 'avgWaitTimeSec',
            title: '평균 대기시간',
            value: formatTimeMMSS(data.avgWaitTimeSec),
            sub: `전주 대비 ${formatSignedTimeMMSS(data.wowDelta.avgWaitTimeSec)}`,
            status: data.avgWaitTimeSec >= REGIONAL_THRESHOLDS.avgWaitTimeSec ? 'warn' : 'normal'
          },
          {
            key: 'avgConsultTimeSec',
            title: '평균 상담시간',
            value: formatTimeMMSS(data.avgConsultTimeSec),
            sub: `전주 대비 ${formatSignedTimeMMSS(data.wowDelta.avgConsultTimeSec)}`
          }
        ]
      : [];

    const visibleItems = expanded ? items : items.slice(0, 4);

    return (
      <div className="space-y-3">
        {visibleItems.map((card) => (
          <div key={card.key} className={`rounded-md border bg-white p-4 ${statusClass(card.status)}`}>
            <div className="text-xs text-gray-500">{card.title}</div>
            <div className="mt-2 text-2xl font-bold">{card.value}</div>
            <div className={`mt-1 text-xs ${partial ? 'text-gray-400' : 'text-gray-500'}`}>{card.sub}</div>
            {card.status && card.status !== 'normal' && (
              <div className="mt-2 text-[11px] text-gray-500">{card.status === 'risk' ? '위험' : '주의'}</div>
            )}
          </div>
        ))}
        {items.length > 4 && (
          <button
            type="button"
            className="w-full rounded-md border border-gray-200 bg-white py-2 text-xs text-gray-600"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? '접기' : '더보기'}
          </button>
        )}
      </div>
    );
  }

  /* ── National: 5 KPI 요약 카드 ── */
  const summaries = centralData?.kpiSummaries ?? [];
  const regionMetrics = centralData?.regionMetrics;
  const currentKpiKey = (selectedKpi ?? 'signalQuality') as CentralKpiKey;
  const currentRegionData = regionMetrics?.[currentKpiKey] ?? [];
  const sortedAsc = [...currentRegionData].sort((a, b) => a.value - b.value);
  const sortedDesc = [...currentRegionData].sort((a, b) => b.value - a.value);
  const currentTheme = getCentralKpiTheme(currentKpiKey);

  // higherIsWorse인 경우: Top = 가장 높은(위험), Bottom = 가장 낮은(양호) → 역순
  const topRegions = currentTheme.higherIsWorse ? sortedDesc.slice(0, 3) : sortedDesc.slice(0, 3);
  const bottomRegions = currentTheme.higherIsWorse ? sortedAsc.slice(0, 3) : sortedAsc.slice(0, 3);

  return (
    <div className="space-y-3">
      {/* 5 KPI 요약 카드 */}
      {summaries.map((summary) => {
        const theme = getCentralKpiTheme(summary.key);
        const isActive = selectedKpi === summary.key;
        const status = getCentralKpiStatus(summary.key, summary.value);

        return (
          <div
            key={summary.key}
            className={`rounded-md border-2 bg-white p-4 cursor-pointer transition-all hover:shadow-md ${
              isActive ? 'shadow-md' : ''
            }`}
            style={{
              borderColor: isActive ? theme.primaryColor : '#e5e7eb',
              backgroundColor: isActive ? theme.softBg : '#ffffff',
            }}
            onClick={() => onSelectKpi?.(summary.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectKpi?.(summary.key)}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: theme.primaryColor }}
              />
              <span className="text-xs text-gray-500">{theme.label}</span>
              {status !== 'good' && (
                <span
                  className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    status === 'risk'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {status === 'risk' ? '위험' : '주의'}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold" style={{ color: isActive ? theme.primaryColor : '#111827' }}>
                {theme.valueFormatter(summary.value)}
              </span>
              <span
                className={`text-xs ${
                  summary.delta > 0
                    ? theme.higherIsWorse
                      ? 'text-red-500'
                      : 'text-emerald-500'
                    : summary.delta < 0
                      ? theme.higherIsWorse
                        ? 'text-emerald-500'
                        : 'text-red-500'
                      : 'text-gray-400'
                }`}
              >
                {summary.delta > 0 ? '▲' : summary.delta < 0 ? '▼' : '─'} {Math.abs(summary.delta).toFixed(1)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400">
              <span>{summary.sub1Label}: {summary.sub1Value}</span>
              <span>{summary.sub2Label}: {summary.sub2Value}</span>
            </div>
          </div>
        );
      })}

      {/* 선택된 KPI 기준 Top/Bottom 지역 */}
      {currentRegionData.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">
            {currentTheme.label} — {regionLabel ?? '전국'} 지역 Top / Bottom
          </div>

          {/* Top 3 */}
          <div className="mb-2">
            <div className="text-[10px] text-gray-400 mb-1">
              {currentTheme.higherIsWorse ? '▲ 위험 상위' : '▲ 우수 상위'} 3
            </div>
            {topRegions.map((r, i) => (
              <div key={r.regionCode} className="flex items-center justify-between py-0.5 text-xs">
                <span className="text-gray-700">
                  <span className="inline-block w-4 font-semibold" style={{ color: currentTheme.primaryColor }}>
                    {i + 1}
                  </span>
                  {r.regionName}
                </span>
                <span className="font-medium" style={{ color: currentTheme.primaryColor }}>
                  {currentTheme.valueFormatter(r.value)}
                </span>
              </div>
            ))}
          </div>

          {/* Bottom 3 */}
          <div className="border-t border-gray-100 pt-2">
            <div className="text-[10px] text-gray-400 mb-1">
              {currentTheme.higherIsWorse ? '▼ 양호 하위' : '▼ 취약 하위'} 3
            </div>
            {bottomRegions.map((r, i) => (
              <div key={r.regionCode} className="flex items-center justify-between py-0.5 text-xs">
                <span className="text-gray-700">
                  <span className="inline-block w-4 font-semibold text-gray-400">{i + 1}</span>
                  {r.regionName}
                </span>
                <span className="font-medium text-gray-500">
                  {currentTheme.valueFormatter(r.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
