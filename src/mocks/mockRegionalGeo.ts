export type RegionOption = {
  code: string;
  label: string;
};

export const REGIONAL_SCOPE = {
  id: 'regional-01',
  name: '세종',
  label: '세종',
  ctprvnCode: '29'
};

export const REGIONAL_SIGUNGU: RegionOption[] = [
  { code: '29010', label: '한솔' },
  { code: '29020', label: '나성' },
  { code: '29030', label: '도담' },
  { code: '29040', label: '조치원' },
  { code: '29050', label: '연기' }
];

export const REGIONAL_EMD_BY_SIGUNGU: Record<string, RegionOption[]> = {
  '29010': [
    { code: '2901001', label: '한솔1' },
    { code: '2901002', label: '한솔2' }
  ],
  '29020': [
    { code: '2902001', label: '나성1' },
    { code: '2902002', label: '나성2' }
  ],
  '29030': [
    { code: '2903001', label: '도담1' },
    { code: '2903002', label: '도담2' }
  ],
  '29040': [
    { code: '2904001', label: '조치원1' },
    { code: '2904002', label: '조치원2' }
  ],
  '29050': [
    { code: '2905001', label: '연기1' },
    { code: '2905002', label: '연기2' }
  ]
};

export const getSigunguOptions = () => REGIONAL_SIGUNGU;

export const getEmdOptions = (sigunguCode: string) => REGIONAL_EMD_BY_SIGUNGU[sigunguCode] ?? [];

export const findSigunguLabel = (code?: string) => {
  if (!code) return '';
  return REGIONAL_SIGUNGU.find((item) => item.code === code)?.label ?? '';
};

export const findEmdLabel = (code?: string) => {
  if (!code) return '';
  const keys = Object.keys(REGIONAL_EMD_BY_SIGUNGU);
  for (const key of keys) {
    const match = REGIONAL_EMD_BY_SIGUNGU[key].find((item) => item.code === code);
    if (match) return match.label;
  }
  return '';
};

export const findSigunguByEmd = (emdCode?: string) => {
  if (!emdCode) return undefined;
  const keys = Object.keys(REGIONAL_EMD_BY_SIGUNGU);
  return keys.find((key) => emdCode.startsWith(key));
};
