import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import {
  AlertTriangle, CheckCircle, TrendingDown,
  Activity, MapPin, Zap, Database, Brain,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import type { TabContext } from '../../lib/useTabContext';
import {
  MOCK_DRIVER_ANALYSIS, MOCK_QUALITY_ALERTS,
  type QualityAlert,
} from '../../mocks/mockCentralOps';

/* ─── Props ─── */
interface QualityMonitoringProps {
  context?: TabContext;
  onNavigate?: (page: string, ctx?: Partial<TabContext>) => void;
}

/* ─── 모델 성능 + 조치 권고 통합 mock ─── */
type ActionStatus = 'normal' | 'caution' | 'action';

const modelPerformance: {
  model: string; accuracy: number; f1Score: number; delta: string;
  drift: boolean; impactKpi: string; actionStatus: ActionStatus; actionLabel: string;
}[] = [
  {
    model: 'L1/L2 분류 모델', accuracy: 94.2, f1Score: 93.9,
    delta: '+0.3', drift: false, impactKpi: 'SLA 준수율',
    actionStatus: 'normal', actionLabel: '정상 · 관찰',
  },
  {
    model: 'L3 위험 예측 모델', accuracy: 89.5, f1Score: 89.2,
    delta: '-2.4', drift: true, impactKpi: '위험 탐지율',
    actionStatus: 'action', actionLabel: '조치 필요 · 재학습 권고',
  },
  {
    model: '재접촉 우선순위 모델', accuracy: 91.8, f1Score: 91.6,
    delta: '-0.5', drift: false, impactKpi: '접촉 성공률',
    actionStatus: 'caution', actionLabel: '주의 · 모니터링 강화',
  },
];

/* ─── helpers ─── */
const DRIVER_ICON: Record<string, React.ReactNode> = {
  ops_bottleneck: <Zap className="h-5 w-5 text-orange-500" />,
  data_quality:   <Database className="h-5 w-5 text-blue-500" />,
  contact_strategy: <Activity className="h-5 w-5 text-green-500" />,
  model_fitness:  <Brain className="h-5 w-5 text-purple-500" />,
};

const DRIVER_COLOR: Record<string, string> = {
  ops_bottleneck: '#f97316', data_quality: '#3b82f6',
  contact_strategy: '#22c55e', model_fitness: '#a855f7',
};

const sevBg = (s: QualityAlert['severity']) =>
  s === 'critical' ? 'border-red-200 bg-red-50' :
  s === 'warning'  ? 'border-orange-200 bg-orange-50' :
  'border-blue-200 bg-blue-50';

const sevLabel = (s: QualityAlert['severity']) =>
  s === 'critical' ? '심각' : s === 'warning' ? '주의' : '정보';

const ACTION_STYLE: Record<ActionStatus, string> = {
  normal:  'bg-green-50 text-green-700 border-green-200',
  caution: 'bg-amber-50  text-amber-700  border-amber-200',
  action:  'bg-red-50   text-red-700   border-red-200',
};

/* ═══════════════════════════════════════════════
   Single Quality Decision View
   ═══════════════════════════════════════════════ */
export function QualityMonitoring({ context, onNavigate }: QualityMonitoringProps) {
  /* ── state ── */
  const sortedDrivers = useMemo(
    () => [...MOCK_DRIVER_ANALYSIS].sort((a, b) => b.contributionPct - a.contributionPct),
    [],
  );
  const [selectedDriver, setSelectedDriver] = useState<string>(
    context?.driver || sortedDrivers[0]?.key || 'ops_bottleneck',
  );
  const [showAlerts, setShowAlerts] = useState(false);

  const driverDetail = useMemo(
    () => MOCK_DRIVER_ANALYSIS.find((d) => d.key === selectedDriver) ?? sortedDrivers[0],
    [selectedDriver, sortedDrivers],
  );

  const driverChartData = sortedDrivers.map((d) => ({
    name: d.label, contribution: d.contributionPct, key: d.key,
  }));

  /* ── derived counts ── */
  const activeAlerts   = MOCK_QUALITY_ALERTS.filter((a) => !a.resolved);
  const criticalCount  = MOCK_QUALITY_ALERTS.filter((a) => a.severity === 'critical').length;
  const warningCount   = MOCK_QUALITY_ALERTS.filter((a) => a.severity === 'warning').length;
  const actionModels   = modelPerformance.filter((m) => m.actionStatus === 'action').length;
  const cautionModels  = modelPerformance.filter((m) => m.actionStatus === 'caution').length;
  const flaggedMetrics = driverDetail.indicators.filter((i) => i.status !== 'green');
  const relatedAlerts  = MOCK_QUALITY_ALERTS.filter(
    (a) => a.relatedDriver === driverDetail.key && !a.resolved,
  );

  return (
    <div className="space-y-5 p-1">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">데이터 & 모델 품질</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          품질 현황 · Driver 영향 분석 · 모델 성능 및 조치 권고를 한눈에 파악합니다.
        </p>
      </div>

      {/* ═══ [A] Quality Overview KPI Strip ═══ */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'KPI 평균 변화율', value: '-1.8%p', sub: '전주 대비',
            icon: <TrendingDown className="h-5 w-5" />,
            color: 'text-orange-600', bg: 'bg-orange-50',
          },
          {
            label: '데이터 품질 이슈',
            value: `${criticalCount + warningCount}건`,
            sub: `심각 ${criticalCount} · 주의 ${warningCount}`,
            icon: <Database className="h-5 w-5" />,
            color: criticalCount > 0 ? 'text-red-600' : 'text-amber-600',
            bg: criticalCount > 0 ? 'bg-red-50' : 'bg-amber-50',
          },
          {
            label: '운영 병목 경고',
            value: `${sortedDrivers.filter((d) => d.severity === 'critical').length}건`,
            sub: `최고 기여: ${sortedDrivers[0]?.label} (${sortedDrivers[0]?.contributionPct}%)`,
            icon: <Zap className="h-5 w-5" />,
            color: 'text-orange-600', bg: 'bg-orange-50',
          },
          {
            label: '모델 성능 경고',
            value: `${actionModels + cautionModels}건`,
            sub: `조치 ${actionModels} · 주의 ${cautionModels}`,
            icon: <Brain className="h-5 w-5" />,
            color: actionModels > 0 ? 'text-red-600' : 'text-green-600',
            bg: actionModels > 0 ? 'bg-red-50' : 'bg-green-50',
          },
        ].map((kpi, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color}`}>{kpi.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">{kpi.label}</div>
                  <div className="text-xl font-bold text-gray-900">{kpi.value}</div>
                  <div className="text-[11px] text-gray-400 truncate">{kpi.sub}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ [B] Driver Impact + Auto-Summary ═══ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: BarChart + Driver list */}
        <div className="col-span-5 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                KPI 하락 Driver 기여도
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={driverChartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 50]} unit="%" />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar
                    dataKey="contribution"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(_: unknown, idx: number) => setSelectedDriver(driverChartData[idx].key)}
                  >
                    {driverChartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={DRIVER_COLOR[d.key] || '#6b7280'}
                        opacity={selectedDriver === d.key ? 1 : 0.45}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Driver card list */}
          <div className="space-y-2">
            {sortedDrivers.map((d, idx) => (
              <button
                key={d.key}
                onClick={() => setSelectedDriver(d.key)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedDriver === d.key
                    ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {idx < 2 && (
                    <span className="text-[10px] font-bold text-white bg-red-500 rounded px-1">
                      TOP{idx + 1}
                    </span>
                  )}
                  {DRIVER_ICON[d.key]}
                  <span className="font-medium text-sm text-gray-900">{d.label}</span>
                  <span
                    className="ml-auto text-sm font-bold"
                    style={{ color: DRIVER_COLOR[d.key] }}
                  >
                    {d.contributionPct}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{d.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Auto-Summary panel (항상 표시) */}
        <div className="col-span-7">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {DRIVER_ICON[driverDetail.key]}
                  <div>
                    <CardTitle className="text-lg">{driverDetail.label}</CardTitle>
                    <p className="text-xs text-gray-500">{driverDetail.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-2xl font-bold"
                    style={{ color: DRIVER_COLOR[driverDetail.key] }}
                  >
                    {driverDetail.contributionPct}%
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    driverDetail.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    driverDetail.severity === 'warning'  ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {driverDetail.severity === 'critical' ? '심각' :
                     driverDetail.severity === 'warning'  ? '주의' : '양호'}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4 flex-1 overflow-y-auto">
              {/* Auto-generated summary */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <strong>{driverDetail.label}</strong>은(는) 현재 KPI 하락의{' '}
                    <strong className="text-red-600">{driverDetail.contributionPct}%</strong>를
                    차지하는{' '}
                    {sortedDrivers[0]?.key === driverDetail.key ? '최상위 원인' : '주요 원인'}입니다.{' '}
                    {flaggedMetrics.length > 0
                      ? <>
                          {flaggedMetrics.map((m) => m.label).join(', ')} 지표가 기준 미달이며,{' '}
                          특히 <strong>{driverDetail.topRegions[0]?.name}</strong> 지역이 가장
                          심각합니다.
                        </>
                      : '모든 지표가 기준 이내이나 지속적인 모니터링이 필요합니다.'}
                  </p>
                </div>
              </div>

              {/* Flagged metrics */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  ⚠ 세부 지표 현황
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {driverDetail.indicators.map((ind, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-lg border ${
                        ind.status === 'red'    ? 'border-red-200 bg-red-50' :
                        ind.status === 'yellow' ? 'border-amber-200 bg-amber-50' :
                        'border-green-200 bg-green-50'
                      }`}
                    >
                      <div className="text-[11px] text-gray-500">{ind.label}</div>
                      <div className="flex items-end justify-between mt-0.5">
                        <span className="text-base font-bold text-gray-900">
                          {ind.value}
                          {ind.unit}
                        </span>
                        <span className={`text-[10px] font-medium ${
                          ind.status === 'red'    ? 'text-red-600' :
                          ind.status === 'yellow' ? 'text-amber-600' :
                          'text-green-600'
                        }`}>
                          기준 {ind.threshold}{ind.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Affected regions */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  <MapPin className="h-3 w-3 inline mr-1" />영향 상위 지역
                </h4>
                <div className="space-y-1.5">
                  {driverDetail.topRegions.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-xs font-bold text-gray-400">{i + 1}</span>
                      <span className="font-medium text-gray-800 w-24">{r.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100 - r.score, 100)}%`,
                            backgroundColor: DRIVER_COLOR[driverDetail.key],
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-36 text-right truncate">
                        {r.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related alerts */}
              {relatedAlerts.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    🔔 관련 경보
                  </h4>
                  <div className="space-y-1.5">
                    {relatedAlerts.map((a) => (
                      <div key={a.id} className={`p-2 rounded border text-xs ${sevBg(a.severity)}`}>
                        <span className="font-medium text-gray-900">{a.title}</span>
                        <span className="text-gray-500 ml-2">· {a.region}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ [C] Model Performance + Action Recommendation ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              모델 성능 및 조치 권고
            </CardTitle>
            <span className="text-xs text-gray-400">최근 평가: 2026-01-20</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/60">
                  <th className="text-left  py-2.5 px-3 text-xs font-semibold text-gray-600">모델명</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">F1 점수</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-600">정확도</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-600">성능 변화(Δ)</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-600">드리프트</th>
                  <th className="text-left  py-2.5 px-3 text-xs font-semibold text-gray-600">영향 KPI</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-600">조치 권고</th>
                </tr>
              </thead>
              <tbody>
                {modelPerformance.map((m, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-3 text-sm font-medium text-gray-900">{m.model}</td>
                    <td className="py-3 px-3 text-sm text-right text-gray-900">{m.f1Score}%</td>
                    <td className="py-3 px-3 text-sm text-right text-gray-900">{m.accuracy}%</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-sm font-medium ${
                        m.delta.startsWith('+') ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {m.delta}%p
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {m.drift ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                          감지됨
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                          없음
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-700">{m.impactKpi}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium border ${ACTION_STYLE[m.actionStatus]}`}>
                        {m.actionLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ [D] Quality Alerts — collapsible ═══ */}
      <Card>
        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-gray-900">품질 경보</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              {activeAlerts.length}건 활성
            </span>
          </div>
          {showAlerts
            ? <ChevronUp className="h-4 w-4 text-gray-400" />
            : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {showAlerts && (
          <CardContent className="pt-0 space-y-2">
            {MOCK_QUALITY_ALERTS.map((a) => (
              <div key={a.id} className={`p-3 rounded-lg border ${sevBg(a.severity)}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900">{a.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 font-medium">
                        {sevLabel(a.severity)}
                      </span>
                      {a.resolved && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                    </div>
                    <p className="text-xs text-gray-600">{a.description}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {a.region} · {a.detectedAt.replace('T', ' ').slice(0, 16)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
