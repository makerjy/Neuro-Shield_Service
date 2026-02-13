import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Stage1 UI copy guard", () => {
  it("keeps forbidden AI decision expressions out of Stage1 ops copy", () => {
    const target = path.resolve(process.cwd(), "src/components/local-center/v2/stage1/Stage1OpsDetail.tsx");
    const content = fs.readFileSync(target, "utf8");

    const forbiddenPatterns = [/AI가 판단/g, /AI가 결정/g, /분류결정/g, /확진/g];

    for (const pattern of forbiddenPatterns) {
      expect(content).not.toMatch(pattern);
    }
  });

  it("includes the required contact disclaimer in composer copy", () => {
    const target = path.resolve(process.cwd(), "src/components/local-center/v2/stage1/Stage1OpsDetail.tsx");
    const content = fs.readFileSync(target, "utf8");
    expect(content).toContain("본 안내는 진단이 아니며, 센터 안내 및 예약/연계 목적입니다.");
  });
});
