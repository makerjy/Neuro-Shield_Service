import type { DemoDatasetRow } from "../types";

const BASE_URL = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
const STAGE3_ASSET_BASE = BASE_URL ? `${BASE_URL}/` : "/";

export const STAGE3_SAMPLE_BASE_PATHS = [
  `${STAGE3_ASSET_BASE}assets/mri/samples`,
  `${STAGE3_ASSET_BASE}assets/mri/test_image`,
] as const;

export function getStage3SourceLabel(basePath: string): string {
  return basePath.replace(STAGE3_ASSET_BASE, "");
}

export const STAGE3_SAMPLE_PATHS_BY_PTID: Record<string, string[]> = {
  "002_S_1155": [
    "MCI/002_S_1155_I995496_s0.png",
    "MCI/002_S_1155_I995496_s1.png",
    "MCI/002_S_1155_I995496_s2.png",
    "MCI/002_S_1155_I995496_s3.png",
    "MCI/002_S_1155_I995496_s4.png",
    "MCI/002_S_1155_I843510_s0.png",
    "MCI/002_S_1155_I843510_s1.png",
  ],
  "002_S_0413": [
    "CN/002_S_0413_I863056_s0.png",
    "CN/002_S_0413_I863056_s1.png",
    "CN/002_S_0413_I863056_s2.png",
  ],
  "003_S_6833": [
    "DM_or_AD/003_S_6833_I1254307_s0.png",
    "DM_or_AD/003_S_6833_I1254307_s1.png",
    "DM_or_AD/003_S_6833_I1254307_s2.png",
  ],
};

export const STAGE3_FALLBACK_REL_PATHS = [
  "MCI/002_S_1155_I995496_s0.png",
  "MCI/002_S_1155_I995496_s1.png",
  "MCI/002_S_1155_I995496_s2.png",
] as const;

export function getStage3RelPathsByPtid(ptid: string): string[] {
  const byPtid = STAGE3_SAMPLE_PATHS_BY_PTID[ptid];
  if (byPtid && byPtid.length > 0) {
    return byPtid.slice(0, 10);
  }
  return Array.from(STAGE3_FALLBACK_REL_PATHS);
}

function extractImageToken(scanId: string): string | null {
  const matched = scanId.match(/I\d+/i);
  if (!matched) return null;
  return matched[0];
}

export function resolveStage3SampleId(row: DemoDatasetRow): string {
  const ptid = String(row.ptid ?? "");
  const scanId = String(row.scan_id ?? "");
  const relPaths = getStage3RelPathsByPtid(ptid);
  const imageToken = extractImageToken(scanId);

  if (imageToken) {
    const matched = relPaths.find((path) => path.includes(imageToken));
    if (matched) {
      return matched;
    }
  }

  return relPaths[0];
}
