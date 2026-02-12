import { beforeEach, describe, expect, it } from "vitest";
import { __test__clearStore, getCaseDetail, runOpsAction } from "../mockApi";

describe("Ops actions", () => {
  beforeEach(() => {
    __test__clearStore();
  });

  it("appends audit logs and updates timeline", async () => {
    const caseId = "CASE-2026-002";
    const before = await getCaseDetail(caseId);

    await runOpsAction(caseId, "CREATE_REFERRAL", "테스트담당자");
    await runOpsAction(caseId, "SEND_REFERRAL", "테스트담당자");

    const after = await getCaseDetail(caseId);

    expect(after.auditLogs.length).toBeGreaterThanOrEqual(before.auditLogs.length + 2);
    expect(after.auditLogs[0]?.message).toContain("의뢰서 전송 실행");
    expect(after.auditLogs[1]?.message).toContain("의뢰서 생성 실행");

    const referral = after.timeline.find((item) => item.key === "referral");
    const appointment = after.timeline.find((item) => item.key === "appointment");

    expect(referral?.status).toBe("done");
    expect(appointment?.status).toBe("waiting");
    expect(appointment?.at).toBeTruthy();
  });
});
