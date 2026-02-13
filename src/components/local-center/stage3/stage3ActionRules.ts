import type {
  ConfidenceLevel,
  RecommendedAction,
  Stage3Case,
  Stage3WorkItem,
  TransitionPrediction,
} from "./stage3Types";

function toYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function buildRecommendedActions(stage3: Stage3Case): Stage3Case["ops"]["recommendedActions"] {
  const actions: Stage3Case["ops"]["recommendedActions"] = [];
  const failStreak = stage3.metrics.contactFailStreak ?? 0;
  const nextCheckpoint = stage3.ops.nextCheckpointAt;
  const probability = stage3.prediction.probability;
  const trend = stage3.prediction.trend ?? [];
  const pDelta = trend.length >= 2 ? trend[trend.length - 1].p - trend[trend.length - 2].p : 0;
  const dataQuality = stage3.metrics.dataQualityPct ?? 0;

  const daysToCheckpoint = nextCheckpoint
    ? Math.ceil(
        (new Date(`${nextCheckpoint}T00:00:00`).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      )
    : undefined;

  if (daysToCheckpoint == null || daysToCheckpoint <= 3) {
    actions.push({
      id: `${stage3.caseId}-a0`,
      priority: 0,
      title: "재평가 일정 생성",
      reasonChips: [
        daysToCheckpoint == null ? "다음 체크포인트 미설정" : `체크포인트 D${daysToCheckpoint >= 0 ? `-${daysToCheckpoint}` : `+${Math.abs(daysToCheckpoint)}`}`,
        `전환위협 추정 ${(probability * 100).toFixed(0)}%`,
      ],
      dueInDays: Math.max(daysToCheckpoint ?? 0, 0),
      actionType: "create_reassessment",
      payloadPreview: {
        proposedDate: toYmd(new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)),
        reason: "운영 기준 재평가 주기 충족",
      },
    });
  }

  if (failStreak >= 3 || probability >= 0.7 || pDelta >= 0.1) {
    actions.push({
      id: `${stage3.caseId}-a1`,
      priority: 0,
      title: "재접촉 시도",
      reasonChips: [
        failStreak >= 3 ? `연속 실패 ${failStreak}회` : `전환위협 추정 ${(probability * 100).toFixed(0)}%`,
        `연락 성공률 ${stage3.metrics.contactSuccessRatePct ?? 0}%`,
      ],
      dueInDays: 0,
      actionType: "retry_contact",
      payloadPreview: {
        preferredSlot: stage3.communication.recommendedTimeSlot ?? "평일 14:00~16:00",
      },
    });
  }

  if ((stage3.risk.zone !== "stable" || probability >= 0.55) && stage3.risk.intensity !== "biweekly") {
    actions.push({
      id: `${stage3.caseId}-a2`,
      priority: 1,
      title: "추적 강도 상향",
      reasonChips: [
        `전환위협 추정 ${(probability * 100).toFixed(0)}%`,
        `현재 추적 강도 ${stage3.risk.intensity}`,
      ],
      dueInDays: 2,
      actionType: "adjust_intensity",
      payloadPreview: {
        targetIntensity: "biweekly",
        reason: "재평가 필요 신호 충족",
      },
    });
  }

  if (stage3.referral.status !== "done" && probability >= 0.6) {
    actions.push({
      id: `${stage3.caseId}-a3`,
      priority: 1,
      title: "연계 진행 강화",
      reasonChips: [
        `연계 상태 ${stage3.referral.status}`,
        `전환위협 추정 ${(probability * 100).toFixed(0)}%`,
      ],
      dueInDays: 5,
      actionType: "strengthen_referral",
      payloadPreview: {
        organization: stage3.referral.organization,
      },
    });
  }

  if (dataQuality < 92 || stage3.prediction.confidence === "LOW") {
    actions.push({
      id: `${stage3.caseId}-a5`,
      priority: 0,
      title: "누락 보완 요청",
      reasonChips: [
        `데이터 품질 ${dataQuality}%`,
        stage3.prediction.confidence === "LOW" ? "누락 영향으로 확실하지 않음" : "누락 보강 필요",
      ],
      dueInDays: 0,
      actionType: "request_data_completion",
      payloadPreview: {
        reason: "예측 신뢰 수준 보강을 위한 누락 데이터 확인",
      },
    });
  }

  if (stage3.risk.zone === "danger") {
    actions.push({
      id: `${stage3.caseId}-a4`,
      priority: 2,
      title: "운영 지원 요청",
      reasonChips: ["운영 기준 초과 신호", "담당자 확인 필요"],
      dueInDays: 1,
      actionType: "request_support",
      payloadPreview: {
        summary: "고강도 추적 지원 필요",
      },
    });
  }

  return actions
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.dueInDays ?? 999) - (b.dueInDays ?? 999);
    })
    .slice(0, 6);
}

export function buildStage3RecommendedActionQueue(
  stage3: Stage3Case,
): RecommendedAction[] {
  const result: RecommendedAction[] = [];
  const p = stage3.prediction.probability;
  const failStreak = stage3.metrics.contactFailStreak ?? 0;
  const nextReeval = stage3.headerMeta.next_reval_at ?? stage3.ops.nextCheckpointAt;
  const dataQuality = stage3.metrics.dataQualityPct ?? 0;
  const trend = stage3.prediction.trend ?? [];
  const pDelta =
    trend.length >= 2 ? trend[trend.length - 1].p - trend[trend.length - 2].p : 0;

  const daysToReeval = nextReeval
    ? Math.ceil(
        (new Date(`${nextReeval}T00:00:00`).getTime() -
          new Date().setHours(0, 0, 0, 0)) /
          (1000 * 60 * 60 * 24),
      )
    : undefined;

  if (daysToReeval == null || daysToReeval <= 3 || p >= 0.7) {
    result.push({
      id: `${stage3.caseId}-rec-reeval`,
      type: "SCHEDULE_REEVAL",
      title: "재평가 예약 생성",
      reason:
        daysToReeval == null
          ? "다음 재평가 일정이 미설정입니다."
          : `재평가 일정 ${daysToReeval >= 0 ? `D-${daysToReeval}` : `D+${Math.abs(daysToReeval)}`} 상태입니다.`,
      severity: p >= 0.7 ? "HIGH" : "MID",
      requires_approval: true,
      decision: "PENDING",
    });
  }

  if (failStreak >= 3 || pDelta >= 0.08) {
    result.push({
      id: `${stage3.caseId}-rec-reminder`,
      type: "SEND_REMINDER",
      title: "리마인더 발송",
      reason:
        failStreak >= 3
          ? `미응답/실패 ${failStreak}회 누적로 확인 연락이 필요합니다.`
          : `전환위협 추정치가 ${Math.round(pDelta * 100)}%p 상승했습니다.`,
      severity: failStreak >= 4 ? "HIGH" : "MID",
      requires_approval: false,
      decision: "PENDING",
    });
  }

  if (stage3.headerMeta.plan_status === "NEEDS_UPDATE" || pDelta >= 0.05) {
    result.push({
      id: `${stage3.caseId}-rec-plan`,
      type: "UPDATE_PLAN",
      title: "플랜 갱신 필요",
      reason:
        stage3.headerMeta.plan_status === "NEEDS_UPDATE"
          ? "케어 플랜 상태가 갱신 필요입니다."
          : "최근 추세 변화로 플랜 점검이 필요합니다.",
      severity: "MID",
      requires_approval: true,
      decision: "PENDING",
    });
  }

  if (stage3.risk.zone === "danger" || stage3.headerMeta.churn_risk === "HIGH") {
    result.push({
      id: `${stage3.caseId}-rec-escalate`,
      type: "ESCALATE_LEVEL",
      title: "추적 강도 상향/지원 요청",
      reason: "이탈 위험 또는 고위험 신호가 감지되어 상향 조정이 필요합니다.",
      severity: "HIGH",
      requires_approval: true,
      decision: "PENDING",
    });
  }

  return result.slice(0, 3);
}

function actionLabelByType(actionType: Stage3Case["ops"]["recommendedActions"][number]["actionType"]) {
  if (actionType === "retry_contact") return { label: "재접촉 실행", type: "CALL" as const };
  if (actionType === "create_reassessment") return { label: "일정 생성", type: "SCHEDULE" as const };
  if (actionType === "strengthen_referral") return { label: "연계 진행", type: "LINK" as const };
  if (actionType === "adjust_intensity") return { label: "강도 조정", type: "SCHEDULE" as const };
  if (actionType === "request_data_completion") return { label: "보완 요청", type: "MESSAGE" as const };
  return { label: "지원 요청", type: "MESSAGE" as const };
}

function completionCriteriaByType(actionType: Stage3Case["ops"]["recommendedActions"][number]["actionType"]) {
  if (actionType === "retry_contact") {
    return ["연락 시도 1회 이상 기록", "실패 원인 태그 업데이트", "다음 체크포인트 갱신"];
  }
  if (actionType === "create_reassessment") {
    return ["재평가 일정 생성", "담당자 확인 메모 기록", "감사 로그 ID 생성"];
  }
  if (actionType === "strengthen_referral") {
    return ["연계 기관 상태 업데이트", "연계 메모 입력", "감사 로그 기록"];
  }
  if (actionType === "adjust_intensity") {
    return ["추적 강도 값 반영", "강도 조정 사유 기록", "다음 점검일 재계산"];
  }
  if (actionType === "request_data_completion") {
    return ["누락 항목 확인 요청", "보완 사유 기록", "감사 로그 기록"];
  }
  return ["지원 요청 등록", "요청자/사유 저장", "경고 로그 기록"];
}

function estimatedTimeByType(actionType: Stage3Case["ops"]["recommendedActions"][number]["actionType"]): number {
  if (actionType === "retry_contact") return 8;
  if (actionType === "create_reassessment") return 5;
  if (actionType === "strengthen_referral") return 7;
  if (actionType === "adjust_intensity") return 4;
  if (actionType === "request_data_completion") return 4;
  return 3;
}

export function toStage3WorkItems(actions: Stage3Case["ops"]["recommendedActions"]): Stage3WorkItem[] {
  return actions.map((action) => ({
    id: action.id,
    priority: action.priority === 0 ? "P0" : action.priority === 1 ? "P1" : "P2",
    title: action.title,
    reason: action.reasonChips.join(" · "),
    estimatedTimeMin: estimatedTimeByType(action.actionType),
    completionCriteria: completionCriteriaByType(action.actionType),
    action: actionLabelByType(action.actionType),
    actionType: action.actionType,
    payloadPreview: action.payloadPreview,
  }));
}

export function derivePredictionRecommendedOps(
  prediction: TransitionPrediction,
  dataQualityPct: number,
  missingCount: number,
): Array<{ key: string; label: string; priority: "P0" | "P1" | "P2" }> {
  const ops: Array<{ key: string; label: string; priority: "P0" | "P1" | "P2" }> = [];
  const trend = prediction.trend ?? [];
  const delta = trend.length >= 2 ? trend[trend.length - 1].p - trend[trend.length - 2].p : 0;
  const p = prediction.probability;

  if (p >= 0.7 || delta >= 0.1) {
    ops.push({ key: "create_reassessment", label: "재평가 일정 생성", priority: "P0" });
    ops.push({ key: "retry_contact", label: "재접촉 시도", priority: "P0" });
  } else if (p >= 0.55) {
    ops.push({ key: "adjust_intensity", label: "추적 강도 상향 검토", priority: "P1" });
  }

  if (dataQualityPct < 92 || missingCount > 0 || prediction.confidence === "LOW") {
    ops.push({ key: "request_data_completion", label: "누락 보완 요청", priority: "P0" });
  }

  if (p >= 0.6) {
    ops.push({ key: "strengthen_referral", label: "연계 강화", priority: "P1" });
  }

  if (ops.length === 0) {
    ops.push({ key: "adjust_intensity", label: "추적 강도 유지 점검", priority: "P2" });
  }

  return ops.slice(0, 4);
}

type WorkItemAutoGenInput = {
  p: number;
  confidence: ConfidenceLevel;
  quality: number;
  missingCount: number;
  trend?: { at: string; p: number }[];
  signals: Array<{ key: string; label: string; met: boolean }>;
  referralStatus: Stage3Case["referral"]["status"];
};

function toPriorityOrder(priority: Stage3WorkItem["priority"]) {
  if (priority === "P0") return 0;
  if (priority === "P1") return 1;
  return 2;
}

export function workItemAutoGen({
  p,
  confidence,
  quality,
  missingCount,
  trend,
  signals,
  referralStatus,
}: WorkItemAutoGenInput): Stage3WorkItem[] {
  const items: Stage3WorkItem[] = [];
  const pDelta = (trend?.length ?? 0) >= 2 ? (trend?.[trend.length - 1].p ?? p) - (trend?.[trend.length - 2].p ?? p) : 0;
  const metSignals = signals.filter((signal) => signal.met).map((signal) => signal.label).slice(0, 2);
  const baseReason = metSignals.length > 0 ? metSignals.join(" · ") : "운영 기준 점검";

  if (p >= 0.7 || pDelta >= 0.1) {
    items.push({
      id: "pred-auto-retry-contact",
      priority: "P0",
      title: "재접촉 시도",
      reason: `전환위협 추정 ${(p * 100).toFixed(0)}% · ${baseReason}`,
      estimatedTimeMin: 8,
      completionCriteria: ["연락 시도 1회 이상", "결과/실패 원인 기록"],
      action: { label: "재접촉 실행", type: "CALL" },
      actionType: "retry_contact",
      payloadPreview: {},
    });
    items.push({
      id: "pred-auto-reassessment",
      priority: "P0",
      title: "재평가 일정 생성",
      reason: `확률 급변 ${Math.max(0, pDelta * 100).toFixed(0)}%p · 담당자 확인 필요`,
      estimatedTimeMin: 5,
      completionCriteria: ["재평가 일정 생성", "다음 체크포인트 갱신"],
      action: { label: "일정 생성", type: "SCHEDULE" },
      actionType: "create_reassessment",
      payloadPreview: {},
    });
  }

  if (referralStatus === "in_progress" && p >= 0.65) {
    items.push({
      id: "pred-auto-referral",
      priority: "P1",
      title: "연계 진행 강화",
      reason: `전환위협 추정 ${(p * 100).toFixed(0)}% · 연계 진행 상태 점검 필요`,
      estimatedTimeMin: 7,
      completionCriteria: ["기관 진행 상태 확인", "연계 메모 갱신"],
      action: { label: "연계 진행", type: "LINK" },
      actionType: "strengthen_referral",
      payloadPreview: {},
    });
  }

  if (confidence === "LOW" || quality < 92 || missingCount > 0) {
    items.push({
      id: "pred-auto-quality",
      priority: "P0",
      title: "누락 보완 요청",
      reason: `데이터 품질 ${quality}% · 누락 ${missingCount}건 · 누락 영향으로 확실하지 않음`,
      estimatedTimeMin: 4,
      completionCriteria: ["누락 항목 보완 요청", "요청 사유 기록"],
      action: { label: "보완 요청", type: "MESSAGE" },
      actionType: "request_data_completion",
      payloadPreview: {},
    });
  }

  if (p < 0.7 && p >= 0.45 && pDelta > 0.03) {
    items.push({
      id: "pred-auto-intensity",
      priority: "P1",
      title: "추적 강도 상향 검토",
      reason: `추세 상승 ${Math.max(0, pDelta * 100).toFixed(0)}%p · 조기 개입 검토`,
      estimatedTimeMin: 4,
      completionCriteria: ["추적 강도 검토 기록", "차기 점검일 확인"],
      action: { label: "강도 조정", type: "SCHEDULE" },
      actionType: "adjust_intensity",
      payloadPreview: {},
    });
  }

  return items.sort((a, b) => toPriorityOrder(a.priority) - toPriorityOrder(b.priority));
}
