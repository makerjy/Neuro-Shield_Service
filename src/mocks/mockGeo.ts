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
  '27': [
    { code: '27010', label: '중구' },
    { code: '27020', label: '동구' },
    { code: '27030', label: '서구' },
    { code: '27040', label: '남구' }
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
  ],
  '41': [
    { code: '41010', label: '청주' },
    { code: '41020', label: '충주' },
    { code: '41030', label: '제천' },
    { code: '41040', label: '보은' }
  ],
  '44': [
    { code: '44010', label: '전주' },
    { code: '44020', label: '군산' },
    { code: '44030', label: '익산' },
    { code: '44040', label: '정읍' }
  ],
  '46': [
    { code: '46010', label: '목포' },
    { code: '46020', label: '여수' },
    { code: '46030', label: '순천' },
    { code: '46040', label: '나주' }
  ],
  '47': [
    { code: '47010', label: '포항' },
    { code: '47020', label: '경주' },
    { code: '47030', label: '김천' },
    { code: '47040', label: '안동' }
  ],
  '48': [
    { code: '48010', label: '창원' },
    { code: '48020', label: '진주' },
    { code: '48030', label: '통영' },
    { code: '48040', label: '김해' }
  ],
  '50': [
    { code: '50010', label: '제주시' },
    { code: '50020', label: '서귀포' }
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
