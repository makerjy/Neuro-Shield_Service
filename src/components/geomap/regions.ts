export type RegionalScope = {
  id: string;
  name: string;
  label: string;
  ctprvnCode: string;
};

export const REGIONAL_SCOPES: RegionalScope[] = [
  { id: 'seoul', name: '서울', label: '서울특별시', ctprvnCode: '11' },
  { id: 'busan', name: '부산', label: '부산광역시', ctprvnCode: '21' },
  { id: 'daegu', name: '대구', label: '대구광역시', ctprvnCode: '22' },
  { id: 'incheon', name: '인천', label: '인천광역시', ctprvnCode: '23' },
  { id: 'gwangju', name: '광주', label: '광주광역시', ctprvnCode: '24' },
  { id: 'daejeon', name: '대전', label: '대전광역시', ctprvnCode: '25' },
  { id: 'ulsan', name: '울산', label: '울산광역시', ctprvnCode: '26' },
  { id: 'sejong', name: '세종', label: '세종특별자치시', ctprvnCode: '29' },
  { id: 'gyeonggi', name: '경기', label: '경기도', ctprvnCode: '31' },
  { id: 'gangwon', name: '강원', label: '강원도', ctprvnCode: '32' },
  { id: 'chungbuk', name: '충북', label: '충청북도', ctprvnCode: '33' },
  { id: 'chungnam', name: '충남', label: '충청남도', ctprvnCode: '34' },
  { id: 'jeonbuk', name: '전북', label: '전라북도', ctprvnCode: '35' },
  { id: 'jeonnam', name: '전남', label: '전라남도', ctprvnCode: '36' },
  { id: 'gyeongbuk', name: '경북', label: '경상북도', ctprvnCode: '37' },
  { id: 'gyeongnam', name: '경남', label: '경상남도', ctprvnCode: '38' },
  { id: 'jeju', name: '제주', label: '제주특별자치도', ctprvnCode: '39' }
];

export function resolveRegionFromName(centerName?: string): RegionalScope {
  if (!centerName) return REGIONAL_SCOPES[0];
  const match = REGIONAL_SCOPES.find(
    (region) => centerName.includes(region.name) || centerName.includes(region.label)
  );
  return match ?? REGIONAL_SCOPES[0];
}
