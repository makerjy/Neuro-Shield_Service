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

type LeftKpiPanelProps = {
  variant?: 'national' | 'regional';
  kpi: NationalKpi | RegionalKpi | null;
  loading?: boolean;
  partial?: boolean;
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

export function LeftKpiPanel({ variant = 'national', kpi, loading, partial }: LeftKpiPanelProps) {
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

  const data = kpi as NationalKpi | null;
  const cards: CardItem[] = [
    {
      key: 'throughputNow',
      title: '전국 운영 처리건수',
      value: data ? formatCount(data.throughputNow) : '-',
      sub: '현재 기준'
    },
    {
      key: 'slaViolationRateNow',
      title: 'SLA 위반률',
      value: data ? formatPercent(data.slaViolationRateNow, 2) : '-',
      sub: '임계 3%',
      status: data && data.slaViolationRateNow >= THRESHOLDS.slaViolationRate ? 'risk' : 'normal'
    },
    {
      key: 'dataShortageRateNow',
      title: '데이터 부족률',
      value: data ? formatPercent(data.dataShortageRateNow, 2) : '-',
      sub: '임계 5%',
      status: data && data.dataShortageRateNow >= THRESHOLDS.dataShortageRate ? 'warn' : 'normal'
    },
    {
      key: 'activeIncidentsNow',
      title: '활성 이슈',
      value: data ? `${data.activeIncidentsNow}건` : '-',
      sub: data ? `전주 대비 ${formatSignedPercent(data.activeIncidentsWoW, 1)}` : '-'
    }
  ];

  return (
    <div className="space-y-3">
      {cards.map((card) => (
        <div key={card.key} className={`rounded-md border bg-white p-4 ${statusClass(card.status)}`}>
          <div className="text-xs text-gray-500">{card.title}</div>
          <div className="mt-2 text-2xl font-bold">{card.value}</div>
          <div className={`mt-1 text-xs ${partial ? 'text-gray-400' : 'text-gray-500'}`}>{card.sub}</div>
          {partial && <div className="mt-2 text-[11px] text-gray-400">일부 값 누락</div>}
        </div>
      ))}
    </div>
  );
}
