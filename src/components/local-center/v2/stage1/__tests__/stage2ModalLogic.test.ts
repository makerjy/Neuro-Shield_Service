import { describe, expect, it } from "vitest";
import {
  buildStage2ValidationErrors,
  computeStage2MissingFields,
  countStage2MissingByPlan,
  deriveStage2ModelRecommendation,
} from "../stage2ModalLogic";

describe("stage2ModalLogic", () => {
  it("협약병원 경로에서 MMSE/CDR 비어있으면 누락으로 계산한다", () => {
    const missing = computeStage2MissingFields(
      {
        specialist: true,
        mmse: undefined,
        cdr: undefined,
        neuroCognitiveType: "SNSB-II",
      },
      "HOSPITAL_REFERRAL",
      {
        specialist: true,
        mmse: true,
        cdrOrGds: true,
        neuroCognitive: true,
      },
    );
    expect(missing).toContain("mmse");
    expect(missing).toContain("cdr");
    expect(missing.length).toBe(2);
  });

  it("센터 직접 수행 경로에서는 MMSE를 필수로 강제하지 않는다", () => {
    const count = countStage2MissingByPlan(
      {
        specialist: true,
        mmse: undefined,
        cdr: 1,
        neuroCognitiveType: "CERAD-K",
      },
      "CENTER_DIRECT",
      {
        specialist: true,
        mmse: true,
        cdrOrGds: true,
        neuroCognitive: true,
      },
    );
    expect(count).toBe(0);
  });

  it("NaN 값은 입력값으로 간주하지 않고 누락으로 처리한다", () => {
    const missing = computeStage2MissingFields(
      {
        specialist: true,
        mmse: Number.NaN,
        cdr: Number.NaN,
        neuroCognitiveType: "SNSB-II",
      },
      "HOSPITAL_REFERRAL",
      {
        specialist: true,
        mmse: true,
        cdrOrGds: true,
        neuroCognitive: true,
      },
    );
    expect(missing).toContain("mmse");
    expect(missing).toContain("cdr");
  });

  it("모델 추천과 다르게 확정하면 override 사유 에러를 만든다", () => {
    const errors = buildStage2ValidationErrors(
      {
        specialist: true,
        mmse: 23,
        cdr: 1,
        neuroCognitiveType: "SNSB-C",
      },
      "HOSPITAL_REFERRAL",
      {
        specialist: true,
        mmse: true,
        cdrOrGds: true,
        neuroCognitive: true,
      },
      {
        recommendedLabel: "MCI",
        selectedLabel: "정상",
        overrideReason: "",
      },
    );
    expect(errors.overrideReason).toBeTruthy();
  });

  it("MMSE/CDR 값이 허용 범위를 벗어나면 범위 에러를 만든다", () => {
    const errors = buildStage2ValidationErrors(
      {
        specialist: true,
        mmse: 42,
        cdr: 9,
        neuroCognitiveType: "SNSB-C",
      },
      "HOSPITAL_REFERRAL",
      {
        specialist: true,
        mmse: true,
        cdrOrGds: true,
        neuroCognitive: true,
      },
    );
    expect(errors.mmse).toContain("0~30");
    expect(errors.cdr).toContain("0~7");
  });

  it("MMSE/CDR 값으로 모델 추천 분류를 도출한다", () => {
    expect(
      deriveStage2ModelRecommendation({
        specialist: true,
        mmse: 28,
        cdr: 0,
        neuroCognitiveType: "LICA",
      }),
    ).toBe("정상");

    expect(
      deriveStage2ModelRecommendation({
        specialist: true,
        mmse: 24,
        cdr: 0.5,
        neuroCognitiveType: "SNSB-II",
      }),
    ).toBe("MCI");

    expect(
      deriveStage2ModelRecommendation({
        specialist: true,
        mmse: 18,
        cdr: 2,
        neuroCognitiveType: "SNSB-C",
      }),
    ).toBe("치매");
  });
});
