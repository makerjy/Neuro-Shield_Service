const DEMO_QUERY_PARAM = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("demo") : null;
const PANEL_QUERY_PARAM = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("panel") : null;

function toBoolean(value: string | undefined | null, fallback: boolean) {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return fallback;
}

function toNumber(value: string | undefined | null, fallback: number) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const DEMO_MODE = toBoolean(import.meta.env.VITE_DEMO_MODE, true) || DEMO_QUERY_PARAM === "1";
export const DEMO_SPEED = toNumber(import.meta.env.VITE_DEMO_SPEED, 20);
export const HERO_CASE_ID = "CASE-2026-175";
export const DEMO_PANEL_ENABLED = DEMO_MODE && PANEL_QUERY_PARAM === "1";

export const DEMO_LATENCY_MS = {
  list: 140,
  detail: 160,
  mutate: 220,
} as const;

export const STAGE_MODEL_DURATION_SECONDS = {
  STAGE1: 18,
  STAGE2: 35,
  STAGE3: 45,
} as const;
