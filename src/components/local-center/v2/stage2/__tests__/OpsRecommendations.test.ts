import { beforeEach, describe, expect, it } from "vitest";
import { __test__clearStore, __test__peekCase, getOpsRecommendations } from "../mockApi";

describe("Ops recommendation generation", () => {
  beforeEach(() => {
    __test__clearStore();
  });

  it("includes PET/MRI check recommendation when mciSignal is caution", async () => {
    const caseData = __test__peekCase("CASE-2026-005");
    expect(caseData.stage2.mciSignal).toBe("주의");

    const recommendations = await getOpsRecommendations("CASE-2026-005", "test");
    const item = recommendations.items.find((entry) => entry.title.includes("추가 정밀 확인 권고(참고)"));

    expect(item).toBeDefined();
    expect(item?.rationale).toContain("PET 또는 MRI 검사 가능 여부 확인");
  });
});
