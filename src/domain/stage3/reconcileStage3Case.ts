import type {
  Stage3Case,
  Stage3LoopStep,
  Stage3ReconcilePatch,
  Stage3ReconcilePolicy,
  Stage3ReconcileResult,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function clone(input: Stage3Case): Stage3Case {
  return JSON.parse(JSON.stringify(input)) as Stage3Case;
}

function pushPatch(
  patches: Stage3ReconcilePatch[],
  inconsistencyFlags: string[],
  patch: Stage3ReconcilePatch,
) {
  patches.push(patch);
  inconsistencyFlags.push(patch.message);
}

function computeStepFromCompletion(completed: Stage3Case["loop"]["completed"]): Stage3LoopStep {
  const done1 = Boolean(completed.step1At);
  const done2 = done1 && Boolean(completed.step2At);
  const done3 = done2 && Boolean(completed.step3At);
  const done4 = done3 && Boolean(completed.step4At);

  if (done4) return 4;
  if (done3) return 4;
  if (done2) return 3;
  if (done1) return 2;
  return 1;
}

export function reconcileStage3Case(
  input: Stage3Case,
  policy: Stage3ReconcilePolicy,
): Stage3ReconcileResult {
  const nextCase = clone(input);
  const patches: Stage3ReconcilePatch[] = [];
  const inconsistencyFlags: string[] = [];
  let auditLog: Stage3ReconcileResult["auditLog"];

  if (nextCase.model.status !== "READY" && nextCase.model.result) {
    pushPatch(patches, inconsistencyFlags, {
      code: "P3",
      path: "model.result",
      message: "모델 상태가 READY가 아니므로 결과를 숨김 처리했습니다.",
      from: nextCase.model.result,
      to: null,
    });
    nextCase.model.result = null;
  }

  if (nextCase.loop.completed.step2At && !nextCase.loop.completed.step1At) {
    pushPatch(patches, inconsistencyFlags, {
      code: "P2",
      path: "loop.completed.step2At",
      message: "STEP2 완료 시각이 STEP1 없이 존재해 STEP2 완료 기록을 제거했습니다.",
      from: nextCase.loop.completed.step2At,
      to: undefined,
    });
    delete nextCase.loop.completed.step2At;
  }

  if (nextCase.loop.completed.step3At && !nextCase.loop.completed.step2At) {
    pushPatch(patches, inconsistencyFlags, {
      code: "P2",
      path: "loop.completed.step3At",
      message: "STEP3 완료 시각이 STEP2 없이 존재해 STEP3 완료 기록을 제거했습니다.",
      from: nextCase.loop.completed.step3At,
      to: undefined,
    });
    delete nextCase.loop.completed.step3At;
  }

  if (nextCase.loop.completed.step4At && !nextCase.loop.completed.step3At) {
    pushPatch(patches, inconsistencyFlags, {
      code: "P2",
      path: "loop.completed.step4At",
      message: "STEP4 완료 시각이 STEP3 없이 존재해 STEP4 완료 기록을 제거했습니다.",
      from: nextCase.loop.completed.step4At,
      to: undefined,
    });
    delete nextCase.loop.completed.step4At;
  }

  if (nextCase.model.status === "READY" && nextCase.model.result && !nextCase.loop.completed.step1At) {
    if (policy.autoCompleteStep1) {
      const autoAt = nextCase.model.result.computedAt || nowIso();
      pushPatch(patches, inconsistencyFlags, {
        code: "P1",
        path: "loop.completed.step1At",
        message: "모델 결과 READY 상태이므로 STEP1 검토 완료를 자동 반영했습니다.",
        from: undefined,
        to: autoAt,
      });
      nextCase.loop.completed.step1At = autoAt;
      auditLog = {
        at: nowIso(),
        actor: "system",
        message: "운영 지표 검토 자동 생성(시계열 검토 완료)",
        kind: "AUTO_STEP1_COMPLETED",
      };
    } else {
      inconsistencyFlags.push("모델 결과가 생성되었지만 STEP1 검토 기록이 필요합니다.");
    }
  }

  const diagnosisConfirmed = Boolean(nextCase.profile?.originStage2Result);
  if (diagnosisConfirmed && nextCase.loop.status !== "ON_HOLD" && nextCase.loop.status !== "EXCLUDED") {
    const inferredAt = nextCase.model.result?.computedAt ?? nextCase.updatedAt ?? nowIso();
    if (!nextCase.loop.completed.step1At) {
      pushPatch(patches, inconsistencyFlags, {
        code: "P1",
        path: "loop.completed.step1At",
        message: "진단확정(Stage2 결과 기반) 케이스라 STEP1을 자동 정렬했습니다.",
        from: undefined,
        to: inferredAt,
      });
      nextCase.loop.completed.step1At = inferredAt;
    }
    if (!nextCase.loop.completed.step2At) {
      pushPatch(patches, inconsistencyFlags, {
        code: "P1",
        path: "loop.completed.step2At",
        message: "진단확정(Stage2 결과 기반) 케이스라 STEP2를 자동 정렬했습니다.",
        from: undefined,
        to: inferredAt,
      });
      nextCase.loop.completed.step2At = inferredAt;
    }
    if (nextCase.model.status === "READY" && nextCase.model.result && !nextCase.loop.completed.step3At) {
      pushPatch(patches, inconsistencyFlags, {
        code: "P1",
        path: "loop.completed.step3At",
        message: "모델 READY 상태의 진단확정 케이스라 STEP3를 자동 정렬했습니다.",
        from: undefined,
        to: inferredAt,
      });
      nextCase.loop.completed.step3At = inferredAt;
    }
  }

  if (nextCase.loop.status === "ON_HOLD" || nextCase.loop.status === "EXCLUDED") {
    nextCase.loop.blockers = [
      nextCase.loop.status === "ON_HOLD" ? "보류 상태로 운영 루프가 잠겨 있습니다." : "제외 상태로 운영 루프가 잠겨 있습니다.",
    ];
  } else {
    const blockers: string[] = [];
    if (!nextCase.loop.completed.step1At) blockers.push("STEP1 완료 필요");
    if (nextCase.loop.completed.step1At && !nextCase.loop.completed.step2At) blockers.push("STEP2 완료 필요");
    if (nextCase.loop.completed.step2At && !nextCase.loop.completed.step3At) blockers.push("STEP3 완료 필요");
    nextCase.loop.blockers = blockers;
  }

  const derivedStep = computeStepFromCompletion(nextCase.loop.completed);
  if (nextCase.loop.step !== derivedStep) {
    pushPatch(patches, inconsistencyFlags, {
      code: "P4",
      path: "loop.step",
      message: `완료 단계 기준으로 현재 스텝을 ${derivedStep}로 정렬했습니다.`,
      from: nextCase.loop.step,
      to: derivedStep,
    });
    nextCase.loop.step = derivedStep;
  }

  if (nextCase.loop.status === "DONE") {
    if (!nextCase.loop.completed.step4At) {
      pushPatch(patches, inconsistencyFlags, {
        code: "P5",
        path: "loop.completed.step4At",
        message: "루프 상태가 DONE인데 STEP4 완료 시각이 없어 자동 보정했습니다.",
        from: undefined,
        to: nowIso(),
      });
      nextCase.loop.completed.step4At = nowIso();
      nextCase.loop.step = 4;
    }
  }

  return {
    nextCase,
    patches,
    inconsistencyFlags,
    auditLog,
  };
}
