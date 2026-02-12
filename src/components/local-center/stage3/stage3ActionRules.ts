import type { Stage3Case } from "./stage3Types";

function toYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function buildRecommendedActions(stage3: Stage3Case): Stage3Case["ops"]["recommendedActions"] {
  const actions: Stage3Case["ops"]["recommendedActions"] = [];
  const scoreDrop = stage3.metrics.scoreChangePct ?? 0;
  const failStreak = stage3.metrics.contactFailStreak ?? 0;
  const nextCheckpoint = stage3.ops.nextCheckpointAt;

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
        `점수 변화 ${scoreDrop}%`,
      ],
      dueInDays: Math.max(daysToCheckpoint ?? 0, 0),
      actionType: "create_reassessment",
      payloadPreview: {
        proposedDate: toYmd(new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)),
        reason: "운영 기준 재평가 주기 충족",
      },
    });
  }

  if (failStreak >= 3) {
    actions.push({
      id: `${stage3.caseId}-a1`,
      priority: 0,
      title: "재접촉 시도",
      reasonChips: [`연속 실패 ${failStreak}회`, `연락 성공률 ${stage3.metrics.contactSuccessRatePct ?? 0}%`],
      dueInDays: 0,
      actionType: "retry_contact",
      payloadPreview: {
        preferredSlot: stage3.communication.recommendedTimeSlot ?? "평일 14:00~16:00",
      },
    });
  }

  if (stage3.risk.zone !== "stable" && stage3.risk.intensity !== "biweekly") {
    actions.push({
      id: `${stage3.caseId}-a2`,
      priority: 1,
      title: "추적 강도 상향",
      reasonChips: [`위험 구간 ${stage3.risk.zone}`, `현재 추적 강도 ${stage3.risk.intensity}`],
      dueInDays: 2,
      actionType: "adjust_intensity",
      payloadPreview: {
        targetIntensity: "biweekly",
        reason: "재평가 필요 신호 충족",
      },
    });
  }

  if (stage3.referral.status !== "done") {
    actions.push({
      id: `${stage3.caseId}-a3`,
      priority: 1,
      title: "연계 진행 강화",
      reasonChips: [`연계 상태 ${stage3.referral.status}`, `담당자 확인 필요`],
      dueInDays: 5,
      actionType: "strengthen_referral",
      payloadPreview: {
        organization: stage3.referral.organization,
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
