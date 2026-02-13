import React, { useEffect, useMemo, useState } from 'react';
import type {
  InternalRangeKey,
  Intervention,
  InterventionDraft,
  InterventionMetricSnapshot,
  InterventionStatus,
  InterventionType,
  KpiKey,
} from './opsContracts';
import type { RegionalScope } from '../geomap/regions';
import { safeOpsText } from '../../lib/uiTextGuard';

interface RegionalInterventionsPageProps {
  region: RegionalScope;
  districtOptions: string[];
  selectedKpiKey: KpiKey;
  selectedRegionSgg: string | null;
  selectedRange: InternalRangeKey;
  onSelectedKpiKeyChange: (kpi: KpiKey) => void;
  onSelectedRegionSggChange: (sgg: string | null) => void;
  onSelectedRangeChange: (range: InternalRangeKey) => void;
  pendingDraft?: InterventionDraft | null;
  onPendingDraftConsumed?: () => void;
}

const KPI_LABEL: Record<KpiKey, string> = {
  regionalSla: '신규 유입',
  regionalQueueRisk: '처리 중',
  regionalRecontact: 'SLA 위험',
  regionalDataReadiness: '재접촉 필요',
  regionalGovernance: '센터 리스크',
};

const TYPE_LABEL: Record<InterventionType, string> = {
  STAFFING: '인력 배치',
  RECONTACT_PUSH: '재접촉 집중',
  DATA_FIX: '데이터 보완',
  PATHWAY_TUNE: '경로 조정',
  GOVERNANCE_FIX: '로그 보완',
};

const STATUS_LABEL: Record<InterventionStatus, string> = {
  TODO: '미조치',
  IN_PROGRESS: '조치중',
  DONE: '완료',
  BLOCKED: '보류',
};

const STATUS_STYLE: Record<InterventionStatus, string> = {
  TODO: 'bg-gray-100 text-gray-700 border-gray-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  DONE: 'bg-green-100 text-green-700 border-green-200',
  BLOCKED: 'bg-amber-100 text-amber-700 border-amber-200',
};

const OWNER_OPTIONS = ['김운영', '박지원', '이현장', '최기획'];

const hashSeed = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
};

const sv = (seed: string, min: number, max: number) => min + (max - min) * ((hashSeed(seed) % 1000) / 1000);

function buildMetrics(seed: string): InterventionMetricSnapshot {
  return {
    regionalSla: Math.round(sv(`${seed}-inflow`, 80, 420)),
    regionalQueueRisk: Math.round(sv(`${seed}-queue`, 110, 540)),
    regionalRecontact: Number(sv(`${seed}-sla-risk`, 4, 19).toFixed(1)),
    regionalDataReadiness: Number(sv(`${seed}-recontact-need`, 5, 24).toFixed(1)),
    regionalGovernance: Number(sv(`${seed}-center-risk`, 28, 82).toFixed(1)),
  };
}

function buildInitialInterventions(regionId: string, districts: string[]): Intervention[] {
  const baseTypes: InterventionType[] = ['STAFFING', 'RECONTACT_PUSH', 'DATA_FIX', 'PATHWAY_TUNE'];
  return baseTypes.map((type, idx) => {
    const district = districts[idx % Math.max(districts.length, 1)] ?? '권역 전체';
    const kpiKey = (['regionalQueueRisk', 'regionalRecontact', 'regionalDataReadiness', 'regionalSla'] as KpiKey[])[idx];
    const createdAt = new Date(Date.now() - idx * 86400000).toISOString();
    const before = buildMetrics(`${regionId}-${district}-${type}-before`);
    const after = idx % 2 === 0 ? buildMetrics(`${regionId}-${district}-${type}-after`) : undefined;

    return {
      id: `INT-${idx + 1}`,
      region: district,
      kpiKey,
      type,
      status: idx === 0 ? 'IN_PROGRESS' : idx === 1 ? 'TODO' : idx === 2 ? 'DONE' : 'BLOCKED',
      owner: OWNER_OPTIONS[idx % OWNER_OPTIONS.length],
      createdAt,
      notes: safeOpsText(`${district} ${TYPE_LABEL[type]} 운영 제안`),
      evidenceLinks: [`https://ops.example.local/${regionId}/${idx + 1}`],
      beforeMetrics: before,
      afterMetrics: after,
      timeline: [
        {
          id: `T-${idx + 1}-1`,
          at: createdAt,
          actor: OWNER_OPTIONS[idx % OWNER_OPTIONS.length],
          message: safeOpsText('개입 항목이 생성되어 담당자에게 배정됨'),
        },
        {
          id: `T-${idx + 1}-2`,
          at: new Date(Date.parse(createdAt) + 3600 * 1000 * 18).toISOString(),
          actor: OWNER_OPTIONS[(idx + 1) % OWNER_OPTIONS.length],
          message: safeOpsText('진행 로그와 근거 링크가 업데이트됨'),
        },
      ],
    };
  });
}

function metricDeltaRows(item: Intervention) {
  if (!item.afterMetrics) return [] as Array<{ label: string; before: number; after: number; delta: number; unit: string }>;

  const rows = [
    {
      key: 'regionalSla' as const,
      label: '신규 유입 변화',
      unit: '건',
    },
    {
      key: 'regionalQueueRisk' as const,
      label: '처리 중 큐 변화',
      unit: '건',
    },
    {
      key: 'regionalRecontact' as const,
      label: 'SLA 위험 변화',
      unit: '%',
    },
    {
      key: 'regionalDataReadiness' as const,
      label: '재접촉 필요 변화',
      unit: '%',
    },
    {
      key: 'regionalGovernance' as const,
      label: '센터 리스크 변화',
      unit: '점',
    },
  ];

  return rows.map((meta) => {
    const before = item.beforeMetrics[meta.key];
    const after = item.afterMetrics?.[meta.key] ?? before;
    return {
      label: meta.label,
      before,
      after,
      delta: Number((after - before).toFixed(1)),
      unit: meta.unit,
    };
  });
}

function formatMetricByUnit(value: number, unit: string): string {
  if (unit === '건' || unit === '점') return `${Math.round(value)}${unit}`;
  return `${value.toFixed(1)}${unit}`;
}

export function RegionalInterventionsPage({
  region,
  districtOptions,
  selectedKpiKey,
  selectedRegionSgg,
  selectedRange,
  onSelectedKpiKeyChange,
  onSelectedRegionSggChange,
  onSelectedRangeChange,
  pendingDraft,
  onPendingDraftConsumed,
}: RegionalInterventionsPageProps) {
  const [interventions, setInterventions] = useState<Intervention[]>(() => buildInitialInterventions(region.id, districtOptions));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InterventionStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<InterventionType | 'ALL'>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');

  useEffect(() => {
    setInterventions(buildInitialInterventions(region.id, districtOptions));
    setSelectedId(null);
  }, [districtOptions, region.id]);

  useEffect(() => {
    if (!pendingDraft) return;

    const now = new Date().toISOString();
    const draftRegion = pendingDraft.region ?? selectedRegionSgg ?? districtOptions[0] ?? '권역 전체';
    const draftType: InterventionType = pendingDraft.type ?? (pendingDraft.kpiKey === 'regionalGovernance' ? 'GOVERNANCE_FIX' : 'RECONTACT_PUSH');
    const beforeMetrics = buildMetrics(`${region.id}-${draftRegion}-${pendingDraft.kpiKey}-before-draft`);

    const stageNote = pendingDraft.primaryDriverStage
      ? safeOpsText(` · 우선 병목 단계 ${pendingDraft.primaryDriverStage}`)
      : '';

    const created: Intervention = {
      id: `INT-${Date.now()}`,
      region: draftRegion,
      kpiKey: pendingDraft.kpiKey,
      type: draftType,
      status: 'TODO',
      owner: OWNER_OPTIONS[0],
      createdAt: now,
      notes: safeOpsText(`${draftRegion} ${TYPE_LABEL[draftType]} 개입 항목${stageNote}`),
      evidenceLinks: [],
      beforeMetrics,
      timeline: [
        {
          id: `T-${Date.now()}-0`,
          at: now,
          actor: '시스템',
          message: safeOpsText(
            `개입 항목이 자동 초안으로 생성됨${pendingDraft.primaryDriverStage ? ` (우선 병목 단계 ${pendingDraft.primaryDriverStage})` : ''}`,
          ),
        },
      ],
    };

    setInterventions((prev) => [created, ...prev]);
    setSelectedId(created.id);
    onPendingDraftConsumed?.();
  }, [districtOptions, onPendingDraftConsumed, pendingDraft, region.id, selectedRegionSgg]);

  const filtered = useMemo(() => {
    return interventions.filter((item) => {
      if (selectedRegionSgg && item.region !== selectedRegionSgg) return false;
      if (selectedKpiKey && item.kpiKey !== selectedKpiKey) return false;
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (ownerFilter !== 'ALL' && item.owner !== ownerFilter) return false;
      return true;
    });
  }, [interventions, ownerFilter, selectedKpiKey, selectedRegionSgg, statusFilter, typeFilter]);

  const selected = useMemo(() => {
    if (!filtered.length) return null;
    if (!selectedId) return filtered[0];
    return filtered.find((item) => item.id === selectedId) ?? filtered[0];
  }, [filtered, selectedId]);

  const deltaRows = useMemo(() => (selected ? metricDeltaRows(selected) : []), [selected]);

  const setStatus = (next: InterventionStatus) => {
    if (!selected) return;
    setInterventions((prev) =>
      prev.map((item) => {
        if (item.id !== selected.id) return item;
        const nextTimeline = [
          ...item.timeline,
          {
            id: `T-${item.id}-${Date.now()}`,
            at: new Date().toISOString(),
            actor: '운영자',
            message: safeOpsText(`상태가 ${STATUS_LABEL[next]}로 변경됨`),
          },
        ];
        return { ...item, status: next, timeline: nextTimeline };
      }),
    );
  };

  const createGovernanceIntervention = () => {
    const now = new Date().toISOString();
    const district = selectedRegionSgg ?? districtOptions[0] ?? '권역 전체';
    const beforeMetrics = buildMetrics(`${region.id}-${district}-gov-before-auto`);
    const created: Intervention = {
      id: `INT-GOV-${Date.now()}`,
      region: district,
      kpiKey: 'regionalGovernance',
      type: 'GOVERNANCE_FIX',
      status: 'TODO',
      owner: OWNER_OPTIONS[1],
      createdAt: now,
      notes: safeOpsText('거버넌스 누락 항목 자동 개입 생성'),
      evidenceLinks: [],
      beforeMetrics,
      timeline: [
        {
          id: `T-GOV-${Date.now()}`,
          at: now,
          actor: '시스템',
          message: safeOpsText('거버넌스 누락 신호로 자동 개입이 생성됨'),
        },
      ],
    };
    setInterventions((prev) => [created, ...prev]);
    setSelectedId(created.id);
  };

  return (
    <div className="h-full overflow-auto bg-gray-50 p-4 space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-800">개입·조치 관리</div>
            <div className="text-[12px] text-gray-500">개입 타임라인 · 전후 KPI 변화 · 미조치 항목 추적</div>
          </div>
          <button
            onClick={createGovernanceIntervention}
            className="px-3 py-1.5 rounded-md border border-purple-200 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100"
          >
            거버넌스 누락 자동 개입 생성
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-2">
          <select value={selectedRange} onChange={(e) => onSelectedRangeChange(e.target.value as InternalRangeKey)} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="week">주간</option>
            <option value="month">월간</option>
            <option value="quarter">분기</option>
          </select>

          <select value={selectedRegionSgg ?? ''} onChange={(e) => onSelectedRegionSggChange(e.target.value || null)} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="">{region.label} 전체</option>
            {districtOptions.map((district) => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>

          <select value={selectedKpiKey} onChange={(e) => onSelectedKpiKeyChange(e.target.value as KpiKey)} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
            {Object.entries(KPI_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InterventionStatus | 'ALL')} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="ALL">상태 전체</option>
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as InterventionType | 'ALL')} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="ALL">타입 전체</option>
            {Object.entries(TYPE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="ALL">담당자 전체</option>
            {OWNER_OPTIONS.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-3 min-h-[620px]">
        <div className="bg-white border border-gray-200 rounded-lg p-3 overflow-y-auto">
          <div className="text-sm font-semibold text-gray-700 mb-2">개입 리스트</div>
          <div className="space-y-2">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-2 rounded border transition-colors ${selected?.id === item.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-medium text-gray-900 truncate">{item.region}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                </div>
                <div className="text-[12px] text-gray-600 mt-0.5">{TYPE_LABEL[item.type]} · {KPI_LABEL[item.kpiKey]}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">담당: {item.owner} · 생성: {item.createdAt.slice(0, 10)}</div>
              </button>
            ))}
            {!filtered.length && <div className="text-[12px] text-gray-500">조건에 맞는 개입 항목이 없습니다.</div>}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3 overflow-y-auto">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{selected.region} · {TYPE_LABEL[selected.type]}</div>
                  <div className="text-[12px] text-gray-500">{KPI_LABEL[selected.kpiKey]} · 담당 {selected.owner}</div>
                </div>
                <span className={`text-[11px] px-2 py-1 rounded border ${STATUS_STYLE[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as InterventionStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatus(status)}
                    className={`px-2 py-1.5 rounded border text-[12px] font-medium ${selected.status === status ? STATUS_STYLE[status] : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>

              <div className="p-2 rounded border border-gray-100 bg-gray-50">
                <div className="text-[12px] font-medium text-gray-700 mb-1">개입 메모</div>
                <div className="text-[12px] text-gray-600">{selected.notes}</div>
              </div>

              <div className="p-2 rounded border border-gray-100 bg-gray-50">
                <div className="text-[12px] font-medium text-gray-700 mb-1">전후 KPI 변화</div>
                {deltaRows.length > 0 ? (
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1">항목</th>
                        <th className="text-right py-1">Before</th>
                        <th className="text-right py-1">After</th>
                        <th className="text-right py-1">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deltaRows.map((row) => (
                        <tr key={row.label} className="border-b border-gray-100 last:border-b-0">
                          <td className="py-1 text-gray-700">{row.label}</td>
                          <td className="py-1 text-right text-gray-600">{formatMetricByUnit(row.before, row.unit)}</td>
                          <td className="py-1 text-right text-gray-600">{formatMetricByUnit(row.after, row.unit)}</td>
                          <td className={`py-1 text-right font-medium ${row.delta >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                            {row.delta > 0 ? '+' : ''}{formatMetricByUnit(row.delta, row.unit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-[12px] text-gray-500">after 수치가 아직 등록되지 않아 변화값이 비어 있습니다.</div>
                )}
              </div>

              <div className="p-2 rounded border border-gray-100 bg-gray-50">
                <div className="text-[12px] font-medium text-gray-700 mb-1">타임라인</div>
                <div className="space-y-1.5">
                  {selected.timeline.map((event) => (
                    <div key={event.id} className="text-[12px] text-gray-600">
                      <span className="text-gray-400">[{event.at.slice(0, 16).replace('T', ' ')}]</span> {event.actor} · {event.message}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-2 rounded border border-gray-100 bg-gray-50">
                <div className="text-[12px] font-medium text-gray-700 mb-1">근거/로그 링크</div>
                <div className="space-y-1">
                  {selected.evidenceLinks.length ? (
                    selected.evidenceLinks.map((link) => (
                      <a key={link} href={link} target="_blank" rel="noreferrer" className="block text-[12px] text-blue-700 underline">
                        {link}
                      </a>
                    ))
                  ) : (
                    <div className="text-[12px] text-gray-500">등록된 링크가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">표시할 개입 항목이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}
