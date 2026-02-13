import React, { useMemo } from 'react';
import type { InternalRangeKey, KpiKey } from './opsContracts';
import type { RegionalScope } from '../geomap/regions';

interface RegionalReportsPageProps {
  region: RegionalScope;
  selectedKpiKey: KpiKey;
  selectedRegionSgg: string | null;
  selectedRange: InternalRangeKey;
}

const KPI_LABEL: Record<KpiKey, string> = {
  regionalSla: '신규 유입',
  regionalQueueRisk: '처리 중',
  regionalRecontact: 'SLA 위험',
  regionalDataReadiness: '재접촉 필요',
  regionalGovernance: '센터 리스크',
  regionalAdTransitionHotspot: 'AD 전환 위험',
  regionalDxDelayHotspot: '감별검사 지연',
  regionalScreenToDxRate: '선별→정밀연계 전환율',
};

const RANGE_LABEL: Record<InternalRangeKey, string> = {
  week: '주간',
  month: '월간',
  quarter: '분기',
};

const hashSeed = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
};
const sv = (seed: string, min: number, max: number) => min + (max - min) * ((hashSeed(seed) % 1000) / 1000);

export function RegionalReportsPage({ region, selectedKpiKey, selectedRegionSgg, selectedRange }: RegionalReportsPageProps) {
  const seed = `${region.id}-${selectedRegionSgg ?? 'all'}-${selectedKpiKey}-${selectedRange}`;

  const metrics = useMemo(() => {
    return {
      summary: Number(sv(`${seed}-summary`, 60, 96).toFixed(1)),
      queue: Math.round(sv(`${seed}-queue`, 120, 680)),
      actions: Math.round(sv(`${seed}-actions`, 18, 90)),
      pending: Math.round(sv(`${seed}-pending`, 6, 42)),
    };
  }, [seed]);

  return (
    <div className="h-full overflow-auto bg-gray-50 p-4 space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-800">보고서</div>
        <div className="text-[12px] text-gray-500 mt-0.5">
          결과 출력 전용 화면 · {region.label} · {selectedRegionSgg ?? '광역 전체'} · {KPI_LABEL[selectedKpiKey]} · {RANGE_LABEL[selectedRange]}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-[12px] text-gray-500">요약 지표</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{metrics.summary}%</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-[12px] text-gray-500">누적 큐 규모</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{metrics.queue.toLocaleString()}건</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-[12px] text-gray-500">개입 실행 건수</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{metrics.actions.toLocaleString()}건</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-[12px] text-gray-500">미조치 항목</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{metrics.pending.toLocaleString()}건</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-700 mb-2">내보내기</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">주간 요약 PDF</button>
          <button className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">월간 운영 PPT</button>
          <button className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">KPI CSV</button>
        </div>
      </div>
    </div>
  );
}
