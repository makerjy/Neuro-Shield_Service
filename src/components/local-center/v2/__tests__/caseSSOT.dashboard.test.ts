import { describe, expect, it } from "vitest";

import { getDashboardStats } from "../caseSSOT";

describe("caseSSOT dashboard stats", () => {
  it("includes high-risk MCI cases in donut distribution", () => {
    const stats = getDashboardStats();
    const highSlice = stats.mciDistribution.find((item) => item.name === "High")?.value ?? 0;

    expect(stats.highRiskMci).toBeGreaterThan(0);
    expect(highSlice).toBeGreaterThan(0);
  });
});
