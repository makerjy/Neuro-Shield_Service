/* ═══════════════════════════════════════════════════════════════════════════
   추천 엔진 — Rule 기반 + RAG 인터페이스
   "운영 가이드 참고" 수준의 추천. AI가 판단/진단 표현 금지.
═══════════════════════════════════════════════════════════════════════════ */
import type { RecommendationItem, StageContext } from "./programTypes";
import { PROGRAM_CATALOG } from "./programCatalog";

/* ─── (A) Rule 기반 추천 ─── */
export function getRuleBasedRecommendations(ctx: StageContext): RecommendationItem[] {
  const results: RecommendationItem[] = [];

  if (ctx.stage === 2) {
    if (ctx.resultLabel === "MCI") {
      // MCI 세부분류 기반
      if (ctx.mciSeverity === "양호") {
        addByCode(results, "H-PH-002", "rule", "높음", "MCI 양호 단계에서 신체건강 중심 관리 운영 가이드 참고");
        addByCode(results, "H-CG-001", "rule", "보통", "인지자극 그룹 활동은 MCI 양호 단계에서 검토 필요");
        addByCode(results, "S-ME-001", "rule", "보통", "복약 관리 안내는 MCI 전 단계 공통 검토 항목");
      } else if (ctx.mciSeverity === "중등") {
        addByCode(results, "H-CG-003", "rule", "높음", "MCI 중등 단계: 개별 인지재활 치료 검토 필요 (운영 가이드 참고)");
        addByCode(results, "H-PH-004", "rule", "높음", "영양 상담은 인지건강 유지에 도움 — 운영 가이드 참고");
        addByCode(results, "F-ED-001", "rule", "보통", "보호자 교육은 MCI 중등 이상 권장 (운영 가이드 참고)");
        addByCode(results, "L-DA-001", "rule", "보통", "일상활동 지원 필요 여부 담당자 확인 필요");
      } else if (ctx.mciSeverity === "중증") {
        addByCode(results, "H-CG-003", "rule", "높음", "MCI 중증: 개별 인지재활 + 개입 강도 상향 검토 필요");
        addByCode(results, "H-CG-005", "rule", "높음", "음악/미술 치료 프로그램 병행 검토 (운영 가이드 참고)");
        addByCode(results, "F-ED-002", "rule", "높음", "돌봄 기술 실습 교육 — 보호자 대상 필수 검토");
        addByCode(results, "S-FA-001", "rule", "보통", "낙상 예방 운동 — 중증 MCI 공통 검토 항목");
        addByCode(results, "F-RC-001", "rule", "보통", "돌봄 쉼 서비스 — 보호자 부담 경감 목적 검토 필요");
      }
      // riskTags 반영
      if (ctx.riskTags.includes("낙상")) {
        addByCode(results, "S-FA-002", "rule", "높음", "낙상 위험 태그 확인됨 — 환경 점검 방문 검토 필요");
      }
      if (ctx.riskTags.includes("배회")) {
        addByCode(results, "S-WA-001", "rule", "높음", "배회 위험 태그 — 배회감지기 보급 검토 필요");
      }
      if (ctx.riskTags.includes("보호자부담")) {
        addByCode(results, "F-RC-001", "rule", "높음", "보호자 부담 태그 — 쉼 서비스 우선 검토 필요");
      }
    } else if (ctx.resultLabel === "치매") {
      addByCode(results, "H-PR-003", "rule", "높음", "치매 결과 — 전문의 진료 예약 지원 검토 필요");
      addByCode(results, "F-DS-001", "rule", "높음", "장기요양등급 신청 안내 검토 (운영 가이드 참고)");
      addByCode(results, "F-ED-002", "rule", "높음", "보호자 돌봄 기술 교육 검토 필요");
    }
  }

  if (ctx.stage === 3) {
    // Stage3: 정밀관리 패키지 기본 추천군
    addByCode(results, "H-PR-001", "rule", "높음", "Stage3 정밀관리 — 바이오마커 검사 안내 검토 (운영 가이드 참고)");
    addByCode(results, "H-PR-002", "rule", "높음", "뇌 MRI/PET 촬영 연계 검토 필요");
    addByCode(results, "H-CG-003", "rule", "높음", "개별 인지재활 치료 — 정밀 사례관리 핵심 항목");
    if (ctx.resultLabel === "치매") {
      addByCode(results, "F-DS-001", "rule", "높음", "치매 결과 — 장기요양등급 신청 안내 검토");
      addByCode(results, "F-DS-002", "rule", "높음", "치매치료관리비 지원 안내 검토 (운영 가이드 참고)");
    }
    if (ctx.riskTags.includes("독거")) {
      addByCode(results, "S-EM-001", "rule", "높음", "독거 태그 — 119 안심콜 등록 우선 검토 필요");
      addByCode(results, "L-DA-003", "rule", "보통", "독거 대상 식사 지원 검토 필요 (담당자 확인 필요)");
    }
    if (ctx.riskTags.includes("약물")) {
      addByCode(results, "S-ME-002", "rule", "높음", "약물 위험 태그 — 다약제 복용 위험 점검 연계 검토");
    }
  }

  // 중복 제거 후 최대 5개
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  }).slice(0, 5);
}

function addByCode(
  arr: RecommendationItem[],
  code: string,
  source: "rule" | "rag",
  confidence: "높음" | "보통" | "낮음",
  reason: string,
) {
  const item = PROGRAM_CATALOG.find(p => p.code === code);
  if (!item) return;
  arr.push({
    code: item.code,
    label: item.label,
    top: item.top,
    mid: item.mid,
    reasonSummary: reason,
    evidenceSnippets: [],
    source,
    confidenceLabel: confidence,
  });
}

/* ─── (B) RAG 기반 추천 (인터페이스 + 더미 구현) ─── */
export function getRagBasedRecommendations(ctx: StageContext): RecommendationItem[] {
  // 실서비스: RAG API 호출 → 프로그램 카탈로그/운영 가이드 문서에서 근거 스니펫 제공
  // MVP: 더미 데이터 반환
  const results: RecommendationItem[] = [];

  if (ctx.stage === 2 && ctx.resultLabel === "MCI" && ctx.mciSeverity === "중등") {
    const item = PROGRAM_CATALOG.find(p => p.code === "H-CG-004");
    if (item) {
      results.push({
        code: item.code,
        label: item.label,
        top: item.top,
        mid: item.mid,
        reasonSummary: "MCI 중등 단계 대상자 중 우울 선별이 필요한 경우가 높음 (운영 가이드 참고)",
        evidenceSnippets: [
          "「치매안심센터 운영 가이드」 3.2절: MCI 진단 후 정서 상태 선별검사를 실시하고, 필요 시 상담 연계를 검토한다.",
          "국가치매관리위원회 권고사항: 경도인지장애 대상자의 우울 동반율이 높아, 정서 지원 프로그램 연계 검토가 필요하다.",
        ],
        source: "rag",
        confidenceLabel: "보통",
      });
    }
  }

  if (ctx.stage === 3) {
    const item = PROGRAM_CATALOG.find(p => p.code === "F-CO-002");
    if (item) {
      results.push({
        code: item.code,
        label: item.label,
        top: item.top,
        mid: item.mid,
        reasonSummary: "Stage3 정밀관리 대상 중 법률 상담 필요 사례가 있음 (운영 가이드 참고)",
        evidenceSnippets: [
          "「치매 환자 권익보호 매뉴얼」: 정밀관리 대상의 재산관리·의료 동의 관련 법률 지원 필요 여부를 점검한다.",
        ],
        source: "rag",
        confidenceLabel: "낮음",
      });
    }
  }

  return results.slice(0, 3);
}

/** 통합 추천 (Rule + RAG, 중복 제거 후 최대 5개) */
export function getCombinedRecommendations(ctx: StageContext): RecommendationItem[] {
  const rule = getRuleBasedRecommendations(ctx);
  const rag = getRagBasedRecommendations(ctx);
  const seen = new Set(rule.map(r => r.code));
  const merged = [...rule];
  for (const r of rag) {
    if (!seen.has(r.code)) {
      seen.add(r.code);
      merged.push(r);
    }
  }
  return merged.slice(0, 5);
}
