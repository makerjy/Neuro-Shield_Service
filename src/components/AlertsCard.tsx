import React, { useMemo, useState } from 'react';
import { AlertItem } from '../mocks/mockRegionalApi';

const filters = [
  { id: 'all', label: '전체' },
  { id: 'warn', label: '경고' },
  { id: 'critical', label: '위험' }
] as const;

type AlertsCardProps = {
  alerts: AlertItem[];
};

const severityLabel: Record<AlertItem['severity'], string> = {
  info: '안내',
  warn: '경고',
  critical: '위험'
};

const severityClass: Record<AlertItem['severity'], string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700'
};

export function AlertsCard({ alerts }: AlertsCardProps) {
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter((item) => item.severity === filter);
  }, [alerts, filter]);

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">알림 · 이상징후</div>
        <div className="flex items-center gap-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded border px-2 py-1 text-[11px] ${
                filter === item.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
              }`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 max-h-56 space-y-2 overflow-auto">
        {filtered.length === 0 && (
          <div className="rounded border border-dashed border-gray-200 p-3 text-xs text-gray-500">표시할 항목이 없습니다.</div>
        )}
        {filtered.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-2 rounded border border-gray-100 p-2">
            <div>
              <div className="text-xs text-gray-800">{item.regionName}</div>
              <div className="mt-1 text-[11px] text-gray-500">{item.message}</div>
              <div className="mt-1 text-[11px] text-gray-400">{new Date(item.ts).toLocaleString('ko-KR')}</div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${severityClass[item.severity]}`}>
              {severityLabel[item.severity]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
