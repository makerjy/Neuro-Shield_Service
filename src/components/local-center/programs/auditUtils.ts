/* ═══════════════════════════════════════════════════════════════════════════
   프로그램 제공(행정 실행) — 감사(Audit) 로그 유틸
═══════════════════════════════════════════════════════════════════════════ */
import type { AuditEvent, AuditEventType, RecommendationSource } from "./programTypes";

let _eventSeq = 0;

export function createAuditEvent(
  caseId: string,
  actorId: string,
  actorName: string,
  type: AuditEventType,
  payload: Record<string, unknown>,
  sourceMeta?: { source: RecommendationSource; code: string },
): AuditEvent {
  _eventSeq += 1;
  return {
    eventId: `AE-${Date.now()}-${_eventSeq}`,
    caseId,
    actorId,
    actorName,
    at: new Date().toISOString(),
    type,
    payload,
    sourceMeta,
  };
}

export const AUDIT_TYPE_LABEL: Record<AuditEventType, string> = {
  ADD_SELECTED: "프로그램 선택 추가",
  REMOVE_SELECTED: "프로그램 선택 제거",
  UPDATE_EXECUTION: "실행 상태 변경",
  PIN: "즐겨찾기 등록",
  UNPIN: "즐겨찾기 해제",
  ADD_FROM_RECO: "추천에서 선택 추가",
  HOLD_RECO: "추천 보류 처리",
  STATUS_CHANGE: "상태 변경",
};
