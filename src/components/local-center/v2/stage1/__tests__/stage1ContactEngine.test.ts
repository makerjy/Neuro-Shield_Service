import { describe, expect, it } from "vitest";
import type { ContactExecution, ContactPlan, PreTriageInput } from "../stage1Types";
import { deriveOutcomeTransition, derivePreTriageResultByRule, hasVulnerableTrigger } from "../stage1ContactEngine";

const baseExecution: ContactExecution = {
  status: "WAITING_RESPONSE",
  retryCount: 0,
};

const basePlan: ContactPlan = {
  channel: "SMS",
  templateId: "S1_CONTACT_BASE",
  maxRetryPolicy: { maxRetries: 2, intervalHours: 24 },
};

describe("Stage1 contact engine", () => {
  it("routes vulnerable cases to HUMAN_FIRST", () => {
    const input: PreTriageInput = {
      age: 83,
      dxHistory: { hasMCI: true, hasDementia: false },
      contactHistory: {
        hasComplaint: true,
        hasRefusal: false,
        needsGuardian: true,
        comprehensionDifficultyFlag: true,
      },
      guardian: { exists: true, isPrimaryContact: true },
      responseHistory: { smsResponseGood: false, callResponseGood: true },
    };

    const result = derivePreTriageResultByRule(input);

    expect(result.strategy).toBe("HUMAN_FIRST");
    expect(result.triggers).toContain("GUARDIAN_PRIMARY");
    expect(result.triggers).toContain("HAS_COMPLAINT_HISTORY");
    expect(hasVulnerableTrigger(result.triggers)).toBe(true);
  });

  it("handles SCHEDULE_LATER with recontact scheduling intent", () => {
    const transition = deriveOutcomeTransition({
      outcomeCode: "SCHEDULE_LATER",
      execution: baseExecution,
      linkageStatus: "NOT_CREATED",
      contactPlan: basePlan,
    });

    expect(transition.executionStatus).toBe("WAITING_RESPONSE");
    expect(transition.linkageStatus).toBe("BOOKING_IN_PROGRESS");
    expect(transition.recontactAfterHours).toBe(72);
  });

  it("moves REQUEST_GUARDIAN to HANDOFF_TO_HUMAN with handoff memo requirement", () => {
    const transition = deriveOutcomeTransition({
      outcomeCode: "REQUEST_GUARDIAN",
      execution: baseExecution,
      linkageStatus: "NOT_CREATED",
      contactPlan: basePlan,
    });

    expect(transition.executionStatus).toBe("HANDOFF_TO_HUMAN");
    expect(transition.requiresHandoffMemo).toBe(true);
    expect(transition.linkageStatus).toBe("REFERRAL_CREATED");
  });

  it("moves REFUSE to STOPPED and keeps recontact restricted", () => {
    const transition = deriveOutcomeTransition({
      outcomeCode: "REFUSE",
      execution: baseExecution,
      linkageStatus: "BOOKING_IN_PROGRESS",
      contactPlan: basePlan,
    });

    expect(transition.executionStatus).toBe("STOPPED");
    expect(transition.linkageStatus).toBe("NOT_CREATED");
    expect(transition.recommendedNextAction).toContain("재접촉 제한");
  });

  it("switches channel on repeated NO_RESPONSE", () => {
    const transition = deriveOutcomeTransition({
      outcomeCode: "NO_RESPONSE",
      execution: { ...baseExecution, retryCount: 1 },
      linkageStatus: "NOT_CREATED",
      contactPlan: basePlan,
    });

    expect(transition.executionStatus).toBe("RETRY_NEEDED");
    expect(transition.retryCount).toBe(2);
    expect(transition.switchedToHybrid).toBe(true);
    expect(transition.contactPlan?.channel).toBe("HYBRID");
  });
});
