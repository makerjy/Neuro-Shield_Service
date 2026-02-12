import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Stage2 UI copy guard", () => {
  it("does not include forbidden expressions in Stage2 workflow copy", () => {
    const targets = [
      path.resolve(process.cwd(), "src/components/local-center/v2/stage2/Stage2CaseWorkflow.tsx"),
      path.resolve(process.cwd(), "src/components/local-center/v2/stage2/recommendationEngine.ts"),
    ];

    const forbiddenPatterns = [
      /진단/g,
      /확정/g,
      /판정/g,
      /AI가 판단/g,
      /AI가 결정/g,
      /AI가 분석/g,
    ];

    for (const targetPath of targets) {
      const content = fs.readFileSync(targetPath, "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });
});
