/* ═══════════════════════════════════════════════════════════════════════════
   중앙관리센터 전국운영대시보드 — KPI 테마 & 타입 정의
   ═══════════════════════════════════════════════════════════════════════════
   5개 KPI에 대한 색상 토큰, 라벨, 설명, 포맷터, 차트 구성을 상수로 관리한다.
   모든 패널(상단 KPI 버튼, 지도, 좌측 요약, 우측 분석, 하단 추이)이
   이 상수를 참조하여 "선택 KPI 중심 Single Source of Truth"를 구현한다.
═══════════════════════════════════════════════════════════════════════════ */

/* ─── KPI 키 리터럴 유니온 ─── */
export type CentralKpiKey =
  | "signalQuality"
  | "policyImpact"
  | "bottleneckRisk"
  | "dataReadiness"
  | "governanceSafety";

export const CENTRAL_KPI_KEYS: CentralKpiKey[] = [
  "signalQuality",
  "policyImpact",
  "bottleneckRisk",
  "dataReadiness",
  "governanceSafety",
];

/* ─── 값 포맷터 ─── */
const fmtPct  = (v: number) => `${v.toFixed(1)}%`;
const fmtScore = (v: number) => v.toFixed(1);

/* ─── KPI 테마 인터페이스 ─── */
export interface CentralKpiTheme {
  key: CentralKpiKey;
  label: string;
  shortLabel: string;
  unit: "%" | "점";
  description: string;
  /** Tooltip: 3줄 고정 포맷 */
  tooltipLines: [string, string, string];
  /** 버튼 · ring · 범례에 사용하는 primary 색상 */
  primaryColor: string;
  /** 버튼 배경/선택 시 사용하는 soft 배경 */
  softBg: string;
  /** 지도/차트 색상 스케일(7단계) */
  palette: string[];
  /** 값 포맷터 */
  valueFormatter: (v: number) => string;
  /** 목표값(있으면) */
  target?: number;
  /** 임계 경고 기준 (이 값 이하이면 warn 또는 risk) */
  warnBelow?: number;
  riskBelow?: number;
  /** 높을수록 위험한 지표인지 (bottleneckRisk 등) */
  higherIsWorse?: boolean;
}

/* ─── KPI 테마 상수 ─── */
export const KPI_THEMES: Record<CentralKpiKey, CentralKpiTheme> = {
  signalQuality: {
    key: "signalQuality",
    label: "신호 품질",
    shortLabel: "신호품질",
    unit: "%",
    description: "유효 신호 비율: 행정적으로 활용 가능한 신호의 비율",
    tooltipLines: [
      "지표 의미: 전체 신호 중 유효하게 활용된 비율",
      "집계 스코프: 전국(중앙) · 최근 7일 누적",
      "포함: 유효 신호 / 제외: 중복·철회·무효",
    ],
    primaryColor: "#2563eb",
    softBg: "#dbeafe",
    palette: ["#eff6ff", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"],
    valueFormatter: fmtPct,
    target: 95,
    warnBelow: 90,
    riskBelow: 85,
  },
  policyImpact: {
    key: "policyImpact",
    label: "정책 영향",
    shortLabel: "정책영향",
    unit: "점",
    description: "정책/규칙 변경 후 KPI 변동지수(정규화 스코어 0-100)",
    tooltipLines: [
      "지표 의미: 최근 정책 변경이 현장 흐름에 미친 변동 수준",
      "집계 스코프: 전국(중앙) · 최근 7일 정책 이벤트 기준",
      "포함: 규칙 변경/롤백 영향 / 제외: 정기 일괄 갱신",
    ],
    primaryColor: "#7c3aed",
    softBg: "#ede9fe",
    palette: ["#faf5ff", "#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7", "#7c3aed", "#6d28d9"],
    valueFormatter: fmtScore,
    higherIsWorse: true,
  },
  bottleneckRisk: {
    key: "bottleneckRisk",
    label: "병목 위험",
    shortLabel: "병목위험",
    unit: "점",
    description: "SLA 위반·적체·재접촉 필요의 가중합 (0-100 스케일)",
    tooltipLines: [
      "지표 의미: 지연·적체 구조적 위험 수준 (0=안전, 100=위험)",
      "집계 스코프: 전국(중앙) · 최근 7일 누적",
      "포함: SLA 위반 + L2 적체 + 재접촉 필요 / 가중합",
    ],
    primaryColor: "#dc2626",
    softBg: "#fee2e2",
    palette: ["#fef2f2", "#fecaca", "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c"],
    valueFormatter: fmtScore,
    higherIsWorse: true,
    warnBelow: undefined, // higherIsWorse이므로 warnAbove 개념
  },
  dataReadiness: {
    key: "dataReadiness",
    label: "데이터 준비도",
    shortLabel: "데이터준비",
    unit: "%",
    description: "데이터 기준 충족 케이스 비율",
    tooltipLines: [
      "지표 의미: 필수 데이터 기준을 충족하는 케이스 비율",
      "집계 스코프: 전국(중앙) · 최근 7일 누적",
      "포함: 필수 필드 충족 / 제외: 연계 미완료·결측",
    ],
    primaryColor: "#059669",
    softBg: "#d1fae5",
    palette: ["#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#059669", "#047857"],
    valueFormatter: fmtPct,
    target: 95,
    warnBelow: 90,
    riskBelow: 85,
  },
  governanceSafety: {
    key: "governanceSafety",
    label: "거버넌스 안전",
    shortLabel: "거버넌스",
    unit: "%",
    description: "필수 로그/근거 누락 없는 케이스 비율",
    tooltipLines: [
      "지표 의미: 감사·민원 대응 시 필수 근거가 확보된 비율",
      "집계 스코프: 전국(중앙) · 최근 30일 누적",
      "포함: 필수 로그·설명근거·책임자 기록 완비 / 제외: 테스트 케이스",
    ],
    primaryColor: "#d97706",
    softBg: "#fef3c7",
    palette: ["#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#d97706", "#b45309"],
    valueFormatter: fmtPct,
    target: 98,
    warnBelow: 95,
    riskBelow: 90,
  },
};

/* ─── 유틸 함수 ─── */
export function getCentralKpiTheme(key: CentralKpiKey): CentralKpiTheme {
  return KPI_THEMES[key];
}

export function getCentralKpiLabel(key: CentralKpiKey): string {
  return KPI_THEMES[key]?.label ?? key;
}

export function getCentralKpiColor(key: CentralKpiKey): string {
  return KPI_THEMES[key]?.primaryColor ?? "#2563eb";
}

export function getCentralKpiPalette(key: CentralKpiKey): string[] {
  return KPI_THEMES[key]?.palette ?? KPI_THEMES.signalQuality.palette;
}

/** KPI 값의 상태 판정 (higher-is-worse 지표는 반대로 동작) */
export function getCentralKpiStatus(
  key: CentralKpiKey,
  value: number
): "good" | "warn" | "risk" {
  const t = KPI_THEMES[key];
  if (t.higherIsWorse) {
    // bottleneckRisk, policyImpact: 높을수록 위험
    if (value >= 70) return "risk";
    if (value >= 40) return "warn";
    return "good";
  }
  // 낮을수록 위험 (signalQuality, dataReadiness, governanceSafety)
  if (t.riskBelow != null && value < t.riskBelow) return "risk";
  if (t.warnBelow != null && value < t.warnBelow) return "warn";
  return "good";
}

/* ─── 전국 요약 데이터 계약 ─── */
export interface CentralKpiSummary {
  key: CentralKpiKey;
  value: number;
  delta: number; // 전주 대비 pp
  /** 보조값(KPI별 다름) */
  sub1Label: string;
  sub1Value: string;
  sub2Label: string;
  sub2Value: string;
}

export interface CentralRegionMetric {
  regionCode: string;
  regionName: string;
  value: number;
  extra?: Record<string, number>;
}

/* ─── KPI별 차트 데이터 계약 ─── */
export interface CentralKpiChartData {
  /** 우측 상단: KPI 요약 텍스트 */
  definitionLine: string;
  lastUpdated: string;
  /** 우측 메인: 핵심 분해 차트 */
  decomposition: { name: string; value: number; color?: string }[];
  decompositionType: "stackedBar" | "donut" | "timeline";
  /** 우측 하단: 원인 기여도/분포 차트 */
  causeDistribution: { name: string; value: number; color?: string }[];
  causeType: "bar" | "donut" | "heatBar" | "lineRank";
  /** 하단 추이 */
  trend: { period: string; value: number; delta: number }[];
}

/* ─── 전체 대시보드 데이터 번들 ─── */
export interface CentralDashboardData {
  kpiSummaries: CentralKpiSummary[];
  regionMetrics: Record<CentralKpiKey, CentralRegionMetric[]>;
  chartData: Record<CentralKpiKey, CentralKpiChartData>;
}
