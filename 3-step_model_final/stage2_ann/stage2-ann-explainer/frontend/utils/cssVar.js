(function initCssVarUtils(globalObj) {
  const cssVar = (name, fallback) => {
    if (typeof window === "undefined") return fallback || "";
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback || "";
  };

  const chartPalette = () => [
    cssVar("--chart-1"),
    cssVar("--chart-2"),
    cssVar("--chart-3"),
    cssVar("--chart-4"),
    cssVar("--chart-5"),
  ];

  globalObj.cssVar = cssVar;
  globalObj.chartPalette = chartPalette;
})(window);
