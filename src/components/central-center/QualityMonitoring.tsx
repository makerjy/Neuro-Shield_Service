import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  AlertTriangle,
  ArrowRightLeft,
  Brain,
  ChevronDown,
  ChevronUp,
  Database,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import type { TabContext } from '../../lib/useTabContext';

/* ─── Props ─── */
interface QualityMonitoringProps {
  context?: TabContext;
  onNavigate?: (page: string, ctx?: Partial<TabContext>) => void;
}

type StageId = 'stage1' | 'stage2' | 'stage3';
type StageStatus = 'normal' | 'caution' | 'warning';
type SignalStatus = 'good' | 'watch' | 'risk';
type AlertCauseType = '데이터' | '모델' | '연계';
type AlertActionStatus = '관찰' | '조치 필요' | '조치 완료';

interface StageMetric {
  label: string;
  value: string;
  target: string;
  signal: SignalStatus;
  note: string;
}

interface StageQualitySection {
  id: StageId;
  name: string;
  title: string;
  responsibility: string;
  status: StageStatus;
  kpiLinks: string[];
  metrics: StageMetric[];
}

interface QualityAlertRow {
  id: string;
  occurredAt: string;
  stage: StageId;
  causeType: AlertCauseType;
  impactKpi: string;
  status: AlertActionStatus;
}

const STAGE_SECTIONS: StageQualitySection[] = [
  {
    id: 'stage1',
    name: 'Stage1',
    title: '입력 데이터 & 신호 품질',
    responsibility: '데이터 수집/정합 책임',
    status: 'caution',
    kpiLinks: ['신호품질', '데이터 준비도'],
    metrics: [
      {
        label: '필수 필드 충족률',
        value: '96.8%',
        target: '목표 97% 이상',
        signal: 'watch',
        note: '경기도/부산에서 선택 필드 누락 반복',
      },
      {
        label: '지연/결측 발생률',
        value: '4.9%',
        target: '목표 3% 이하',
        signal: 'risk',
        note: '24시간 초과 입력 비중 상승',
      },
      {
        label: '분포 이탈 여부',
        value: '2개 변수 이탈',
        target: '0개 유지',
        signal: 'watch',
        note: '고령 단독가구 비율 입력 분포 이동',
      },
    ],
  },
  {
    id: 'stage2',
    name: 'Stage2',
    title: 'ANN 입력/출력 안정성',
    responsibility: '특징 생성/추론 파이프라인 책임',
    status: 'warning',
    kpiLinks: ['병목', '데이터 준비도'],
    metrics: [
      {
        label: 'Feature 벡터 분포 안정성',
        value: 'JS Divergence 0.11',
        target: '기준 0.10 이하',
        signal: 'risk',
        note: '최근 7일 연속 기준 상회',
      },
      {
        label: 'Class 편향 지표',
        value: '최대 편향 6.3%p',
        target: '기준 5.0%p 이하',
        signal: 'watch',
        note: 'L2 경계 구간 과소 분류 경향',
      },
      {
        label: 'Confidence 분산 추이',
        value: '+17%',
        target: '변동률 ±10% 이내',
        signal: 'risk',
        note: '예측 점수 일관성 저하',
      },
    ],
  },
  {
    id: 'stage3',
    name: 'Stage3',
    title: 'CNN 입력/출력 안정성',
    responsibility: '고위험 추론/보호장치 책임',
    status: 'caution',
    kpiLinks: ['거버넌스', '데이터 품질'],
    metrics: [
      {
        label: '임베딩 분포 변화',
        value: 'Drift Score 0.21',
        target: '기준 0.20 이하',
        signal: 'watch',
        note: '신규 케이스군 유입으로 분포 확장',
      },
      {
        label: 'Class 불확실성 증가 여부',
        value: '엔트로피 +0.08',
        target: '기준 +0.05 이하',
        signal: 'watch',
        note: '불확실 케이스 재검토 필요',
      },
      {
        label: 'Guardrail Flag 발생률',
        value: '2.2%',
        target: '기준 2.0% 이하',
        signal: 'risk',
        note: '민감군 fallback 경로 호출 증가',
      },
    ],
  },
];

const QUALITY_ALERT_ROWS: QualityAlertRow[] = [
  {
    id: 'qa-stage1-20260211',
    occurredAt: '2026-02-11 08:55',
    stage: 'stage1',
    causeType: '데이터',
    impactKpi: '데이터 준비도',
    status: '조치 필요',
  },
  {
    id: 'qa-stage2-20260211',
    occurredAt: '2026-02-11 10:20',
    stage: 'stage2',
    causeType: '모델',
    impactKpi: '병목',
    status: '조치 필요',
  },
  {
    id: 'qa-stage3-20260210',
    occurredAt: '2026-02-10 16:40',
    stage: 'stage3',
    causeType: '모델',
    impactKpi: '거버넌스',
    status: '관찰',
  },
  {
    id: 'qa-link-20260210',
    occurredAt: '2026-02-10 11:05',
    stage: 'stage2',
    causeType: '연계',
    impactKpi: '데이터 준비도',
    status: '관찰',
  },
  {
    id: 'qa-stage1-20260209',
    occurredAt: '2026-02-09 09:30',
    stage: 'stage1',
    causeType: '데이터',
    impactKpi: '신호품질',
    status: '조치 완료',
  },
];

const STAGE_STATUS_STYLE: Record<StageStatus, string> = {
  normal: 'bg-green-100 text-green-700',
  caution: 'bg-amber-100 text-amber-700',
  warning: 'bg-red-100 text-red-700',
};

const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  normal: '정상',
  caution: '주의',
  warning: '경고',
};

const METRIC_SIGNAL_STYLE: Record<SignalStatus, string> = {
  good: 'bg-green-50 text-green-700 border-green-200',
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
  risk: 'bg-red-50 text-red-700 border-red-200',
};

const ALERT_STATUS_STYLE: Record<AlertActionStatus, string> = {
  관찰: 'bg-blue-50 text-blue-700 border-blue-200',
  '조치 필요': 'bg-red-50 text-red-700 border-red-200',
  '조치 완료': 'bg-green-50 text-green-700 border-green-200',
};

const ALERT_CAUSE_STYLE: Record<AlertCauseType, string> = {
  데이터: 'bg-sky-50 text-sky-700 border-sky-200',
  모델: 'bg-violet-50 text-violet-700 border-violet-200',
  연계: 'bg-orange-50 text-orange-700 border-orange-200',
};

function mapDriverToStage(driver?: TabContext['driver']): StageId {
  if (driver === 'data_quality') return 'stage1';
  if (driver === 'model_fitness') return 'stage3';
  return 'stage2';
}

function stageDisplay(stage: StageId): string {
  if (stage === 'stage1') return 'Stage1';
  if (stage === 'stage2') return 'Stage2';
  return 'Stage3';
}

export function QualityMonitoring({ context, onNavigate }: QualityMonitoringProps) {
  const initialStage = useMemo(() => mapDriverToStage(context?.driver), [context?.driver]);
  const [openedStages, setOpenedStages] = useState<StageId[]>([initialStage]);

  const overallDataReadiness = 95.1;
  const activeAlerts = QUALITY_ALERT_ROWS.filter((row) => row.status !== '조치 완료').length;
  const issueByCause = useMemo(
    () =>
      QUALITY_ALERT_ROWS.reduce(
        (acc, row) => {
          if (row.status !== '조치 완료') acc[row.causeType] += 1;
          return acc;
        },
        { 데이터: 0, 모델: 0, 연계: 0 } as Record<AlertCauseType, number>,
      ),
    [],
  );

  const stageStatusMap = useMemo(() => {
    return STAGE_SECTIONS.reduce(
      (acc, stage) => {
        acc[stage.id] = stage.status;
        return acc;
      },
      {} as Record<StageId, StageStatus>,
    );
  }, []);

  const toggleStage = (stageId: StageId) => {
    setOpenedStages((prev) =>
      prev.includes(stageId) ? prev.filter((id) => id !== stageId) : [...prev, stageId],
    );
  };

  void onNavigate;

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">데이터 & 모델 품질</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Stage별 품질 책임을 분리해 데이터 문제/모델 문제/연계 문제를 즉시 구분합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {[
          {
            label: '전체 데이터 준비도',
            value: `${overallDataReadiness.toFixed(1)}%`,
            sub: '전국 평균',
            icon: <Database className="h-5 w-5" />,
            color: overallDataReadiness >= 96 ? 'text-green-600' : 'text-amber-600',
            bg: overallDataReadiness >= 96 ? 'bg-green-50' : 'bg-amber-50',
          },
          {
            label: 'Stage1 안정성',
            value: STAGE_STATUS_LABEL[stageStatusMap.stage1],
            sub: '입력 데이터 & 신호',
            icon: <Workflow className="h-5 w-5" />,
            color:
              stageStatusMap.stage1 === 'warning'
                ? 'text-red-600'
                : stageStatusMap.stage1 === 'caution'
                  ? 'text-amber-600'
                  : 'text-green-600',
            bg:
              stageStatusMap.stage1 === 'warning'
                ? 'bg-red-50'
                : stageStatusMap.stage1 === 'caution'
                  ? 'bg-amber-50'
                  : 'bg-green-50',
          },
          {
            label: 'Stage2 안정성',
            value: STAGE_STATUS_LABEL[stageStatusMap.stage2],
            sub: 'ANN 입력/출력',
            icon: <Brain className="h-5 w-5" />,
            color:
              stageStatusMap.stage2 === 'warning'
                ? 'text-red-600'
                : stageStatusMap.stage2 === 'caution'
                  ? 'text-amber-600'
                  : 'text-green-600',
            bg:
              stageStatusMap.stage2 === 'warning'
                ? 'bg-red-50'
                : stageStatusMap.stage2 === 'caution'
                  ? 'bg-amber-50'
                  : 'bg-green-50',
          },
          {
            label: 'Stage3 안정성',
            value: STAGE_STATUS_LABEL[stageStatusMap.stage3],
            sub: 'CNN 입력/출력',
            icon: <ShieldCheck className="h-5 w-5" />,
            color:
              stageStatusMap.stage3 === 'warning'
                ? 'text-red-600'
                : stageStatusMap.stage3 === 'caution'
                  ? 'text-amber-600'
                  : 'text-green-600',
            bg:
              stageStatusMap.stage3 === 'warning'
                ? 'bg-red-50'
                : stageStatusMap.stage3 === 'caution'
                  ? 'bg-amber-50'
                  : 'bg-green-50',
          },
          {
            label: '활성 품질 경보',
            value: `${activeAlerts}건`,
            sub: '조치 완료 제외',
            icon: <AlertTriangle className="h-5 w-5" />,
            color: activeAlerts > 2 ? 'text-red-600' : 'text-amber-600',
            bg: activeAlerts > 2 ? 'bg-red-50' : 'bg-amber-50',
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-slate-600" />
            5초 분류 가이드
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium bg-sky-50 text-sky-700 border-sky-200">
              데이터 원인 {issueByCause.데이터}건
            </span>
            <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium bg-violet-50 text-violet-700 border-violet-200">
              모델 원인 {issueByCause.모델}건
            </span>
            <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium bg-orange-50 text-orange-700 border-orange-200">
              연계 원인 {issueByCause.연계}건
            </span>
            <span className="text-xs text-gray-500">
              경고 Stage: {STAGE_SECTIONS.filter((stage) => stage.status === 'warning').map((stage) => stage.name).join(', ') || '없음'}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {STAGE_SECTIONS.map((stage) => {
          const isOpen = openedStages.includes(stage.id);
          return (
            <Card key={stage.id} className="border border-slate-200 overflow-hidden gap-0">
              <button
                type="button"
                onClick={() => toggleStage(stage.id)}
                className="w-full px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-800 min-w-16">{stage.name}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{stage.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stage.responsibility}</p>
                  </div>
                  <span
                    className={`ml-auto inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${STAGE_STATUS_STYLE[stage.status]}`}
                  >
                    {STAGE_STATUS_LABEL[stage.status]}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>

              {isOpen && (
                <CardContent className="pt-1 pb-5 px-5 space-y-4 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-500">KPI 연결</span>
                    {stage.kpiLinks.map((kpi) => (
                      <span
                        key={kpi}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        {kpi}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {stage.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs text-slate-500">{metric.label}</p>
                        <p className="text-lg font-semibold text-gray-900 mt-1">{metric.value}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] text-slate-500">{metric.target}</span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${METRIC_SIGNAL_STYLE[metric.signal]}`}
                          >
                            {metric.signal === 'risk' ? '위험' : metric.signal === 'watch' ? '주의' : '정상'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2">{metric.note}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            품질 경보
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">발생일</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">Stage</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">원인 유형</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">영향 KPI</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-600">상태</th>
                </tr>
              </thead>
              <tbody>
                {QUALITY_ALERT_ROWS.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-3 text-sm text-gray-700">{row.occurredAt}</td>
                    <td className="py-3 px-3">
                      <span className="text-sm font-medium text-gray-900">{stageDisplay(row.stage)}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${ALERT_CAUSE_STYLE[row.causeType]}`}
                      >
                        {row.causeType}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-700">{row.impactKpi}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${ALERT_STATUS_STYLE[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {QUALITY_ALERT_ROWS.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                      활성 품질 경보가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-[11px] text-gray-500">
            상태 기준: 관찰(추세 모니터링), 조치 필요(운영/모델 개입 필요), 조치 완료(후속 검증 대기)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
