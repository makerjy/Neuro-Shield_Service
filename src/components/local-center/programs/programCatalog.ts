/* ═══════════════════════════════════════════════════════════════════════════
   프로그램 분류 체계(Taxonomy) 상수 — 확장 가능한 구조
   대주제 4개(건강/일상생활/안전/가족) × 중주제 × 소분류
═══════════════════════════════════════════════════════════════════════════ */
import type { ProgramTaxonomyItem, TopCategory } from "./programTypes";

export const TOP_CATEGORIES: TopCategory[] = ["건강", "일상생활", "안전", "가족"];

export const TOP_CATEGORY_META: Record<TopCategory, { icon: string; color: string; desc: string }> = {
  "건강":    { icon: "Heart",     color: "#ef4444", desc: "신체건강·인지건강·영양·운동 프로그램" },
  "일상생활": { icon: "Home",      color: "#3b82f6", desc: "일상활동 지원·보조기기·생활환경 개선" },
  "안전":    { icon: "Shield",    color: "#f59e0b", desc: "낙상예방·배회감지·안전환경·응급연계" },
  "가족":    { icon: "Users",     color: "#8b5cf6", desc: "보호자 교육·돌봄부담 경감·가족상담" },
};

/**
 * 프로그램 카탈로그 상수.
 * 실서비스에서는 API로 로딩하지만, MVP에서는 이 상수를 사용한다.
 * 총 40개 이상 샘플 → 검색/가상화 테스트에 충분한 양.
 */
export const PROGRAM_CATALOG: ProgramTaxonomyItem[] = [
  // ═══ 건강 ═══
  // 신체건강
  { top: "건강", mid: "신체건강", sub: "만성질환 관리", code: "H-PH-001", label: "만성질환 복합관리 프로그램",           keywords: ["고혈압","당뇨","복합","만성"], stageFit: [2,3], mciSeverityFit: ["양호","중등","중증"], dementiaFit: true },
  { top: "건강", mid: "신체건강", sub: "운동 치료",     code: "H-PH-002", label: "맞춤형 운동 처방(주 3회 그룹)",       keywords: ["운동","그룹","처방","재활"], stageFit: [2,3], mciSeverityFit: ["양호","중등"], dementiaFit: false },
  { top: "건강", mid: "신체건강", sub: "운동 치료",     code: "H-PH-003", label: "재가 운동 키트 안내",                 keywords: ["재가","운동","키트","홈"], stageFit: [2], mciSeverityFit: ["양호"], dementiaFit: false },
  { top: "건강", mid: "신체건강", sub: "영양 관리",     code: "H-PH-004", label: "영양 상담 및 식단 안내",              keywords: ["영양","식단","상담","식사"], stageFit: [2,3], mciSeverityFit: ["양호","중등","중증"], dementiaFit: true },
  { top: "건강", mid: "신체건강", sub: "영양 관리",     code: "H-PH-005", label: "경관영양 연계(중증 대상)",            keywords: ["경관","영양","중증"], stageFit: [3], mciSeverityFit: ["중증"], dementiaFit: true },
  // 인지건강
  { top: "건강", mid: "인지건강", sub: "인지훈련",       code: "H-CG-001", label: "인지자극 그룹 프로그램(8주)",         keywords: ["인지","자극","그룹","8주"], stageFit: [2,3], mciSeverityFit: ["양호","중등"], dementiaFit: false },
  { top: "건강", mid: "인지건강", sub: "인지훈련",       code: "H-CG-002", label: "디지털 인지훈련 앱 안내",             keywords: ["디지털","앱","인지","훈련"], stageFit: [2], mciSeverityFit: ["양호"], dementiaFit: false },
  { top: "건강", mid: "인지건강", sub: "인지훈련",       code: "H-CG-003", label: "개별 인지재활 치료(1:1)",             keywords: ["개별","인지","재활","1:1"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },
  { top: "건강", mid: "인지건강", sub: "정서 지원",     code: "H-CG-004", label: "우울·불안 선별 및 상담 연계",          keywords: ["우울","불안","정서","상담"], stageFit: [2,3], mciSeverityFit: ["양호","중등","중증"], dementiaFit: true },
  { top: "건강", mid: "인지건강", sub: "정서 지원",     code: "H-CG-005", label: "음악/미술 치료 프로그램",              keywords: ["음악","미술","치료","예술"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },
  // 정밀진료
  { top: "건강", mid: "정밀진료", sub: "바이오마커",     code: "H-PR-001", label: "치매 바이오마커 검사 안내",           keywords: ["바이오마커","검사","정밀"], stageFit: [3], dementiaFit: true },
  { top: "건강", mid: "정밀진료", sub: "뇌영상",         code: "H-PR-002", label: "뇌 MRI/PET 촬영 연계",              keywords: ["MRI","PET","뇌영상"], stageFit: [3], dementiaFit: true },
  { top: "건강", mid: "정밀진료", sub: "전문의 진료",   code: "H-PR-003", label: "신경과 전문의 진료 예약 지원",        keywords: ["신경과","전문의","진료","예약"], stageFit: [2,3], dementiaFit: true },

  // ═══ 일상생활 ═══
  { top: "일상생활", mid: "일상활동 지원", sub: "가사 지원",   code: "L-DA-001", label: "가사 도우미 서비스 연계",           keywords: ["가사","도우미","청소","식사준비"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },
  { top: "일상생활", mid: "일상활동 지원", sub: "이동 지원",   code: "L-DA-002", label: "이동 지원 서비스(교통편의)",        keywords: ["이동","교통","외출","택시"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },
  { top: "일상생활", mid: "일상활동 지원", sub: "식사 지원",   code: "L-DA-003", label: "경로식당 / 도시락 배달 안내",       keywords: ["식사","경로식당","도시락","배달"], stageFit: [2,3], mciSeverityFit: ["양호","중등","중증"], dementiaFit: true },
  { top: "일상생활", mid: "보조기기",       sub: "인지보조",   code: "L-AD-001", label: "인지보조 기기 안내(알람/리마인더)", keywords: ["보조기기","알람","리마인더","인지"], stageFit: [2,3], mciSeverityFit: ["양호","중등"], dementiaFit: false },
  { top: "일상생활", mid: "보조기기",       sub: "이동보조",   code: "L-AD-002", label: "이동보조 기기 대여/안내",           keywords: ["이동보조","보행기","대여"], stageFit: [3], mciSeverityFit: ["중증"], dementiaFit: true },
  { top: "일상생활", mid: "생활환경",       sub: "주거 개선",  code: "L-EN-001", label: "주거 환경 안전점검 방문",           keywords: ["주거","환경","안전점검","방문"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },
  { top: "일상생활", mid: "생활환경",       sub: "주거 개선",  code: "L-EN-002", label: "주택 개보수 지원 연계",             keywords: ["개보수","주택","지원"], stageFit: [3], mciSeverityFit: ["중증"], dementiaFit: true },
  { top: "일상생활", mid: "사회참여",       sub: "여가활동",   code: "L-SP-001", label: "주간보호센터 이용 안내",            keywords: ["주간보호","센터","여가"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },
  { top: "일상생활", mid: "사회참여",       sub: "여가활동",   code: "L-SP-002", label: "지역사회 여가 프로그램 안내",       keywords: ["여가","지역사회","프로그램"], stageFit: [2], mciSeverityFit: ["양호","중등"], dementiaFit: false },

  // ═══ 안전 ═══
  { top: "안전", mid: "낙상예방", sub: "운동",         code: "S-FA-001", label: "낙상 예방 운동 프로그램",               keywords: ["낙상","예방","운동","균형"], stageFit: [2,3], mciSeverityFit: ["양호","중등","중증"], dementiaFit: true },
  { top: "안전", mid: "낙상예방", sub: "환경개선",     code: "S-FA-002", label: "낙상 위험 환경 점검 방문",               keywords: ["낙상","환경","점검","방문"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },
  { top: "안전", mid: "배회감지", sub: "기기",         code: "S-WA-001", label: "배회감지기 보급/안내",                   keywords: ["배회","감지기","GPS","위치"], stageFit: [3], mciSeverityFit: ["중증"], dementiaFit: true },
  { top: "안전", mid: "배회감지", sub: "지역연계",     code: "S-WA-002", label: "실종 예방 지문 사전등록",                keywords: ["실종","지문","등록","예방"], stageFit: [2,3], mciSeverityFit: ["중증"], dementiaFit: true },
  { top: "안전", mid: "응급연계", sub: "119연계",      code: "S-EM-001", label: "119 안심콜 등록",                        keywords: ["119","안심콜","응급","등록"], stageFit: [2,3], mciSeverityFit: ["양호","중등","중증"], dementiaFit: true },
  { top: "안전", mid: "응급연계", sub: "응급키트",     code: "S-EM-002", label: "응급 안전 키트 비치 안내",               keywords: ["응급","키트","안전","비치"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },
  { top: "안전", mid: "약물안전", sub: "복약관리",     code: "S-ME-001", label: "복약 관리 안내(약상자/알람)",            keywords: ["복약","약물","알람","약상자"], stageFit: [2,3], mciSeverityFit: ["양호","중등","중증"], dementiaFit: true },
  { top: "안전", mid: "약물안전", sub: "복약관리",     code: "S-ME-002", label: "다약제 복용 위험 점검 연계",            keywords: ["다약제","위험","점검"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },

  // ═══ 가족 ═══
  { top: "가족", mid: "보호자 교육", sub: "치매 이해",    code: "F-ED-001", label: "보호자 치매 이해 교육(1회)",           keywords: ["보호자","교육","치매","이해"], stageFit: [2,3], mciSeverityFit: ["양호","중등","중증"], dementiaFit: true },
  { top: "가족", mid: "보호자 교육", sub: "돌봄 기술",    code: "F-ED-002", label: "돌봄 기술 실습 교육(2회)",             keywords: ["돌봄","기술","실습","교육"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },
  { top: "가족", mid: "보호자 교육", sub: "온라인 교육",  code: "F-ED-003", label: "온라인 보호자 교육 콘텐츠 안내",      keywords: ["온라인","교육","콘텐츠"], stageFit: [2,3], mciSeverityFit: ["양호","중등"], dementiaFit: false },
  { top: "가족", mid: "돌봄부담 경감", sub: "쉼 서비스",  code: "F-RC-001", label: "돌봄 쉼 서비스(일시보호)",             keywords: ["쉼","일시보호","휴식","돌봄부담"], stageFit: [2,3], mciSeverityFit: ["중등","중증"], dementiaFit: true },
  { top: "가족", mid: "돌봄부담 경감", sub: "쉼 서비스",  code: "F-RC-002", label: "돌봄자 힐링 프로그램",                 keywords: ["힐링","돌봄자","스트레스"], stageFit: [2,3], mciSeverityFit: ["양호","중등","중증"], dementiaFit: true },
  { top: "가족", mid: "가족상담",     sub: "심리상담",    code: "F-CO-001", label: "가족 심리상담 서비스",                 keywords: ["심리상담","가족","상담"], stageFit: [2,3], mciSeverityFit: ["양호","중등","중증"], dementiaFit: true },
  { top: "가족", mid: "가족상담",     sub: "법률상담",    code: "F-CO-002", label: "성년후견/법률 상담 연계",              keywords: ["성년후견","법률","상담","후견"], stageFit: [3], mciSeverityFit: ["중증"], dementiaFit: true },
  { top: "가족", mid: "치매지원서비스", sub: "장기요양",   code: "F-DS-001", label: "장기요양등급 신청 안내/지원",          keywords: ["장기요양","등급","신청"], stageFit: [3], dementiaFit: true },
  { top: "가족", mid: "치매지원서비스", sub: "경제지원",   code: "F-DS-002", label: "치매치료관리비 지원 안내",            keywords: ["치료관리비","경제","지원"], stageFit: [2,3], dementiaFit: true },
  { top: "가족", mid: "치매지원서비스", sub: "경제지원",   code: "F-DS-003", label: "치매 공공후견 지원 안내",             keywords: ["공공후견","지원","후견"], stageFit: [3], dementiaFit: true },
];

/* ─── 유틸 함수 ─── */

/** 대주제별 중주제 목록 */
export function getMidCategories(top: TopCategory): string[] {
  const set = new Set<string>();
  for (const item of PROGRAM_CATALOG) {
    if (item.top === top) set.add(item.mid);
  }
  return Array.from(set);
}

/** 대주제+중주제별 소분류 항목 목록 */
export function getSubItems(top: TopCategory, mid: string): ProgramTaxonomyItem[] {
  return PROGRAM_CATALOG.filter(item => item.top === top && item.mid === mid);
}

/** 키워드/라벨/코드로 검색 */
export function searchPrograms(query: string): ProgramTaxonomyItem[] {
  if (!query.trim()) return PROGRAM_CATALOG;
  const q = query.toLowerCase().trim();
  return PROGRAM_CATALOG.filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.code.toLowerCase().includes(q) ||
    item.keywords.some(k => k.toLowerCase().includes(q)) ||
    item.mid.toLowerCase().includes(q) ||
    item.sub.toLowerCase().includes(q)
  );
}
