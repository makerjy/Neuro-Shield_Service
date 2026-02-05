export const formatNumber = (value: number) => {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
};

export const formatPercent = (value: number, digits = 1) => {
  return `${value.toFixed(digits)}%`;
};

export const formatSignedPercent = (value: number, digits = 1) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
};

export const formatMinutes = (value: number) => {
  return `${value.toFixed(1)}분`;
};

export const formatScore = (value: number) => {
  return `${Math.round(value)}점`;
};

export const formatCount = (value: number) => {
  return `${formatNumber(value)}건`;
};

/* ─────────────────────────────────────────────────────────────
   시간 포맷터 (MM:SS 형식)
───────────────────────────────────────────────────────────── */
export const formatTimeMMSS = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatSignedTimeMMSS = (seconds: number) => {
  const sign = seconds >= 0 ? '+' : '-';
  const absSeconds = Math.abs(seconds);
  const mins = Math.floor(absSeconds / 60);
  const secs = Math.round(absSeconds % 60);
  return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
};

/* ─────────────────────────────────────────────────────────────
   대형 숫자 포맷터 (1K, 10K, 1M 등)
───────────────────────────────────────────────────────────── */
export const formatCompactNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}만`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

/* ─────────────────────────────────────────────────────────────
   KPI 값 포맷터 (단위별 자동)
───────────────────────────────────────────────────────────── */
export const formatKPIValue = (value: number, unit: string, decimals: number = 1): string => {
  switch (unit) {
    case '%':
      return `${value.toFixed(decimals)}%`;
    case '건':
      return `${formatNumber(value)}건`;
    case '일':
      return `${value.toFixed(decimals)}일`;
    case '분':
      return `${value.toFixed(decimals)}분`;
    case '명':
      return `${formatNumber(value)}명`;
    case '원':
      return `${formatNumber(value)}원`;
    default:
      return value.toLocaleString();
  }
};
