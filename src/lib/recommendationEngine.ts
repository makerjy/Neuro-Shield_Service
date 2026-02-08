/**
 * recommendationEngine.ts
 * ─────────────────────────────────────────────────────────
 * 병목 시그널 → AI 초안 InterventionPlan 자동 생성
 * 규칙:
 *   weakKpis에 "노쇼율" → PROCESS (리마인더/예약확인)
 *   "접촉률"|"이탈률" → TRAINING (초기 상담/재접촉 프로토콜)
 *   "연계 지연"       → PROCESS (연계 프로세스 단축/체크리스트)
 *   impact=HIGH       → priority=HIGH, durationDays=14
 *   impact=LOW        → 우수사례 확산/문서화 템플릿
 * ─────────────────────────────────────────────────────────
 */

import type { BottleneckSignal, InterventionPlan, InterventionType, Impact } from './interventionStore';
import { genId } from './interventionStore';

interface Template {
  type: InterventionType;
  title: string;
  description: string;
  trainingAction?: string;
  staffingAction?: string;
  processAction?: string;
}

function resolveTemplates(weakKpis: string[], impact: Impact): Template[] {
  const templates: Template[] = [];

  const lower = weakKpis.map(k => k.toLowerCase());

  if (lower.some(k => k.includes('노쇼'))) {
    templates.push({
      type: 'PROCESS',
      title: '노쇼 감소 — 리마인더·예약확인 강화',
      description: '방문 D-2/D-1 자동 리마인더 발송 + 예약 확인 콜 SOP 도입',
      processAction: '예약 확인 프로세스 자동화, 리마인더 발송 체크리스트 도입',
    });
  }

  if (lower.some(k => k.includes('접촉') || k.includes('이탈'))) {
    templates.push({
      type: 'TRAINING',
      title: '초기 상담·재접촉 프로토콜 교육',
      description: '접촉 실패/이탈 위험군에 대한 초기 상담 기술 강화 및 재접촉 프로토콜 교육',
      trainingAction: '초기 상담 기법 워크숍 (반일), 재접촉 시나리오 롤플레이 (반일)',
    });
  }

  if (lower.some(k => k.includes('연계'))) {
    templates.push({
      type: 'PROCESS',
      title: '연계 프로세스 단축·체크리스트',
      description: '연계 지연 구간을 식별하고, 체크리스트 기반 프로세스 단축 적용',
      processAction: '연계 프로세스 매핑 → 병목 제거 → 체크리스트 SOP 배포',
    });
  }

  // impact LOW → 우수사례 확산
  if (impact === 'LOW' || lower.some(k => k.includes('우수'))) {
    templates.push({
      type: 'PROCESS',
      title: '우수사례 문서화 및 타 센터 확산',
      description: '양호한 성과 프로세스를 문서화하여 타 센터 순회 교육으로 확산',
      processAction: '우수사례 인터뷰 → 문서화 → 순회 교육 2회',
    });
  }

  // impact HIGH + 인력 관련
  if (impact === 'HIGH' && lower.some(k => k.includes('이탈') || k.includes('접촉'))) {
    templates.push({
      type: 'STAFFING',
      title: '단기 인력 파견 (2주)',
      description: '인력 공백 또는 과부하 해소를 위한 단기 파견 인력 배치',
      staffingAction: '인력풀에서 상담사 1명 2주 단기 파견, 워크로드 재분배',
    });
  }

  // 최소 1개 보장
  if (templates.length === 0) {
    templates.push({
      type: 'TRAINING',
      title: '종합 역량 강화 교육',
      description: 'KPI 개선을 위한 종합 역량 강화 교육 실시',
      trainingAction: '상담 기법/케이스 관리 통합 교육 1일',
    });
  }

  return templates;
}

function durationFromImpact(impact: Impact): number {
  return impact === 'HIGH' ? 14 : impact === 'MEDIUM' ? 30 : 60;
}

/**
 * 병목 시그널 목록 → 초안 InterventionPlan 세트
 * existingPlans을 받아서 이미 관리자가 수정한 plan(ADMIN_EDIT / ADMIN_MANUAL)은
 * 재생성하지 않고, 새로운 초안만 추가함
 */
export function generateRecommendations(
  signals: BottleneckSignal[],
  region: string,
  existingPlans: InterventionPlan[] = [],
): InterventionPlan[] {
  const now = new Date().toISOString();
  const adminEditIds = new Set(
    existingPlans
      .filter(p => p.createdBy === 'ADMIN_EDIT' || p.createdBy === 'ADMIN_MANUAL')
      .map(p => p.linkedBottleneckId),
  );

  const newPlans: InterventionPlan[] = [];

  for (const sig of signals) {
    // 관리자가 이미 수정/추가한 센터의 병목은 건너뜀
    if (adminEditIds.has(sig.id)) continue;

    const templates = resolveTemplates(sig.weakKpis, sig.impact);
    for (const tpl of templates) {
      // 같은 센터 + 같은 type의 기존 AI DRAFT가 있으면 건너뜀
      const duplicate = existingPlans.find(
        p => p.centerId === sig.centerId && p.type === tpl.type && p.createdBy === 'AI' && p.status === 'DRAFT',
      );
      if (duplicate) continue;

      newPlans.push({
        id: genId('PLAN'),
        region,
        centerId: sig.centerId,
        centerName: sig.centerName,
        linkedBottleneckId: sig.id,
        linkedKpis: [...sig.weakKpis],
        type: tpl.type,
        title: `[${sig.centerName}] ${tpl.title}`,
        description: tpl.description,
        trainingAction: tpl.trainingAction,
        staffingAction: tpl.staffingAction,
        processAction: tpl.processAction,
        durationDays: durationFromImpact(sig.impact),
        priority: sig.impact,
        status: 'DRAFT',
        createdBy: 'AI',
        updatedAt: now,
      });
    }
  }

  return newPlans;
}
