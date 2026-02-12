import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { Stage1SignalStrip } from "../Stage2CaseWorkflow";
import { __test__clearStore, __test__peekCase } from "../mockApi";

describe("Stage1SignalStrip", () => {
  beforeEach(() => {
    __test__clearStore();
  });

  it("renders Stage1 signal summary values", () => {
    const caseData = __test__peekCase("CASE-2026-005");

    render(<Stage1SignalStrip caseData={caseData} />);

    expect(screen.getByText(new RegExp(`CIST ${caseData.stage1.cist.score}/${caseData.stage1.cist.max}`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`위험 신호 등급 ${caseData.stage1.signalLevel}`))).toBeInTheDocument();
    expect(screen.getByText(/재평가 트리거/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`데이터 충분성 누락 ${caseData.stage2.neuropsych_1.missingItems.count}건`))).toBeInTheDocument();
  });
});
