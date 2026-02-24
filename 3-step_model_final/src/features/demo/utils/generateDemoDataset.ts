import { DEFAULT_SEED } from "../constants";
import type { DemoDatasetRow, StageKey } from "../types";
import { mulberry32, randomFrom, randomInt } from "./random";

const NAME_POOL = ["김종팔", "박덕기", "이옥자", "최종덕", "한만복", "윤갑순", "임칠성"] as const;

function activeStageRow(stage: StageKey): DemoDatasetRow {
  if (stage === "stage1") {
    return {
      caseId: "case-2026-175",
      ptid: "002_S_1155",
      name: "김복남(가명)",
      ageBand: "70s",
      CIST_ORIENT: 3,
      CIST_ATTENTION: 2,
      CIST_EXEC: 3,
      CIST_MEMORY: 5,
      CIST_LANGUAGE: 2,
      entry_age: 74,
      PTEDUCAT: 11,
      VSBPSYS: 148,
      BMI: 26.9,
      PTGENDER_num: 1,
      caregiver_available: 0,
      __activeCase: true,
    };
  }

  if (stage === "stage2") {
    return {
      caseId: "case-2026-175",
      ptid: "002_S_1155",
      name: "김복남(가명)",
      ageBand: "70s",
      entry_age: 74,
      PTGENDER: 1,
      VSBPSYS: 148,
      CDRSB: 1.8,
      MMSCORE: 22,
      FAQTOTAL: 9,
      LDELTOTAL: 5,
      COG_DISORDER: 1,
      dementia_med: 0,
      antidepressant_med: 1,
      __activeCase: true,
    };
  }

  return {
    caseId: "case-2026-175",
    ptid: "002_S_1155",
    name: "김복남(가명)",
    ageBand: "70s",
    scan_id: "MRI-002_S_1155-2026Q1",
    image_quality: 0.84,
    ventricle_ratio: 0.47,
    hippocampus_index: 0.42,
    white_matter_index: 0.51,
    baseline_cognitive_score: 23,
    __activeCase: true,
  };
}

function randomStageRow(stage: StageKey, idx: number, rng: () => number): DemoDatasetRow {
  const ageBand = randomFrom(rng, ["60s", "70s", "80s"] as const);
  const ageBase = ageBand === "60s" ? 64 : ageBand === "70s" ? 74 : 83;

  const common = {
    caseId: `case-2026-${200 + idx}`,
    ptid: `${randomInt(rng, 100, 999)}_S_${randomInt(rng, 1000, 9999)}`,
    name: `${randomFrom(rng, NAME_POOL)}(가명)`,
    ageBand,
  };

  if (stage === "stage1") {
    return {
      ...common,
      CIST_ORIENT: randomInt(rng, 1, 5),
      CIST_ATTENTION: randomInt(rng, 0, 3),
      CIST_EXEC: randomInt(rng, 1, 6),
      CIST_MEMORY: randomInt(rng, 2, 10),
      CIST_LANGUAGE: randomInt(rng, 1, 4),
      entry_age: ageBase + randomInt(rng, -4, 4),
      PTEDUCAT: randomInt(rng, 6, 17),
      VSBPSYS: randomInt(rng, 108, 172),
      BMI: Number((19 + rng() * 11).toFixed(1)),
      PTGENDER_num: randomFrom(rng, [1, 2] as const),
      caregiver_available: randomFrom(rng, [0, 1] as const),
      __activeCase: false,
    };
  }

  if (stage === "stage2") {
    return {
      ...common,
      entry_age: ageBase + randomInt(rng, -4, 4),
      PTGENDER: randomFrom(rng, [1, 2] as const),
      VSBPSYS: randomInt(rng, 108, 172),
      CDRSB: Number((rng() * 4.2).toFixed(2)),
      MMSCORE: randomInt(rng, 15, 30),
      FAQTOTAL: randomInt(rng, 0, 18),
      LDELTOTAL: randomInt(rng, 1, 12),
      COG_DISORDER: randomFrom(rng, [0, 1] as const),
      dementia_med: randomFrom(rng, [0, 1] as const),
      antidepressant_med: randomFrom(rng, [0, 1] as const),
      __activeCase: false,
    };
  }

  return {
    ...common,
    scan_id: `MRI-${randomInt(rng, 1000, 9999)}-${idx}`,
    image_quality: Number((0.64 + rng() * 0.32).toFixed(2)),
    ventricle_ratio: Number((0.2 + rng() * 0.45).toFixed(2)),
    hippocampus_index: Number((0.22 + rng() * 0.5).toFixed(2)),
    white_matter_index: Number((0.3 + rng() * 0.4).toFixed(2)),
    baseline_cognitive_score: randomInt(rng, 16, 29),
    __activeCase: false,
  };
}

export function generateDemoDataset(stage: StageKey, n = 100, seed = DEFAULT_SEED): DemoDatasetRow[] {
  const size = Math.max(1, n);
  const rng = mulberry32(seed + stage.length * 97);
  const rows: DemoDatasetRow[] = [activeStageRow(stage)];

  for (let i = 1; i < size; i += 1) {
    rows.push(randomStageRow(stage, i, rng));
  }

  return rows;
}
