import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import {
  AlertTriangle,
  ArrowRightLeft,
  Brain,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  Info,
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
type Severity = 'ok' | 'warn' | 'risk';

interface KpiExplain {
  key: string;
  title: string;
  subtitlePlain: string;
  whyItMatters: string;
  interpretTemplate: {
    ok: string;
    warn: string;
    risk: string;
  };
  actionHint: {
    ok: string;
    warn: string;
    risk: string;
  };
  targetLine: string;
  terms?: string[];
}

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

interface InspectorKpiDetail {
  stage: StageQualitySection;
  metric: StageMetric;
  explain: KpiExplain;
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

const HOVER_BASE_DATE = '2026-02-12';

const SIGNAL_TO_SEVERITY: Record<SignalStatus, Severity> = {
  good: 'ok',
  watch: 'warn',
  risk: 'risk',
};

const SEVERITY_BADGE: Record<Severity, { label: string; className: string }> = {
  ok: { label: '정상 범위', className: 'bg-green-50 text-green-700 border-green-200' },
  warn: { label: '주의 범위', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  risk: { label: '위험 범위', className: 'bg-red-50 text-red-700 border-red-200' },
};

const KPI_EXPLAIN_MAP: Record<string, KpiExplain> = {
  '필수 필드 충족률': {
    key: 'stage1-required-fields',
    title: '필수 필드 충족률',
    subtitlePlain: '분석에 꼭 필요한 항목이 빠짐없이 들어왔는지 확인하는 지표입니다.',
    whyItMatters: '필수 값 누락 시 위험도 산출과 케이스 생성의 신뢰도가 낮아질 가능성이 있습니다.',
    interpretTemplate: {
      ok: '필수 항목이 대부분 충족되어 안정적으로 처리될 가능성이 높습니다.',
      warn: '일부 지역/기관에서 누락이 반복될 가능성이 있어 점검이 필요해 보입니다.',
      risk: '누락 비중이 커 결과 해석에 주의가 필요할 가능성이 있습니다.',
    },
    actionHint: {
      ok: '현재 점검 주기를 유지해 주세요.',
      warn: '누락이 반복되는 지역/기관과 항목을 확인해 주세요.',
      risk: '부분 집계 처리 또는 재수집 우선순위 적용을 검토해 주세요.',
    },
    targetLine: '목표 97% 이상',
  },
  '지연/결측 발생률': {
    key: 'stage1-delay-missing-rate',
    title: '지연/결측 발생률',
    subtitlePlain: '데이터가 늦게 들어오거나 비어 있는 경우의 비율을 보여줍니다.',
    whyItMatters: '배치 집계가 늦어지거나 일부 결과가 반영되지 않을 가능성이 있습니다.',
    interpretTemplate: {
      ok: '수신 지연이 크지 않아 일일 집계 영향이 제한적일 가능성이 있습니다.',
      warn: '지연이 늘어나는 추세로 반영 시점 확인이 필요해 보입니다.',
      risk: '24시간 초과 비중이 높아 일일 결과가 부분 반영될 가능성이 있습니다.',
    },
    actionHint: {
      ok: '현재 수신 모니터링 기준을 유지해 주세요.',
      warn: '지연이 집중되는 시간대/기관을 우선 확인해 주세요.',
      risk: '전송·연계 장애 여부를 먼저 점검해 주세요.',
    },
    targetLine: '목표 3% 이하',
  },
  '분포 이탈 여부': {
    key: 'stage1-distribution-drift',
    title: '분포 이탈 여부',
    subtitlePlain: '최근 데이터 특성이 평소와 달라졌는지 확인하는 지표입니다.',
    whyItMatters: '입력 특성 변화가 크면 모델 결과의 일관성이 흔들릴 가능성이 있습니다.',
    interpretTemplate: {
      ok: '입력 분포가 기준 범위에서 비교적 안정적으로 유지되는 편입니다.',
      warn: '일부 변수에서 변화가 감지되어 추세 확인이 필요해 보입니다.',
      risk: '변화 폭이 커 원인 점검이 필요할 가능성이 있습니다.',
    },
    actionHint: {
      ok: '현재 모니터링 기준을 유지해 주세요.',
      warn: '변화 폭이 큰 변수를 우선 확인해 주세요.',
      risk: '수집 방식·정책 변경·신규 유입군 여부를 점검해 주세요.',
    },
    targetLine: '0개 유지',
  },
  'Feature 벡터 분포 안정성': {
    key: 'stage2-feature-jsd',
    title: 'Feature 벡터 분포 안정성 (JS Divergence)',
    subtitlePlain: '모델 입력 특징이 평소와 얼마나 달라졌는지 보여주는 값입니다.',
    whyItMatters: '입력 분포가 달라지면 예측 일관성이 낮아질 가능성이 있습니다.',
    interpretTemplate: {
      ok: '입력 특징이 기준 범위 안에서 유지되는 편으로 보입니다.',
      warn: '기준에 근접하거나 일부 기간 초과해 추세 확인이 필요해 보입니다.',
      risk: '기준 초과가 지속되어 입력 변화가 큰 상태일 가능성이 있습니다.',
    },
    actionHint: {
      ok: '정기 모니터링을 유지해 주세요.',
      warn: '최근 변경된 데이터 소스/전처리 여부를 확인해 주세요.',
      risk: '피처 생성 파이프라인 변경·장애 여부를 우선 점검해 주세요.',
    },
    targetLine: '기준 0.10 이하',
    terms: ['JS Divergence: 두 분포 차이값(0에 가까울수록 유사)'],
  },
  'Class 편향 지표': {
    key: 'stage2-class-bias',
    title: 'Class 편향 지표',
    subtitlePlain: '특정 결과가 과도하게 많거나 적게 나오는 쏠림 여부를 봅니다.',
    whyItMatters: '쏠림이 커지면 특정 집단의 과소/과다 분류 가능성이 있습니다.',
    interpretTemplate: {
      ok: '큰 쏠림 없이 비교적 균형적으로 산출되는 편으로 보입니다.',
      warn: '일부 구간에서 쏠림이 커질 수 있어 점검이 필요해 보입니다.',
      risk: '쏠림이 커 결과 해석 시 주의가 필요할 가능성이 있습니다.',
    },
    actionHint: {
      ok: '현 모니터링 기준을 유지해 주세요.',
      warn: '경계 구간/특정 지역 편향 확대 여부를 확인해 주세요.',
      risk: '입력 변화 또는 임계값 정책 점검을 권장합니다.',
    },
    targetLine: '기준 5.0%p 이하',
  },
  'Confidence 분산 추이': {
    key: 'stage2-confidence-variance',
    title: 'Confidence 분산 추이',
    subtitlePlain: '모델의 확신 정도가 평소보다 흔들리는지 확인하는 지표입니다.',
    whyItMatters: '확신이 불안정하면 재검토 대상이 늘어 운영 부담이 커질 가능성이 있습니다.',
    interpretTemplate: {
      ok: '예측 점수가 비교적 안정적으로 유지되는 편으로 보입니다.',
      warn: '변동이 커져 원인 확인이 필요해 보입니다.',
      risk: '변동이 크게 증가해 일관성 저하 가능성이 있습니다.',
    },
    actionHint: {
      ok: '현재 모니터링을 유지해 주세요.',
      warn: '입력 누락·분포 변화 여부를 함께 확인해 주세요.',
      risk: '피처 생성/모델 버전/연계 지연 영향을 점검해 주세요.',
    },
    targetLine: '변동률 ±10% 이내',
  },
  '임베딩 분포 변화': {
    key: 'stage3-embedding-drift',
    title: '임베딩 분포 변화 (Drift Score)',
    subtitlePlain: '모델 내부 표현이 평소와 얼마나 달라졌는지 보여주는 값입니다.',
    whyItMatters: '신규 유형 유입 시 결과 분포 변화가 커질 가능성이 있습니다.',
    interpretTemplate: {
      ok: '분포 변화가 기준 범위 내로 유지되는 편으로 보입니다.',
      warn: '변화가 감지되어 추세 확인이 필요해 보입니다.',
      risk: '변화가 커 원인 점검이 필요할 가능성이 있습니다.',
    },
    actionHint: {
      ok: '현재 모니터링 체계를 유지해 주세요.',
      warn: '최근 유입군(연령/검사유형) 변화를 확인해 주세요.',
      risk: '데이터 소스/전처리 변경 여부를 우선 점검해 주세요.',
    },
    targetLine: '기준 0.20 이하',
  },
  'Class 불확실성 증가 여부': {
    key: 'stage3-entropy-shift',
    title: 'Class 불확실성 증가 여부 (엔트로피)',
    subtitlePlain: '모델이 판단하기 애매한 케이스가 늘었는지 확인하는 지표입니다.',
    whyItMatters: '불확실성이 증가하면 재검토 및 추적 우선순위 조정이 필요할 수 있습니다.',
    interpretTemplate: {
      ok: '불확실성이 기준 범위 내로 유지되는 편으로 보입니다.',
      warn: '불확실성이 늘어 재검토 비중 점검이 필요해 보입니다.',
      risk: '불확실성이 높아 후속 검토 경로 점검이 필요할 가능성이 있습니다.',
    },
    actionHint: {
      ok: '현재 운영 기준을 유지해 주세요.',
      warn: '불확실 케이스의 공통 특성을 확인해 주세요.',
      risk: '재검/전문가 확인 경로 비중 점검을 권장합니다.',
    },
    targetLine: '기준 +0.05 이하',
    terms: ['엔트로피: 예측 불확실성 값(높을수록 애매함)'],
  },
  'Guardrail Flag 발생률': {
    key: 'stage3-guardrail-rate',
    title: 'Guardrail Flag 발생률',
    subtitlePlain: '보호장치(안전 규칙)가 개입한 비율을 보여주는 지표입니다.',
    whyItMatters: '민감군/예외 케이스에서 안전 경로 전환 빈도를 점검할 수 있습니다.',
    interpretTemplate: {
      ok: '보호장치 개입이 기준 범위 내로 유지되는 편으로 보입니다.',
      warn: '개입이 늘어 추세 확인이 필요해 보입니다.',
      risk: 'fallback 경로 호출이 증가했을 가능성이 있어 점검이 필요합니다.',
    },
    actionHint: {
      ok: '현재 기준을 유지해 주세요.',
      warn: '개입이 늘어난 조건과 구간을 확인해 주세요.',
      risk: '민감군 유입/연계 품질/모델 불확실성 증가 여부를 점검해 주세요.',
    },
    targetLine: '기준 2.0% 이하',
  },
};

function useIsTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setIsTouchDevice(media.matches || navigator.maxTouchPoints > 0);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return isTouchDevice;
}

function getKpiExplain(metric: StageMetric): KpiExplain {
  return (
    KPI_EXPLAIN_MAP[metric.label] ?? {
      key: metric.label,
      title: metric.label,
      subtitlePlain: '이 지표는 현재 운영 상태를 확인하기 위한 품질 점검 지표입니다.',
      whyItMatters: '기준값을 벗어날 경우 일부 결과 해석에 주의가 필요할 수 있습니다.',
      interpretTemplate: {
        ok: '기준 범위 내로 유지되는 편으로 보입니다.',
        warn: '기준 경계에 근접해 추세 확인이 필요해 보입니다.',
        risk: '기준 초과 구간이 있어 원인 점검이 필요할 가능성이 있습니다.',
      },
      actionHint: {
        ok: '정기 모니터링을 유지해 주세요.',
        warn: '최근 변동 구간을 확인해 주세요.',
        risk: '관련 데이터 소스와 연계 상태를 점검해 주세요.',
      },
      targetLine: metric.target,
    }
  );
}

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

function interpretationBySeverity(explain: KpiExplain, severity: Severity): string {
  if (severity === 'risk') return explain.interpretTemplate.risk;
  if (severity === 'warn') return explain.interpretTemplate.warn;
  return explain.interpretTemplate.ok;
}

function actionBySeverity(explain: KpiExplain, severity: Severity): string {
  if (severity === 'risk') return explain.actionHint.risk;
  if (severity === 'warn') return explain.actionHint.warn;
  return explain.actionHint.ok;
}

function trendBySeverity(severity: Severity): string {
  if (severity === 'risk') return '최근 7일 동안 기준 초과 구간이 반복되어 점검 우선순위가 높아 보입니다.';
  if (severity === 'warn') return '최근 7일 중 일부 기간에서 기준 경계에 근접한 변동이 관찰되었습니다.';
  return '최근 7일 기준 범위 내에서 큰 변동 없이 유지되는 편입니다.';
}

function MetricHelpContent({
  stage,
  metric,
  explain,
  severity,
  onOpenDetail,
}: {
  stage: StageQualitySection;
  metric: StageMetric;
  explain: KpiExplain;
  severity: Severity;
  onOpenDetail: () => void;
}) {
  const badgeMeta = SEVERITY_BADGE[severity];

  return (
    <div className="w-[min(92vw,460px)] max-w-[460px] rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-[1.35] shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-500">{stage.name}</p>
          <p className="truncate text-slate-800 font-semibold">{explain.title}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${badgeMeta.className}`}
        >
          {badgeMeta.label}
        </span>
      </div>
      <p className="mt-1 truncate text-slate-600">뜻: {explain.subtitlePlain}</p>
      <p className="mt-1 truncate text-slate-600">현재 상태: {badgeMeta.label} · {metric.value}</p>
      <p className="mt-1 truncate text-slate-600">해석: {interpretationBySeverity(explain, severity)}</p>
      <p className="mt-1 truncate text-slate-600">권장 확인: {actionBySeverity(explain, severity)}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-slate-500">기준: {explain.targetLine || metric.target} · D-1 {HOVER_BASE_DATE}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 shrink-0"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetail();
          }}
        >
          자세히
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function QualityMonitoring({ context, onNavigate }: QualityMonitoringProps) {
  const initialStage = useMemo(() => mapDriverToStage(context?.driver), [context?.driver]);
  const [openedStages, setOpenedStages] = useState<StageId[]>([initialStage]);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorDetail, setInspectorDetail] = useState<InspectorKpiDetail | null>(null);
  const isTouchDevice = useIsTouchDevice();
  const metricRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const metricRefKey = useCallback((stageId: StageId, label: string) => `${stageId}::${label}`, []);

  const handleOpenMetricDetail = useCallback(
    (stage: StageQualitySection, metric: StageMetric) => {
      const explain = getKpiExplain(metric);
      setOpenedStages((prev) => (prev.includes(stage.id) ? prev : [...prev, stage.id]));
      setInspectorDetail({ stage, metric, explain });
      setInspectorOpen(true);

      const refKey = metricRefKey(stage.id, metric.label);
      requestAnimationFrame(() => {
        setTimeout(() => {
          metricRefs.current[refKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      });
    },
    [metricRefKey],
  );

  const selectedSeverity = inspectorDetail ? SIGNAL_TO_SEVERITY[inspectorDetail.metric.signal] : null;
  const relatedAlerts = useMemo(() => {
    if (!inspectorDetail) return [];
    return QUALITY_ALERT_ROWS.filter(
      (row) => row.stage === inspectorDetail.stage.id && row.status !== '조치 완료',
    );
  }, [inspectorDetail]);

  void onNavigate;

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
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
                    {stage.metrics.map((metric) => {
                      const severity = SIGNAL_TO_SEVERITY[metric.signal];
                      const explain = getKpiExplain(metric);
                      const refKey = metricRefKey(stage.id, metric.label);

                      const metricCard = (
                        <div
                          ref={(node) => {
                            metricRefs.current[refKey] = node;
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleOpenMetricDetail(stage, metric);
                            }
                          }}
                          className="relative rounded-lg border border-slate-200 bg-white p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                        >
                          <p className="text-xs text-slate-500 pr-8">{metric.label}</p>
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

                          {isTouchDevice && (
                            <PopoverPrimitive.Root>
                              <PopoverPrimitive.Trigger asChild>
                                <button
                                  type="button"
                                  aria-label={`${metric.label} 안내`}
                                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Info className="h-3 w-3" />
                                </button>
                              </PopoverPrimitive.Trigger>
                              <PopoverPrimitive.Portal>
                                <PopoverPrimitive.Content
                                  side="top"
                                  align="end"
                                  sideOffset={8}
                                  collisionPadding={12}
                                  className="z-50 max-w-[92vw] p-0 border-0 bg-transparent shadow-none"
                                >
                                  <MetricHelpContent
                                    stage={stage}
                                    metric={metric}
                                    explain={explain}
                                    severity={severity}
                                    onOpenDetail={() => handleOpenMetricDetail(stage, metric)}
                                  />
                                </PopoverPrimitive.Content>
                              </PopoverPrimitive.Portal>
                            </PopoverPrimitive.Root>
                          )}
                        </div>
                      );

                      if (isTouchDevice) {
                        return <React.Fragment key={refKey}>{metricCard}</React.Fragment>;
                      }

                      return (
                        <TooltipPrimitive.Root key={refKey} delayDuration={200}>
                          <TooltipPrimitive.Trigger asChild>{metricCard}</TooltipPrimitive.Trigger>
                          <TooltipPrimitive.Portal>
                            <TooltipPrimitive.Content
                              side="top"
                              align="end"
                              sideOffset={8}
                              collisionPadding={12}
                              className="z-50 max-w-[92vw] p-0 border-0 bg-transparent shadow-none"
                            >
                              <MetricHelpContent
                                stage={stage}
                                metric={metric}
                                explain={explain}
                                severity={severity}
                                onOpenDetail={() => handleOpenMetricDetail(stage, metric)}
                              />
                              <TooltipPrimitive.Arrow className="fill-white" />
                            </TooltipPrimitive.Content>
                          </TooltipPrimitive.Portal>
                        </TooltipPrimitive.Root>
                      );
                    })}
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

        <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
          <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
            {inspectorDetail ? (
              <>
                <SheetHeader className="border-b border-slate-200 pb-3">
                  <SheetTitle className="text-base text-slate-900">
                    {inspectorDetail.stage.name} · {inspectorDetail.metric.label}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-slate-500">
                    {inspectorDetail.stage.title} 상세 · 데이터 기준일 {HOVER_BASE_DATE} (D-1)
                  </SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4 text-sm">
                  <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold text-slate-600">최근 7일 추이</p>
                    <p className="mt-1 text-sm text-slate-800">{trendBySeverity(selectedSeverity ?? 'ok')}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      현재 값: {inspectorDetail.metric.value} · {inspectorDetail.explain.targetLine || inspectorDetail.metric.target}
                    </p>
                  </section>

                  <section className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[11px] font-semibold text-slate-600">원인 후보</p>
                    <p className="mt-1 text-sm text-slate-700">{inspectorDetail.metric.note}</p>
                  </section>

                  <section className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[11px] font-semibold text-slate-600">영향 범위</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {inspectorDetail.stage.kpiLinks.map((link) => (
                        <span
                          key={link}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                        >
                          {link}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[11px] font-semibold text-slate-600">관련 경보</p>
                    {relatedAlerts.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {relatedAlerts.slice(0, 4).map((row) => (
                          <li key={row.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                            <p className="text-[11px] text-slate-600">{row.occurredAt}</p>
                            <p className="text-xs text-slate-800">
                              {row.causeType} · {row.impactKpi} · {row.status}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">현재 연결된 활성 경보가 없습니다.</p>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                KPI를 선택하면 상세 정보가 표시됩니다.
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipPrimitive.Provider>
  );
}
