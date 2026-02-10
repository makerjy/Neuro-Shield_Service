/**
 * useTabContext – 탭 간 컨텍스트 공유 시스템
 *
 * 모든 탭이 동일한 level/region/kpi/period/changeId/auditId/driver를 공유.
 * CentralCenterApp의 state를 통해 관리되며,
 * 메인에서 "자세히 보기" 클릭 시 컨텍스트가 유지된 채 탭 이동.
 */

export type DrillLevel = 'nation' | 'province' | 'city';
export type PeriodType = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR_CUM';
export type DriverKey = 'ops_bottleneck' | 'data_quality' | 'contact_strategy' | 'model_fitness';

export interface TabContext {
  level: DrillLevel;
  region: string;            // 'KR' or region code
  kpi: string;               // KPI key
  period: PeriodType;
  changeId?: string;         // 정책변경 이벤트 ID
  auditId?: string;          // 감사 이벤트 ID
  driver?: DriverKey;        // Driver 분석 키
}

export const DEFAULT_TAB_CONTEXT: TabContext = {
  level: 'nation',
  region: 'KR',
  kpi: 'SLA',
  period: 'WEEK',
};

/** 네비게이션 헬퍼: 탭으로 이동하면서 컨텍스트 파라미터 전달 */
export function buildNavAction(
  targetPage: string,
  contextOverrides: Partial<TabContext> = {},
) {
  return { targetPage, contextOverrides };
}

/** 탭 이동 시 컨텍스트 머지 */
export function mergeContext(
  current: TabContext,
  overrides: Partial<TabContext>,
): TabContext {
  return { ...current, ...overrides };
}
