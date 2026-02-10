import React from 'react';
import { ArrowLeft, HelpCircle, Printer, RefreshCw, Share2 } from 'lucide-react';

export type MetricOption = {
  id: string;
  label: string;
};

export type RegionOption = {
  code: string;
  label: string;
};

export type KpiHeaderOption = {
  key: string;
  label: string;
  value: string;
  status: 'normal' | 'warn' | 'risk';
};

type HeaderBarProps = {
  period: 'week' | 'month' | 'quarter' | 'year';
  onPeriodChange: (period: 'week' | 'month' | 'quarter' | 'year') => void;
  metricId: string;
  metricOptions: MetricOption[];
  onMetricChange: (metricId: string) => void;
  sidoOptions: RegionOption[];
  sigunguOptions: RegionOption[];
  selectedSido: string;
  selectedSigungu: string;
  onSidoChange: (value: string) => void;
  onSigunguChange: (value: string) => void;
  lastUpdated: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  /* KPI 요약 버튼 */
  kpiOptions?: KpiHeaderOption[];
  selectedKpi?: string;
  onSelectKpi?: (key: string) => void;
  /* 드릴 상태 */
  regionLabel?: string;
  canDrillUp?: boolean;
  onDrillUp?: () => void;
};

const periodLabels: Record<'week' | 'month' | 'quarter' | 'year', string> = {
  week: '주',
  month: '월',
  quarter: '분기',
  year: '연간'
};

export function HeaderBar({
  period,
  onPeriodChange,
  metricId,
  metricOptions,
  onMetricChange,
  sidoOptions,
  sigunguOptions,
  selectedSido,
  selectedSigungu,
  onSidoChange,
  onSigunguChange,
  lastUpdated,
  isRefreshing,
  onRefresh,
  kpiOptions,
  selectedKpi,
  onSelectKpi,
  regionLabel,
  canDrillUp,
  onDrillUp
}: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-[1400px] px-6 py-3">
        {/* ── 1줄: KPI 요약 버튼 그룹 (주요 인터랙션) ── */}
        {kpiOptions && kpiOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {kpiOptions.map((opt) => {
              const isActive = selectedKpi === opt.key;
              const statusBorder =
                opt.status === 'risk'
                  ? 'border-red-400'
                  : opt.status === 'warn'
                    ? 'border-amber-400'
                    : 'border-gray-200';
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onSelectKpi?.(opt.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
                    isActive
                      ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50 shadow-sm'
                      : `${statusBorder} bg-white hover:bg-gray-50`
                  }`}
                >
                  <span className="text-gray-500">{opt.label}</span>
                  <span
                    className={`font-bold ${
                      opt.status === 'risk'
                        ? 'text-red-600'
                        : opt.status === 'warn'
                          ? 'text-amber-600'
                          : 'text-gray-900'
                    }`}
                  >
                    {opt.value}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── 2줄: 타이틀 + 드릴업 + 필터 + 유틸 ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {canDrillUp && onDrillUp && (
              <button
                type="button"
                onClick={onDrillUp}
                className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 transition"
                title="상위 단계로 이동"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <div className="text-base font-bold text-gray-900">전국운영대시보드</div>
              {regionLabel && regionLabel !== '전국' && (
                <div className="text-[11px] text-gray-500 mt-0.5">현재: {regionLabel}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
              value={selectedSido}
              onChange={(event) => onSidoChange(event.target.value)}
            >
              {sidoOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
              value={selectedSigungu}
              onChange={(event) => onSigunguChange(event.target.value)}
            >
              <option value="">시군구</option>
              {sigunguOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-500">지표</span>
            <select
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
              value={metricId}
              onChange={(event) => onMetricChange(event.target.value)}
            >
              {metricOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="rounded border border-gray-200 bg-white p-2" type="button" title="가이드">
              <HelpCircle className="h-4 w-4 text-gray-600" />
            </button>
            <button className="rounded border border-gray-200 bg-white p-2" type="button" title="공유">
              <Share2 className="h-4 w-4 text-gray-600" />
            </button>
            <button className="rounded border border-gray-200 bg-white p-2" type="button" title="출력">
              <Printer className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2 text-xs text-gray-500">
          <span>마지막 갱신</span>
          <span className="text-gray-800">{lastUpdated || '-'}</span>
          <button
            type="button"
            className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs"
            onClick={onRefresh}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-gray-600'}`} />
            새로고침
          </button>
          {isRefreshing && <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700">갱신 중</span>}
        </div>
      </div>
    </header>
  );
}
