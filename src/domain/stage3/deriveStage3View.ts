import { reconcileStage3Case } from "./reconcileStage3Case";
import type {
  Stage3Case,
  Stage3LoopStep,
  Stage3ReconcilePolicy,
  Stage3StepCard,
  Stage3ViewModel,
} from "./types";

function toRiskLabel(pct: number): "LOW" | "MID" | "HIGH" {
  if (pct >= 70) return "HIGH";
  if (pct >= 45) return "MID";
  return "LOW";
}

function modelBadge(status: Stage3Case["model"]["status"]): Stage3ViewModel["display"]["modelBadge"] {
  if (status === "READY") {
    return { label: "모델 READY", status, tone: "success" };
  }
  if (status === "RUNNING") {
    return { label: "모델 실행 중", status, tone: "warning" };
  }
  if (status === "QUEUED") {
    return { label: "모델 대기", status, tone: "warning" };
  }
  if (status === "FAILED") {
    return { label: "모델 실패", status, tone: "danger" };
  }
  return { label: "모델 준비 전", status, tone: "neutral" };
}

function buildStepCard(
  step: Stage3LoopStep,
  input: Omit<Stage3StepCard, "step">,
): Stage3StepCard {
  return {
    step,
    ...input,
  };
}

export function deriveStage3View(
  source: Stage3Case,
  policy: Stage3ReconcilePolicy,
): Stage3ViewModel {
  const reconciled = reconcileStage3Case(source, policy);
  const stage3 = reconciled.nextCase;

  const done1 = Boolean(stage3.loop.completed.step1At);
  const done2 = Boolean(stage3.loop.completed.step2At);
  const done3 = Boolean(stage3.loop.completed.step3At);
  const done4 = Boolean(stage3.loop.completed.step4At);

  const globallyLocked = stage3.loop.status === "ON_HOLD" || stage3.loop.status === "EXCLUDED";

  const steps: Stage3StepCard[] = [];

  if (done1) {
    steps.push(
      buildStepCard(1, {
        title: "STEP 1",
        subtitle: "리뷰 기록",
        state: "DONE",
        reason: "STEP1 검토가 완료되었습니다.",
        canOpen: true,
      }),
    );
  } else {
    steps.push(
      buildStepCard(1, {
        title: "STEP 1",
        subtitle: "리뷰 기록",
        state: globallyLocked ? "LOCKED" : "TODO",
        reason: globallyLocked
          ? stage3.loop.status === "ON_HOLD"
            ? "보류 상태라 STEP1이 잠겨 있습니다."
            : "제외 상태라 STEP1이 잠겨 있습니다."
          : stage3.model.status === "READY" && !policy.autoCompleteStep1
            ? "모델 결과가 있어 STEP1 기록이 필요합니다."
            : "STEP1 리뷰 기록이 필요합니다.",
        canOpen: !globallyLocked,
      }),
    );
  }

  if (done2) {
    steps.push(
      buildStepCard(2, {
        title: "STEP 2",
        subtitle: "결과 수신/검증",
        state: "DONE",
        reason: "STEP2 결과 수신/검증이 완료되었습니다.",
        canOpen: true,
      }),
    );
  } else if (!done1 || globallyLocked) {
    steps.push(
      buildStepCard(2, {
        title: "STEP 2",
        subtitle: "결과 수신/검증",
        state: "LOCKED",
        reason: globallyLocked ? "운영 상태로 인해 잠겨 있습니다." : "STEP1 완료가 필요합니다.",
        canOpen: false,
      }),
    );
  } else {
    steps.push(
      buildStepCard(2, {
        title: "STEP 2",
        subtitle: "결과 수신/검증",
        state: stage3.model.status === "RUNNING" || stage3.model.status === "QUEUED" ? "IN_PROGRESS" : "TODO",
        reason:
          stage3.model.status === "RUNNING" || stage3.model.status === "QUEUED"
            ? "결과 수신/검증 진행 중입니다."
            : "STEP2 결과 수신/검증이 필요합니다.",
        canOpen: true,
      }),
    );
  }

  if (done3) {
    steps.push(
      buildStepCard(3, {
        title: "STEP 3",
        subtitle: "모델 결과 검토",
        state: "DONE",
        reason: "STEP3 모델 결과 검토가 완료되었습니다.",
        canOpen: true,
      }),
    );
  } else if (!done2 || globallyLocked) {
    steps.push(
      buildStepCard(3, {
        title: "STEP 3",
        subtitle: "모델 결과 검토",
        state: "LOCKED",
        reason: globallyLocked ? "운영 상태로 인해 잠겨 있습니다." : "STEP2 완료가 필요합니다.",
        canOpen: false,
      }),
    );
  } else {
    steps.push(
      buildStepCard(3, {
        title: "STEP 3",
        subtitle: "모델 결과 검토",
        state: stage3.model.status === "READY" ? "IN_PROGRESS" : "TODO",
        reason: stage3.model.status === "READY" ? "모델 결과 확인 후 확정이 필요합니다." : "모델 결과 대기 중입니다.",
        canOpen: true,
      }),
    );
  }

  if (done4) {
    steps.push(
      buildStepCard(4, {
        title: "STEP 4",
        subtitle: "다음 조치 확정",
        state: "DONE",
        reason: "STEP4 다음 조치가 확정되었습니다.",
        canOpen: true,
      }),
    );
  } else if (!done3 || globallyLocked) {
    steps.push(
      buildStepCard(4, {
        title: "STEP 4",
        subtitle: "다음 조치 확정",
        state: "LOCKED",
        reason: globallyLocked ? "운영 상태로 인해 잠겨 있습니다." : "STEP3 완료가 필요합니다.",
        canOpen: false,
      }),
    );
  } else {
    steps.push(
      buildStepCard(4, {
        title: "STEP 4",
        subtitle: "다음 조치 확정",
        state: "TODO",
        reason: "다음 조치 확정이 필요합니다.",
        canOpen: true,
      }),
    );
  }

  const doneCount = steps.filter((item) => item.state === "DONE").length;
  const firstActionable = steps.find((item) => item.state === "TODO" || item.state === "IN_PROGRESS");

  const primaryCta = globallyLocked
    ? {
        label: stage3.loop.status === "ON_HOLD" ? "보류 사유 확인" : "제외 사유 확인",
        step: null,
        reason: "운영 상태 해제가 필요합니다.",
      }
    : firstActionable
      ? {
          label: `STEP${firstActionable.step} 작업 열기`,
          step: firstActionable.step,
          reason: firstActionable.reason,
        }
      : {
          label: "운영 루프 완료",
          step: 4 as Stage3LoopStep,
          reason: "모든 단계가 완료되었습니다.",
      };

  const stage3Type =
    stage3.profile?.stage3Type ??
    (stage3.profile?.originStage2Result === "AD" ? "AD_MANAGEMENT" : "PREVENTIVE_TRACKING");
  const riskBadge =
    stage3.model.status === "READY" && stage3.model.result
      ? {
          kind: "ready" as const,
          label:
            stage3Type === "AD_MANAGEMENT"
              ? `현재 위험지수 ${Math.round(stage3.model.result.risk_2y_ad * 100)}% (${toRiskLabel(
                  Math.round(stage3.model.result.risk_2y_ad * 100),
                )})`
              : `AD 전환 위험(2년) ${Math.round(stage3.model.result.risk_2y_ad * 100)}% (${toRiskLabel(
                  Math.round(stage3.model.result.risk_2y_ad * 100),
                )})`,
          riskPct: Math.round(stage3.model.result.risk_2y_ad * 100),
          modelVersion: stage3.model.result.modelVersion,
          computedAt: stage3.model.result.computedAt,
          tone:
            Math.round(stage3.model.result.risk_2y_ad * 100) >= 70
              ? ("danger" as const)
              : Math.round(stage3.model.result.risk_2y_ad * 100) >= 45
                ? ("warning" as const)
                : ("success" as const),
        }
      : {
          kind: "pending" as const,
          label: "결과 대기",
          reason: "결과 대기 · 검사 입력 필요",
          tone: "warning" as const,
        };

  const trackingStatus: Stage3ViewModel["display"]["trackingStatus"] =
    stage3.loop.status === "ON_HOLD" || stage3.loop.status === "EXCLUDED"
      ? "이탈 위험"
      : riskBadge.kind === "ready"
        ? riskBadge.riskPct >= 70
          ? "이탈 위험"
          : riskBadge.riskPct >= 45
            ? "악화"
            : "안정"
        : "악화";
  const intensity: Stage3ViewModel["display"]["intensity"] =
    trackingStatus === "이탈 위험" ? "긴급" : trackingStatus === "악화" ? "집중" : "일반";

  const warnings = [
    ...stage3.loop.blockers,
    ...(reconciled.inconsistencyFlags.length > 0 ? ["정합성 보정이 적용되었습니다."] : []),
  ];

  return {
    caseId: stage3.caseId,
    source: stage3,
    display: {
      modelBadge: modelBadge(stage3.model.status),
      riskBadge,
      loopProgress: {
        done: doneCount,
        total: 4,
        text: `${doneCount}/4`,
      },
      trackingStatus,
      intensity,
      stepCards: steps,
      inconsistencyFlags: reconciled.inconsistencyFlags,
      warnings,
      primaryCta,
    },
    meta: {
      lastUpdatedAt: stage3.updatedAt,
    },
  };
}
