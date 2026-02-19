import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Search, ExternalLink, Sigma, GitCompare, Layers, NotebookText } from 'lucide-react';
import { getCentralKpiList } from '../../lib/centralKpiDictionary';
import {
  CENTRAL_CENTER_PAGE_LABELS,
  getCentralKpiStandardById,
  getCentralKpiStandardList,
  type CentralCenterPageId,
  type CentralKpiCategory,
} from '../../lib/centralKpiStandard';
import { fetchCentralKpis } from '../../lib/centralApi';
import type { CentralKpiId, CentralKpiValue, CentralTimeWindow } from '../../lib/kpi.types';
import type { TabContext } from '../../lib/useTabContext';

interface KPIDictionaryProps {
  onNavigate?: (page: string, ctx?: Partial<TabContext>) => void;
}

const WINDOW_LABELS: Record<CentralTimeWindow, string> = {
  LAST_24H: '최근 24시간',
  LAST_7D: '최근 7일',
  LAST_30D: '최근 30일',
  LAST_90D: '최근 90일',
};

const TYPE_BADGE_CLASS: Record<CentralKpiCategory, string> = {
  신호: 'bg-blue-50 text-blue-700 border-blue-200',
  영향: 'bg-violet-50 text-violet-700 border-violet-200',
  위험: 'bg-red-50 text-red-700 border-red-200',
  준비: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  거버넌스: 'bg-amber-50 text-amber-700 border-amber-200',
};

const KPI_CONTEXT_BY_ID: Record<CentralKpiId, {
  kpi: string;
  changeId?: string;
  auditId?: string;
  driver?: TabContext['driver'];
}> = {
  SIGNAL_QUALITY: {
    kpi: 'SIGNAL_QUALITY',
    auditId: 'ua_002',
    driver: 'data_quality',
  },
  POLICY_IMPACT: {
    kpi: 'POLICY_IMPACT',
    changeId: 'chg_20260124',
    auditId: 'ua_004',
    driver: 'model_fitness',
  },
  BOTTLENECK_RISK: {
    kpi: 'BOTTLENECK_RISK',
    changeId: 'chg_20260120',
    auditId: 'ua_001',
    driver: 'ops_bottleneck',
  },
  DATA_READINESS: {
    kpi: 'DATA_READINESS',
    auditId: 'ua_003',
    driver: 'data_quality',
  },
  GOVERNANCE_SAFETY: {
    kpi: 'GOVERNANCE_SAFETY',
    changeId: 'chg_20260110',
    auditId: 'ua_001',
    driver: 'contact_strategy',
  },
};

const NAVIGABLE_PAGES: CentralCenterPageId[] = [
  'national-dashboard',
  'model-governance',
  'quality-monitoring',
  'compliance-audit',
];

function buildContext(kpiId: CentralKpiId, page: CentralCenterPageId): Partial<TabContext> {
  const base = KPI_CONTEXT_BY_ID[kpiId];
  const ctx: Partial<TabContext> = {
    level: 'nation',
    region: 'KR',
    period: 'WEEK',
    kpi: base.kpi,
  };

  if (page === 'model-governance' && base.changeId) {
    ctx.changeId = base.changeId;
  }
  if (page === 'quality-monitoring' && base.driver) {
    ctx.driver = base.driver;
  }
  if (page === 'compliance-audit' && base.auditId) {
    ctx.auditId = base.auditId;
  }

  return ctx;
}

function HistoryImpactedScreens({
  screens,
  onNavigate,
  kpiId,
}: {
  screens: CentralCenterPageId[];
  onNavigate?: (page: string, ctx?: Partial<TabContext>) => void;
  kpiId: CentralKpiId;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {screens.map((screen) => (
        <button
          key={screen}
          type="button"
          onClick={() => onNavigate?.(screen, buildContext(kpiId, screen))}
          className="text-[11px] px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50"
        >
          {CENTRAL_CENTER_PAGE_LABELS[screen]}
        </button>
      ))}
    </div>
  );
}

export function KPIDictionary({ onNavigate }: KPIDictionaryProps) {
  const kpiDefinitions = useMemo(() => getCentralKpiList(), []);
  const kpiStandards = useMemo(() => getCentralKpiStandardList(), []);

  const definitionMap = useMemo(
    () => Object.fromEntries(kpiDefinitions.map((def) => [def.id, def])),
    [kpiDefinitions],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKpiId, setSelectedKpiId] = useState<CentralKpiId>(kpiStandards[0]?.id ?? 'SIGNAL_QUALITY');
  const [window, setWindow] = useState<CentralTimeWindow>('LAST_7D');
  const [valueRows, setValueRows] = useState<CentralKpiValue[]>([]);
  const [valueLoading, setValueLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setValueLoading(true);

    fetchCentralKpis(window)
      .then((res) => {
        if (cancelled) return;
        setValueRows(res.kpis);
        setValueLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setValueRows([]);
        setValueLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [window]);

  const filteredStandards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return kpiStandards;

    return kpiStandards.filter((item) => {
      const definition = definitionMap[item.id];
      const fields = [
        definition?.name,
        definition?.shortName,
        item.category,
        item.scope,
        ...item.usageScreens.map((s) => s.label),
      ]
        .join(' ')
        .toLowerCase();

      return fields.includes(q);
    });
  }, [searchQuery, kpiStandards, definitionMap]);

  useEffect(() => {
    if (filteredStandards.length === 0) return;
    const exists = filteredStandards.some((item) => item.id === selectedKpiId);
    if (!exists) {
      setSelectedKpiId(filteredStandards[0].id);
    }
  }, [filteredStandards, selectedKpiId]);

  const selectedStandard = getCentralKpiStandardById(selectedKpiId);
  const selectedDefinition = definitionMap[selectedKpiId];
  const selectedValue = valueRows.find((row) => row.kpiId === selectedKpiId);

  const derivedValue = useMemo(() => {
    if (!selectedValue || selectedValue.denominator === 0) return null;
    return Number(((selectedValue.numerator / selectedValue.denominator) * 100).toFixed(1));
  }, [selectedValue]);

  const unifiedHistory = useMemo(() => {
    return kpiStandards
      .flatMap((item) => {
        const definition = definitionMap[item.id];
        return item.changeHistory.map((history) => ({
          ...history,
          id: item.id,
          kpiName: definition?.name ?? item.id,
          category: item.category,
        }));
      })
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  }, [kpiStandards, definitionMap]);

  const handleNavigate = (page: CentralCenterPageId, kpiId: CentralKpiId) => {
    onNavigate?.(page, buildContext(kpiId, page));
  };

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI 사전 (중앙 공식 기준서)</h1>
          <p className="text-xs text-gray-500 mt-1">
            중앙 KPI 정의·계산·해석·연결 탭·변경이력을 단일 기준으로 관리합니다.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-1">
          {(['LAST_24H', 'LAST_7D', 'LAST_30D', 'LAST_90D'] as CentralTimeWindow[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              className={`px-2.5 py-1.5 text-[11px] rounded-md font-medium transition ${
                window === w ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-12">
        <Card className="2xl:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">KPI 목록 구조</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="KPI명/유형/화면으로 검색"
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-auto rounded-md border border-gray-200">
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">KPI명</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">KPI 유형</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">집계 스코프</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">사용 화면 (링크)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStandards.map((item) => {
                    const definition = definitionMap[item.id];
                    const selected = selectedKpiId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-gray-100 cursor-pointer ${selected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                        onClick={() => setSelectedKpiId(item.id)}
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="text-sm font-semibold text-gray-900">{definition?.name}</div>
                          <div className="text-[11px] text-gray-500">{item.id}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium ${TYPE_BADGE_CLASS[item.category]}`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 align-top">{item.scope}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {item.usageScreens.map((screen) => (
                              <button
                                key={`${item.id}-${screen.page}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!NAVIGABLE_PAGES.includes(screen.page)) return;
                                  handleNavigate(screen.page, item.id);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                                title={screen.reason}
                              >
                                {screen.label}
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredStandards.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-sm text-gray-500">
                        검색 조건에 맞는 KPI가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-7">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">{selectedDefinition?.name}</CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  KPI 값 해석 질문("왜 이렇게 나왔나")에 대한 공식 기준 응답
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={TYPE_BADGE_CLASS[selectedStandard.category]}>
                  {selectedStandard.category}
                </Badge>
                <Badge variant="outline">{selectedStandard.scope}</Badge>
                <Badge variant="outline">{selectedKpiId}</Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <section className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-900 mb-2">정의</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-md bg-gray-50 p-3 border border-gray-200">
                  <div className="text-[11px] font-medium text-gray-500 mb-1">무엇을 측정하는가</div>
                  <div className="text-sm text-gray-800 leading-relaxed">{selectedStandard.definition.what}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-3 border border-gray-200">
                  <div className="text-[11px] font-medium text-gray-500 mb-1">왜 필요한가</div>
                  <div className="text-sm text-gray-800 leading-relaxed">{selectedStandard.definition.why}</div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
                <Sigma className="h-4 w-4" />
                계산식
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] font-mono text-gray-900">
                {selectedDefinition?.formula}
              </div>

              <div className="grid grid-cols-1 gap-3 mt-3 md:grid-cols-2">
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                  <div className="text-[11px] font-semibold text-blue-700 mb-1">분자</div>
                  <div className="text-sm text-blue-900">{selectedStandard.calculation.numeratorLabel}</div>
                  <div className="text-[11px] text-blue-700 mt-1">필드: {selectedDefinition?.numeratorField}</div>
                </div>
                <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                  <div className="text-[11px] font-semibold text-indigo-700 mb-1">분모</div>
                  <div className="text-sm text-indigo-900">{selectedStandard.calculation.denominatorLabel}</div>
                  <div className="text-[11px] text-indigo-700 mt-1">필드: {selectedDefinition?.denominatorField}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mt-3 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold text-gray-700 mb-1.5">포함 규칙</div>
                  <ul className="space-y-1">
                    {selectedStandard.calculation.includeRules.map((rule, idx) => (
                      <li key={`${selectedKpiId}-in-${idx}`} className="text-xs text-gray-700 leading-relaxed list-disc list-inside">
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-gray-700 mb-1.5">제외 규칙</div>
                  <ul className="space-y-1">
                    {selectedStandard.calculation.excludeRules.map((rule, idx) => (
                      <li key={`${selectedKpiId}-out-${idx}`} className="text-xs text-gray-700 leading-relaxed list-disc list-inside">
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-900 mb-2">해석 가이드</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-md border border-green-200 bg-green-50 p-3">
                  <div className="text-[11px] font-semibold text-green-700 mb-1">값이 높을 때 의미</div>
                  <div className="text-sm text-green-900 leading-relaxed">{selectedStandard.interpretation.high}</div>
                </div>
                <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
                  <div className="text-[11px] font-semibold text-orange-700 mb-1">값이 낮을 때 의미</div>
                  <div className="text-sm text-orange-900 leading-relaxed">{selectedStandard.interpretation.low}</div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
                <Layers className="h-4 w-4" />
                연결 요소
              </div>

              <div className="mb-3">
                <div className="text-[11px] font-semibold text-gray-600 mb-1.5">영향 받는 모델 Stage</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStandard.linkedModelStages.map((stage) => (
                    <span key={`${selectedKpiId}-${stage}`} className="text-[11px] px-2 py-1 rounded border border-gray-200 bg-gray-50 text-gray-700">
                      {stage}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-gray-600 mb-1.5">연계 관리 탭 (변경관리/품질/감사)</div>
                <div className="flex flex-wrap gap-2">
                  {selectedStandard.linkedTabs.map((tab) => (
                    <Button
                      key={`${selectedKpiId}-tab-${tab.page}`}
                      variant="outline"
                      size="sm"
                      onClick={() => handleNavigate(tab.page, selectedKpiId)}
                      className="h-7 text-[11px]"
                    >
                      {tab.label}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  ))}
                </div>
                <div className="space-y-1 mt-2">
                  {selectedStandard.linkedTabs.map((tab) => (
                    <div key={`${selectedKpiId}-tab-reason-${tab.page}`} className="text-[11px] text-gray-600">
                      <span className="font-medium">{tab.label}</span>: {tab.reason}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
                <NotebookText className="h-4 w-4" />
                왜 이 KPI 값이 나왔는가 (공식 답변)
              </div>

              <div className="text-xs text-gray-500 mb-2">기준 기간: {WINDOW_LABELS[window]}</div>

              {valueLoading && (
                <div className="text-sm text-gray-500">값 계산 근거를 불러오는 중...</div>
              )}

              {!valueLoading && !selectedValue && (
                <div className="text-sm text-gray-500">현재 값 데이터를 불러오지 못했습니다.</div>
              )}

              {!valueLoading && selectedValue && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5">
                      <div className="text-[11px] text-gray-500 mb-0.5">분자</div>
                      <div className="text-sm font-bold text-gray-900">{selectedValue.numerator.toLocaleString()}</div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5">
                      <div className="text-[11px] text-gray-500 mb-0.5">분모</div>
                      <div className="text-sm font-bold text-gray-900">{selectedValue.denominator.toLocaleString()}</div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5">
                      <div className="text-[11px] text-gray-500 mb-0.5">표시 KPI 값</div>
                      <div className="text-sm font-bold text-gray-900">{selectedValue.value}{selectedDefinition?.unit}</div>
                    </div>
                  </div>

                  {derivedValue !== null && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                      계산 검증: {selectedValue.numerator.toLocaleString()} / {selectedValue.denominator.toLocaleString()} × 100 = {derivedValue}%
                      <span className="ml-2 text-[11px] text-blue-700">(표시값 {selectedValue.value}{selectedDefinition?.unit}, Δ7d {selectedValue.delta7d}pp)</span>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] font-semibold text-gray-700 mb-1.5">답변 체크리스트</div>
                    <ul className="space-y-1">
                      {selectedStandard.whyChecklist.map((item, idx) => (
                        <li key={`${selectedKpiId}-why-${idx}`} className="text-xs text-gray-700 leading-relaxed list-disc list-inside">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
                <GitCompare className="h-4 w-4" />
                KPI 변경 이력
              </div>

              <div className="overflow-auto rounded-md border border-gray-200">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">버전</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">변경일</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">정의 변경</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">계산식 변경</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">영향 화면 목록</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStandard.changeHistory.map((history) => (
                      <tr key={`${selectedKpiId}-${history.version}-${history.changedAt}`} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-xs font-semibold text-gray-900">{history.version}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">
                          <div>{history.changedAt}</div>
                          <div className="text-[11px] text-gray-500">{history.changedBy}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 leading-relaxed">{history.definitionChange}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 leading-relaxed">{history.formulaChange}</td>
                        <td className="px-3 py-2">
                          <HistoryImpactedScreens screens={history.impactedScreens} onNavigate={onNavigate} kpiId={selectedKpiId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">중앙 KPI 변경 로그 (통합)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-auto rounded-md border border-gray-200">
            <table className="w-full min-w-[920px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">변경일</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">KPI</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">유형</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">정의 변경</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">계산식 변경</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">영향 화면</th>
                </tr>
              </thead>
              <tbody>
                {unifiedHistory.map((item) => (
                  <tr key={`${item.id}-${item.version}-${item.changedAt}`} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-xs text-gray-700">{item.changedAt}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedKpiId(item.id)}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        {item.kpiName}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium ${TYPE_BADGE_CLASS[item.category]}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 leading-relaxed">{item.definitionChange}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 leading-relaxed">{item.formulaChange}</td>
                    <td className="px-3 py-2">
                      <HistoryImpactedScreens screens={item.impactedScreens} onNavigate={onNavigate} kpiId={item.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
