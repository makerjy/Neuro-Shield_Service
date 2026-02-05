export type RegionOption = {
  code: string;
  label: string;
};

export const SIDO_OPTIONS: RegionOption[] = [
  { code: 'all', label: '전국' },
  { code: '11', label: '서울' },
  { code: '26', label: '부산' },
  { code: '27', label: '대구' },
  { code: '29', label: '세종' },
  { code: '31', label: '경기' },
  { code: '41', label: '충북' },
  { code: '44', label: '전북' },
  { code: '46', label: '전남' },
  { code: '47', label: '경북' },
  { code: '48', label: '경남' },
  { code: '50', label: '제주' }
];

export const SIGUNGU_OPTIONS: Record<string, RegionOption[]> = {
  '11': [
    { code: '11010', label: '종로' },
    { code: '11020', label: '중구' },
    { code: '11030', label: '용산' },
    { code: '11040', label: '성동' }
  ],
  '26': [
    { code: '26010', label: '중구' },
    { code: '26020', label: '서구' },
    { code: '26030', label: '동구' },
    { code: '26040', label: '영도' }
  ],
  '29': [
    { code: '29010', label: '한솔' },
    { code: '29020', label: '나성' },
    { code: '29030', label: '도담' }
  ],
  '31': [
    { code: '31010', label: '수원' },
    { code: '31020', label: '성남' },
    { code: '31030', label: '용인' },
    { code: '31040', label: '고양' }
  ]
};

const makeSquare = (id: string, label: string, x: number, y: number) => ({
  type: 'Feature',
  id,
  properties: {
    code: id,
    name: label
  },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
        [x, y]
      ]
    ]
  }
});

export const MOCK_GEOJSON: Record<'nation' | 'sido' | 'sigungu', any> = {
  nation: {
    type: 'FeatureCollection',
    features: [makeSquare('all', '전국', 0, 0)]
  },
  sido: {
    type: 'FeatureCollection',
    features: [
      makeSquare('11', '서울', 0, 3),
      makeSquare('26', '부산', 2, 1),
      makeSquare('29', '세종', 1, 4),
      makeSquare('31', '경기', 1, 2),
      makeSquare('46', '전남', 0, 0)
    ]
  },
  sigungu: {
    type: 'FeatureCollection',
    features: [
      makeSquare('11010', '종로', 0, 3),
      makeSquare('11020', '중구', 1, 3),
      makeSquare('26010', '중구', 2, 1),
      makeSquare('29010', '한솔', 1, 4),
      makeSquare('31010', '수원', 1, 2)
    ]
  }
};
