export const cssVar = (name: string, fallback?: string) => {
  if (typeof window === "undefined") return fallback ?? "";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || (fallback ?? "");
};

export const chartPalette = () => ([
  cssVar("--chart-1", "#1e3a5f"),
  cssVar("--chart-2", "#3b82f6"),
  cssVar("--chart-3", "#6b7280"),
  cssVar("--chart-4", "#9ca3af"),
  cssVar("--chart-5", "#d1d5db"),
]);
