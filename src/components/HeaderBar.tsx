import React from 'react';
import { HelpCircle, Printer, RefreshCw, Share2 } from 'lucide-react';

export type MetricOption = {
  id: string;
  label: string;
};

export type RegionOption = {
  code: string;
  label: string;
};

type HeaderBarProps = {
  period: 'week' | 'month' | 'quarter';
  onPeriodChange: (period: 'week' | 'month' | 'quarter') => void;
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
};

const periodLabels: Record<'week' | 'month' | 'quarter', string> = {
  week: '주',
  month: '월',
  quarter: '분기'
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
  onRefresh
}: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-[1400px] px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-lg font-bold text-gray-900">전국운영대시보드</div>
          <div className="flex items-center gap-2">
            {(['week', 'month', 'quarter'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded border px-3 py-1 text-xs ${
                  period === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'
                }`}
                onClick={() => onPeriodChange(value)}
              >
                {periodLabels[value]}
              </button>
            ))}
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">선택 지표</span>
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
            </div>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">기준 기간</span>
            <span className="text-gray-800">{periodLabels[period]}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">마지막 갱신</span>
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
      </div>
    </header>
  );
}
