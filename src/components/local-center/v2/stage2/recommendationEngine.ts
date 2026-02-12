import type { CaseDetailResponse, OpsRecommendationResponse } from "./apiContracts";

function rationaleBase(text: string) {
  return `${text} · 의료진 확인 전 / 담당자 검토 필요`;
}

export function buildOpsRecommendations(caseData: CaseDetailResponse): OpsRecommendationResponse {
  const items: OpsRecommendationResponse["items"] = [];

  if (caseData.operations.referral.status === "미생성") {
    items.push({
      id: "rec-ref-create",
      priority: 1,
      title: "운영 권고(참고): 의뢰서 준비",
      rationale: rationaleBase("2차 단계 진행 기준으로 의뢰서 생성이 필요합니다"),
      actions: [{ key: "CREATE_REFERRAL", label: "의뢰서 생성" }],
    });
  }

  if (caseData.operations.referral.status === "생성됨") {
    items.push({
      id: "rec-ref-send",
      priority: 1,
      title: "운영 권고(참고): 의뢰서 전송",
      rationale: rationaleBase("생성된 의뢰서를 연계 기관으로 전달해 후속 대기를 줄입니다"),
      actions: [{ key: "SEND_REFERRAL", label: "의뢰서 전송" }],
    });
  }

  if (caseData.operations.appointment.status === "미정" || caseData.operations.appointment.status === "요청") {
    items.push({
      id: "rec-apt-track",
      priority: 2,
      title: "운영 권고(참고): 예약 현황 점검",
      rationale: rationaleBase("연계 이후 예약 진행 상태를 점검하고 일정 지연을 방지합니다"),
      actions: [{ key: "TRACK_APPOINTMENT", label: "예약 현황 추적" }],
    });
  }

  if (caseData.stage2.mciSignal === "주의") {
    items.push({
      id: "rec-mci-pet-mri",
      priority: 1,
      title: "추가 정밀 확인 권고(참고)",
      rationale: rationaleBase("인지 위험 신호가 주의로 표시되어 PET 또는 MRI 검사 가능 여부 확인이 필요합니다"),
      actions: [{ key: "TRACK_APPOINTMENT", label: "PET 또는 MRI 검사 가능 여부 확인" }],
    });
  }

  if (caseData.stage1.retrigger.enabled) {
    items.push({
      id: "rec-trigger-review",
      priority: 2,
      title: "운영 권고(참고): 재평가 트리거 점검",
      rationale: rationaleBase(
        caseData.stage1.retrigger.reason
          ? `재평가 트리거 사유(${caseData.stage1.retrigger.reason})를 기준으로 우선순위를 재정렬합니다`
          : "재평가 트리거 상태를 기준으로 후속 작업 순서를 재정렬합니다"
      ),
      actions: [{ key: "REQUEST_SUPPORT", label: "운영 지원 요청" }],
    });
  }

  if (items.length === 0) {
    items.push({
      id: "rec-default",
      priority: 3,
      title: "운영 권고(참고): 현 상태 유지 점검",
      rationale: rationaleBase("현재 기록은 안정 구간으로 보이며 주간 점검 리듬을 유지합니다"),
      actions: [{ key: "REQUEST_SUPPORT", label: "운영 지원 요청" }],
    });
  }

  items.sort((a, b) => a.priority - b.priority);

  return {
    generatedAt: new Date().toISOString(),
    items,
  };
}
