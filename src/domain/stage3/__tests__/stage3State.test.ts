import { describe, expect, it } from "vitest";
import { deriveStage3View } from "../deriveStage3View";
import { reconcileStage3Case } from "../reconcileStage3Case";
import type { Stage3Case } from "../types";

function makeBaseCase(): Stage3Case {
  return {
    caseId: "CASE-TEST-001",
    updatedAt: "2026-02-19T09:00:00.000Z",
    model: {
      status: "NOT_READY",
      result: null,
    },
    loop: {
      step: 1,
      completed: {},
      status: "IN_PROGRESS",
      blockers: [],
    },
  };
}

describe("stage3 reconcile/derive", () => {
  it("policy B: READY + result and missing step1 should auto complete step1", () => {
    const input = makeBaseCase();
    input.model.status = "READY";
    input.model.result = {
      risk_2y_ad: 0.67,
      computedAt: "2026-02-19T10:00:00.000Z",
      modelVersion: "stage3-v1",
    };

    const reconciled = reconcileStage3Case(input, { autoCompleteStep1: true });
    expect(reconciled.nextCase.loop.completed.step1At).toBe("2026-02-19T10:00:00.000Z");
    expect(reconciled.nextCase.loop.step).toBe(2);
    expect(reconciled.patches.some((patch) => patch.code === "P1")).toBe(true);

    const view = deriveStage3View(input, { autoCompleteStep1: true });
    expect(view.display.stepCards[0]?.state).toBe("DONE");
    expect(view.display.stepCards[1]?.state).not.toBe("LOCKED");
  });

  it("policy A: READY + result and missing step1 should keep step1 TODO", () => {
    const input = makeBaseCase();
    input.model.status = "READY";
    input.model.result = {
      risk_2y_ad: 0.44,
      computedAt: "2026-02-19T10:00:00.000Z",
      modelVersion: "stage3-v1",
    };

    const reconciled = reconcileStage3Case(input, { autoCompleteStep1: false });
    expect(reconciled.nextCase.loop.completed.step1At).toBeUndefined();

    const view = deriveStage3View(input, { autoCompleteStep1: false });
    expect(view.display.stepCards[0]?.state).toBe("TODO");
    expect(view.display.stepCards[1]?.state).toBe("LOCKED");
  });

  it("step2At exists without step1At should remove step2At", () => {
    const input = makeBaseCase();
    input.loop.completed.step2At = "2026-02-19T11:00:00.000Z";

    const reconciled = reconcileStage3Case(input, { autoCompleteStep1: true });
    expect(reconciled.nextCase.loop.completed.step2At).toBeUndefined();
    expect(reconciled.inconsistencyFlags.some((flag) => flag.includes("STEP2 완료 시각"))).toBe(true);
  });

  it("model RUNNING with stale result should hide result", () => {
    const input = makeBaseCase();
    input.model.status = "RUNNING";
    input.model.result = {
      risk_2y_ad: 0.9,
      computedAt: "2026-02-19T11:00:00.000Z",
      modelVersion: "stage3-v1",
    };

    const view = deriveStage3View(input, { autoCompleteStep1: true });
    expect(view.display.riskBadge.kind).toBe("pending");
    expect(view.display.inconsistencyFlags.some((flag) => flag.includes("READY가 아니므로 결과"))).toBe(true);
  });

  it("ON_HOLD should lock all step cards", () => {
    const input = makeBaseCase();
    input.loop.status = "ON_HOLD";

    const view = deriveStage3View(input, { autoCompleteStep1: true });
    expect(view.display.stepCards.every((step) => step.state === "LOCKED" || step.state === "TODO")).toBe(true);
    expect(view.display.primaryCta.label).toContain("보류");
  });

  it("diagnosis-confirmed stage3 case should align loop up to step2 automatically", () => {
    const input = makeBaseCase();
    input.profile = {
      stage3Type: "PREVENTIVE_TRACKING",
      originStage2Result: "MCI-HIGH",
      originRiskScore: 0.71,
    };

    const reconciled = reconcileStage3Case(input, { autoCompleteStep1: true });
    expect(reconciled.nextCase.loop.completed.step1At).toBeTruthy();
    expect(reconciled.nextCase.loop.completed.step2At).toBeTruthy();

    const view = deriveStage3View(input, { autoCompleteStep1: true });
    expect(view.display.stepCards[0]?.state).toBe("DONE");
    expect(view.display.stepCards[1]?.state).toBe("DONE");
    expect(view.display.stepCards[2]?.state).not.toBe("LOCKED");
  });

  it("diagnosis-confirmed + model READY should align loop up to step3 done", () => {
    const input = makeBaseCase();
    input.profile = {
      stage3Type: "AD_MANAGEMENT",
      originStage2Result: "AD",
      originRiskScore: 0.88,
    };
    input.model.status = "READY";
    input.model.result = {
      risk_2y_ad: 0.88,
      computedAt: "2026-02-19T12:00:00.000Z",
      modelVersion: "stage3-v1",
    };

    const reconciled = reconcileStage3Case(input, { autoCompleteStep1: true });
    expect(reconciled.nextCase.loop.completed.step3At).toBe("2026-02-19T12:00:00.000Z");

    const view = deriveStage3View(input, { autoCompleteStep1: true });
    expect(view.display.stepCards[2]?.state).toBe("DONE");
  });
});
