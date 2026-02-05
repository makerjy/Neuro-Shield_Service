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
