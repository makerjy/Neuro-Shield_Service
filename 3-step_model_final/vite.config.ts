import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBasePath(path?: string) {
  if (!path || !path.trim()) return "/3-step-model/";
  let normalized = path.trim();
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (!normalized.endsWith("/")) normalized = `${normalized}/`;
  return normalized;
}

export default defineConfig({
  base: normalizeBasePath(process.env.THREE_STEP_MODEL_BASE_PATH || "/3-step-model/"),
  plugins: [react()],
});
