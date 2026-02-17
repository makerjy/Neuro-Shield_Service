export type MetricHelpKey =
  | 'slaRisk'
  | 'unprocessedWork'
  | 'examDelay'
  | 'followupDelay'
  | 'conversionGap'
  | 'top5Share'
  | 'insightHeadline';

export type MetricActionTab = 'ops' | 'bottleneck' | 'actions' | 'reports' | 'settings';

export type MetricHelp = {
  definition: string;
  scope: string;
  period: string;
  threshold: string;
  interpretation: string;
  nextAction: string;
  actionTab: MetricActionTab;
};

type MetricHelpContext = {
  scopeLabel: string;
  rangeLabel: string;
  longWaitDays: number;
};

export function getMetricHelp(
  key: MetricHelpKey,
  ctx: MetricHelpContext,
): MetricHelp {
  const common = {
    scope: `${ctx.scopeLabel} 기준 집계`,
    period: `${ctx.rangeLabel} 기준`,
  };

  switch (key) {
    case 'slaRisk':
      return {
        definition: '처리 기한을 넘기거나 임박한 구역 수',
        scope: common.scope,
        period: common.period,
        threshold: `기한 ${ctx.longWaitDays}일 초과 시 위험`,
        interpretation: '높을수록 지연 위험이 커짐',
        nextAction: '병목 원인 분석 탭에서 상세 원인 확인',
        actionTab: 'bottleneck',
      };
    case 'unprocessedWork':
      return {
        definition: '아직 처리되지 않고 남아있는 업무 건수',
        scope: common.scope,
        period: `${ctx.rangeLabel} 스냅샷`,
        threshold: `기한 ${ctx.longWaitDays}일 초과 업무 우선`,
        interpretation: '증가 시 인력 또는 처리 경로 병목 가능성',
        nextAction: '개입/조치 관리 탭에서 배치 조정',
        actionTab: 'actions',
      };
    case 'examDelay':
      return {
        definition: '검사 연결에 걸리는 평균 대기 일수',
        scope: common.scope,
        period: common.period,
        threshold: `지연 임계 ${ctx.longWaitDays}일`,
        interpretation: '높을수록 병목이 커짐',
        nextAction: '병목 원인 분석 탭에서 구간별 지연 확인',
        actionTab: 'bottleneck',
      };
    case 'followupDelay':
      return {
        definition: '후속 연락이 늦어지는 업무 건수',
        scope: common.scope,
        period: common.period,
        threshold: `기한 ${ctx.longWaitDays}일 초과 후속 연락 우선`,
        interpretation: '높을수록 재접촉 운영 강화 필요',
        nextAction: '개입/조치 관리 탭에서 자동화 확대',
        actionTab: 'actions',
      };
    case 'conversionGap':
      return {
        definition: '지역 간 전환 성과 차이(최고-최저)',
        scope: common.scope,
        period: common.period,
        threshold: '격차가 클수록 균형 지원 필요',
        interpretation: '높을수록 지역별 운영 편차가 큼',
        nextAction: '보고서 탭에서 격차 추이 공유',
        actionTab: 'reports',
      };
    case 'top5Share':
      return {
        definition: '상위 5개 구역이 차지하는 전체 비중',
        scope: common.scope,
        period: common.period,
        threshold: '집중도가 높을수록 상위 구역 우선 개입 효과 큼',
        interpretation: '집중 개입 대상 여부를 판단하는 기준',
        nextAction: '개입/조치 관리 탭에서 우선 작업 생성',
        actionTab: 'actions',
      };
    case 'insightHeadline':
    default:
      return {
        definition: '현재 레이어·기간·스코프를 한 줄로 요약한 운영 결론',
        scope: common.scope,
        period: common.period,
        threshold: `기한 ${ctx.longWaitDays}일 기준 반영`,
        interpretation: '이번 주 우선 개입 구역을 빠르게 확인',
        nextAction: '병목 원인 분석 탭으로 이동해 상세 확인',
        actionTab: 'bottleneck',
      };
  }
}

