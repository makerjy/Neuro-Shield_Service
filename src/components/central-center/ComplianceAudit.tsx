import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import {
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Rocket,
  Shield,
  User,
  XCircle,
} from 'lucide-react';
import type { TabContext } from '../../lib/useTabContext';
import {
  MOCK_POLICY_CHANGES,
  MOCK_UNIFIED_AUDIT,
  type PolicyChangeEvent,
  type UnifiedAuditEvent,
} from '../../mocks/mockCentralOps';

interface ComplianceAuditProps {
  context?: TabContext;
  onNavigate?: (page: string, ctx?: Partial<TabContext>) => void;
}

type TimelineCategory = 'regulation' | 'model' | 'policy';
type AuditFitStatus = '적합' | '주의' | '부적합';

interface TimelineItem {
  id: string;
  timestamp: string;
  category: TimelineCategory;
  title: string;
  owner: string;
  decisionLog: string;
  evidence: string;
  changeId?: string;
  auditId?: string;
  statusLabel: string;
}

interface AuditChecklistItem {
  id: string;
  itemName: string;
  stage: string;
  status: AuditFitStatus;
  nonComplianceCases: number;
  linkLabel: string;
  navPage: string;
  navContext?: Partial<TabContext>;
}

const TIMELINE_META: Record<
  TimelineCategory,
  { label: string; dotClass: string; badgeClass: string; icon: React.ReactNode }
> = {
  regulation: {
    label: '규정 변경',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  model: {
    label: '모델 변경',
    dotClass: 'bg-purple-500',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <Rocket className="h-3.5 w-3.5" />,
  },
  policy: {
    label: '정책 변경',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
  },
};

const AUDIT_STATUS_META: Record<AuditFitStatus, { cls: string }> = {
  적합: { cls: 'bg-green-50 text-green-700 border-green-200' },
  주의: { cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  부적합: { cls: 'bg-red-50 text-red-700 border-red-200' },
};

const SYSTEM_PROOF_ITEMS = [
  {
    question: 'AI가 최종 결정을 내렸는가?',
    answer: '아니오',
    detail: 'Stage1~3 모델은 보조 신호만 제공하며 승인 권한은 기관 담당자에게만 있습니다.',
    verdict: 'no' as const,
  },
  {
    question: '사람(기관)이 최종 결정을 내렸는가?',
    answer: '예',
    detail: '요청자/승인자/실행자 로그를 통해 의사결정 책임 주체를 추적할 수 있습니다.',
    verdict: 'yes' as const,
  },
  {
    question: '결정 근거가 감사 로그로 남아 있는가?',
    answer: '예',
    detail: '판단 사유와 정책/내부기준 참조가 함께 기록되어 외부 감사를 지원합니다.',
    verdict: 'yes' as const,
  },
];

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 100;
  return Math.round((numerator / denominator) * 100);
}

function classifyFitStatus(nonComplianceCases: number): AuditFitStatus {
  if (nonComplianceCases === 0) return '적합';
  if (nonComplianceCases === 1) return '주의';
  return '부적합';
}

function formatDate(dateValue: string): string {
  return new Date(dateValue).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toTimelineFromPolicy(change: PolicyChangeEvent): TimelineItem {
  const category: TimelineCategory = change.type === 'model_version' ? 'model' : 'regulation';
  const owner = change.approvedBy || change.deployedBy || '미지정';
  const decisionLog = `요청 ${change.requestedBy || '-'} / 승인 ${change.approvedBy || '미지정'} / 실행 ${change.deployedBy || '-'}`;

  return {
    id: `timeline-policy-${change.id}`,
    timestamp: change.deployedAt,
    category,
    title: change.title,
    owner,
    decisionLog,
    evidence: change.reason || change.description,
    changeId: change.id,
    statusLabel: change.status,
  };
}

function toTimelineFromAudit(event: UnifiedAuditEvent): TimelineItem {
  return {
    id: `timeline-audit-${event.id}`,
    timestamp: event.timestamp,
    category: 'policy',
    title: event.title,
    owner: event.approver || event.actor,
    decisionLog: `요청 ${event.requestor || '-'} / 승인 ${event.approver || '미지정'} / 실행 ${event.executor || '-'}`,
    evidence: event.rationale,
    changeId: event.relatedChangeId,
    auditId: event.id,
    statusLabel: event.status,
  };
}

export function ComplianceAudit({ context, onNavigate }: ComplianceAuditProps) {
  const [timelineFilter, setTimelineFilter] = useState<TimelineCategory | 'all'>('all');
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);
  const [showStageLogDetail, setShowStageLogDetail] = useState(false);

  const timeline = useMemo(() => {
    const policyTimeline = MOCK_POLICY_CHANGES.map(toTimelineFromPolicy);
    const auditPolicyTimeline = MOCK_UNIFIED_AUDIT.filter((event) => event.type === 'policy_change').map(toTimelineFromAudit);

    return [...policyTimeline, ...auditPolicyTimeline].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, []);

  const timelineFiltered = useMemo(() => {
    if (timelineFilter === 'all') return timeline;
    return timeline.filter((event) => event.category === timelineFilter);
  }, [timeline, timelineFilter]);

  useEffect(() => {
    if (!timeline.length) return;

    if (context?.auditId) {
      const fromAudit = timeline.find((item) => item.auditId === context.auditId);
      if (fromAudit) {
        setSelectedTimelineId(fromAudit.id);
        return;
      }
    }

    if (context?.changeId) {
      const fromChange = timeline.find((item) => item.changeId === context.changeId);
      if (fromChange) {
        setSelectedTimelineId(fromChange.id);
        return;
      }
    }

    setSelectedTimelineId((prev) => prev || timeline[0].id);
  }, [timeline, context?.auditId, context?.changeId]);

  useEffect(() => {
    if (!timelineFiltered.length) {
      setSelectedTimelineId(null);
      return;
    }

    const exists = timelineFiltered.some((item) => item.id === selectedTimelineId);
    if (!exists) setSelectedTimelineId(timelineFiltered[0].id);
  }, [timelineFiltered, selectedTimelineId]);

  const selectedTimeline = useMemo(
    () => timeline.find((item) => item.id === selectedTimelineId) || null,
    [timeline, selectedTimelineId],
  );

  const stageLogMetrics = useMemo(() => {
    const totalEvents = MOCK_UNIFIED_AUDIT.length;

    const stage1 = MOCK_UNIFIED_AUDIT.filter(
      (event) => Boolean(event.cause) && event.kpiSnapshot.riskTop3.length > 0,
    ).length;
    const stage2 = MOCK_UNIFIED_AUDIT.filter(
      (event) => Boolean(event.requestor) && Boolean(event.approver) && Boolean(event.rationale),
    ).length;
    const stage3 = MOCK_UNIFIED_AUDIT.filter(
      (event) => Boolean(event.executor) && Boolean(event.approvalComment),
    ).length;

    const totalStageLogs = stage1 + stage2 + stage3;
    const expectedStageLogs = totalEvents * 3;

    return {
      stage1,
      stage2,
      stage3,
      totalEvents,
      rate: percent(totalStageLogs, expectedStageLogs),
    };
  }, []);

  const summary = useMemo(() => {
    const totalEvents = MOCK_UNIFIED_AUDIT.length;
    const ownerAssigned = MOCK_UNIFIED_AUDIT.filter((event) => Boolean(event.approver)).length;
    const rationaleAttached = MOCK_UNIFIED_AUDIT.filter(
      (event) => Boolean(event.rationale) && (Boolean(event.policyRef) || Boolean(event.internalStandardId)),
    ).length;
    const aiFinalDecisionCount = MOCK_UNIFIED_AUDIT.filter((event) =>
      /ai|모델 자동 판단/i.test(event.approver || ''),
    ).length;

    return {
      totalEvents,
      ownerAssigned,
      rationaleAttached,
      aiFinalDecisionCount,
      humanDecisionCount: ownerAssigned,
    };
  }, []);

  const auditChecklist = useMemo<AuditChecklistItem[]>(() => {
    const missingApproverEvents = MOCK_UNIFIED_AUDIT.filter((event) => !event.approver);
    const missingEvidenceEvents = MOCK_UNIFIED_AUDIT.filter(
      (event) => !event.rationale || (!event.policyRef && !event.internalStandardId),
    );
    const missingExecutorEvents = MOCK_UNIFIED_AUDIT.filter((event) => !event.executor);
    const unresolvedHighRisk = MOCK_UNIFIED_AUDIT.filter(
      (event) => event.type === 'violation' && event.severity === 'high' && event.status !== 'resolved',
    );
    const missingStageChainEvents = MOCK_UNIFIED_AUDIT.filter(
      (event) => !event.cause || !event.requestor || !event.approver || !event.executor,
    );

    const defaultChangeId = MOCK_POLICY_CHANGES[0]?.id;

    return [
      {
        id: 'owner',
        itemName: '최종 책임자(승인자) 명시',
        stage: 'Stage2',
        nonComplianceCases: missingApproverEvents.length,
        status: classifyFitStatus(missingApproverEvents.length),
        linkLabel: '누락 로그 보기',
        navPage: 'compliance-audit',
        navContext: missingApproverEvents[0] ? { auditId: missingApproverEvents[0].id } : undefined,
      },
      {
        id: 'evidence',
        itemName: '설명 근거(정책/기준) 첨부',
        stage: 'Stage2~3',
        nonComplianceCases: missingEvidenceEvents.length,
        status: classifyFitStatus(missingEvidenceEvents.length),
        linkLabel: '근거 이력 보기',
        navPage: 'model-governance',
        navContext: { changeId: missingEvidenceEvents[0]?.relatedChangeId || defaultChangeId },
      },
      {
        id: 'executor',
        itemName: '실행 주체(Executor) 로그 기록',
        stage: 'Stage3',
        nonComplianceCases: missingExecutorEvents.length,
        status: classifyFitStatus(missingExecutorEvents.length),
        linkLabel: '실행 로그 보기',
        navPage: 'compliance-audit',
        navContext: missingExecutorEvents[0] ? { auditId: missingExecutorEvents[0].id } : undefined,
      },
      {
        id: 'high-risk',
        itemName: '고위험 위반 즉시 조치 완료',
        stage: 'Stage3',
        nonComplianceCases: unresolvedHighRisk.length,
        status: classifyFitStatus(unresolvedHighRisk.length),
        linkLabel: '조치 이력 보기',
        navPage: 'compliance-audit',
        navContext: unresolvedHighRisk[0] ? { auditId: unresolvedHighRisk[0].id } : undefined,
      },
      {
        id: 'stage-chain',
        itemName: 'Stage1~3 연계 로그 완전성',
        stage: 'Stage1~3',
        nonComplianceCases: missingStageChainEvents.length,
        status: classifyFitStatus(missingStageChainEvents.length),
        linkLabel: '연계 로그 보기',
        navPage: 'compliance-audit',
        navContext: missingStageChainEvents[0] ? { auditId: missingStageChainEvents[0].id } : undefined,
      },
    ];
  }, []);

  const auditFitRate = useMemo(() => {
    const fitCount = auditChecklist.filter((item) => item.status === '적합').length;
    return percent(fitCount, auditChecklist.length);
  }, [auditChecklist]);

  const governanceMetrics = useMemo(
    () => [
      {
        label: '최종 책임자 명시율',
        value: `${percent(summary.ownerAssigned, summary.totalEvents)}%`,
        detail: `${summary.ownerAssigned}/${summary.totalEvents}건`,
      },
      {
        label: '설명 근거 첨부율',
        value: `${percent(summary.rationaleAttached, summary.totalEvents)}%`,
        detail: `${summary.rationaleAttached}/${summary.totalEvents}건`,
      },
      {
        label: '감사 적합률',
        value: `${auditFitRate}%`,
        detail: `${auditChecklist.filter((item) => item.status === '적합').length}/${auditChecklist.length} 항목`,
      },
      {
        label: 'Stage 로그 완전성',
        value: `${stageLogMetrics.rate}%`,
        detail: `S1 ${stageLogMetrics.stage1}/${stageLogMetrics.totalEvents} · S2 ${stageLogMetrics.stage2}/${stageLogMetrics.totalEvents} · S3 ${stageLogMetrics.stage3}/${stageLogMetrics.totalEvents}`,
      },
    ],
    [auditChecklist, auditFitRate, stageLogMetrics, summary],
  );

  return (
    <div className="space-y-5 p-1">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">규정 준수 및 감사</h1>
          <p className="text-xs text-gray-500 mt-1">
            외부 감사자가 이 화면만 보고도 사람의 최종 판단과 근거 로그를 확인할 수 있도록 구성했습니다.
          </p>
        </div>
        <Button size="sm" onClick={() => alert('감사 보고서 내보내기 (mock)')}>
          <Download className="h-4 w-4 mr-2" />
          감사 보고서 내보내기
        </Button>
      </div>

      <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 via-white to-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-bold text-gray-900">핵심 증명 질문</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {SYSTEM_PROOF_ITEMS.map((item) => (
            <ProofQuestionCard
              key={item.question}
              question={item.question}
              answer={item.answer}
              detail={item.detail}
              verdict={item.verdict}
            />
          ))}
        </div>
        <div className="mt-3 text-xs text-gray-600">
          AI 최종판단 기록{' '}
          <span className="font-semibold text-red-600">{summary.aiFinalDecisionCount}건</span> / 사람 승인 로그{' '}
          <span className="font-semibold text-blue-700">{summary.humanDecisionCount}건</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {governanceMetrics.map((metric) => (
          <GovernanceMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
          />
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-gray-900">책임 구조 시각화</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] items-center">
          <StageNode
            title="Stage1"
            subtitle="모델 신호 생성"
            description="모델은 위험/우선순위 신호만 제시합니다."
            badge="보조 신호"
            badgeClass="bg-gray-100 text-gray-700 border-gray-200"
          />
          <ArrowRight className="h-4 w-4 text-gray-400 justify-self-center hidden lg:block" />
          <StageNode
            title="Stage2"
            subtitle="기관 검토·승인"
            description="요청자/승인자 검토 후 사람이 최종 의사결정을 내립니다."
            badge="사람 판단"
            badgeClass="bg-blue-50 text-blue-700 border-blue-200"
          />
          <ArrowRight className="h-4 w-4 text-gray-400 justify-self-center hidden lg:block" />
          <StageNode
            title="Stage3"
            subtitle="기관 실행·감사"
            description="실행 주체와 사후 조치 로그를 남기고 감사 가능합니다."
            badge="기관 책임"
            badgeClass="bg-green-50 text-green-700 border-green-200"
          />
        </div>
        <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-sm font-semibold text-indigo-900">
            최종 판단 주체는 기관(사람)입니다. AI/모델은 보조 신호만 제공하며 승인 권한은 갖지 않습니다.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-900">감사 항목</h2>
          </div>
          <button
            onClick={() => setShowStageLogDetail((prev) => !prev)}
            className="text-xs text-gray-500 inline-flex items-center gap-1 hover:text-gray-700"
          >
            Stage 로그 기준
            {showStageLogDetail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {showStageLogDetail && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            Stage1: 신호 생성 로그(cause, riskTop3) / Stage2: 요청·승인·근거 / Stage3: 실행·조치 코멘트
          </div>
        )}

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">감사 항목명</th>
                <th className="py-2 pr-3">적용 Stage</th>
                <th className="py-2 pr-3">상태</th>
                <th className="py-2 pr-3">미준수 케이스 수</th>
                <th className="py-2">개선 이력 링크</th>
              </tr>
            </thead>
            <tbody>
              {auditChecklist.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-2.5 pr-3 font-medium text-gray-900">{item.itemName}</td>
                  <td className="py-2.5 pr-3 text-gray-600">{item.stage}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${AUDIT_STATUS_META[item.status].cls}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-gray-700">{item.nonComplianceCases}건</td>
                  <td className="py-2.5">
                    <button
                      onClick={() => onNavigate?.(item.navPage, item.navContext)}
                      className="text-xs inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {item.linkLabel}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-900">통합 감사 타임라인</h2>
          </div>
          <div className="flex items-center gap-2">
            <TimelineFilterButton label="전체" active={timelineFilter === 'all'} onClick={() => setTimelineFilter('all')} />
            <TimelineFilterButton
              label="규정 변경"
              active={timelineFilter === 'regulation'}
              onClick={() => setTimelineFilter('regulation')}
            />
            <TimelineFilterButton
              label="모델 변경"
              active={timelineFilter === 'model'}
              onClick={() => setTimelineFilter('model')}
            />
            <TimelineFilterButton
              label="정책 변경"
              active={timelineFilter === 'policy'}
              onClick={() => setTimelineFilter('policy')}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
          <div className="relative max-h-[420px] overflow-y-auto pr-1">
            <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-gray-200" />
            {timelineFiltered.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">표시할 타임라인 이벤트가 없습니다.</div>
            ) : (
              <div className="space-y-1.5">
                {timelineFiltered.map((event) => {
                  const isSelected = event.id === selectedTimelineId;
                  const meta = TIMELINE_META[event.category];
                  return (
                    <button
                      key={event.id}
                      onClick={() => setSelectedTimelineId(event.id)}
                      className={`relative w-full text-left pl-8 pr-3 py-2.5 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <div className={`absolute left-[5px] top-3.5 w-3 h-3 rounded-full ${meta.dotClass}`} />
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border ${meta.badgeClass}`}>
                          {meta.icon}
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-gray-400">{formatDate(event.timestamp)}</span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900 leading-snug">{event.title}</div>
                      <div className="mt-1 text-[11px] text-gray-500">책임자: {event.owner}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            {!selectedTimeline ? (
              <div className="h-[240px] rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-400">
                타임라인 이벤트를 선택하면 증명 근거를 확인할 수 있습니다.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border ${TIMELINE_META[selectedTimeline.category].badgeClass}`}
                    >
                      {TIMELINE_META[selectedTimeline.category].icon}
                      {TIMELINE_META[selectedTimeline.category].label}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(selectedTimeline.timestamp)}</span>
                  </div>
                  <h3 className="mt-2 text-base font-bold text-gray-900">{selectedTimeline.title}</h3>
                  <p className="mt-1 text-xs text-gray-600">상태: {selectedTimeline.statusLabel}</p>
                </div>

                <DetailBlock icon={<User className="h-4 w-4 text-blue-600" />} title="최종 책임자">
                  <p className="text-sm font-semibold text-gray-900">{selectedTimeline.owner}</p>
                </DetailBlock>

                <DetailBlock icon={<CheckCircle className="h-4 w-4 text-green-600" />} title="의사결정 로그">
                  <p className="text-sm text-gray-800 leading-relaxed">{selectedTimeline.decisionLog}</p>
                </DetailBlock>

                <DetailBlock icon={<FileText className="h-4 w-4 text-indigo-600" />} title="판단 근거">
                  <p className="text-sm text-gray-800 leading-relaxed">{selectedTimeline.evidence}</p>
                </DetailBlock>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-900">
                    감사 포인트: 본 이벤트는 모델 출력이 아니라 사람의 승인/집행 로그로 최종 판단이 확정되었습니다.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  {selectedTimeline.changeId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-blue-700"
                      onClick={() => onNavigate?.('model-governance', { changeId: selectedTimeline.changeId })}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      변경 관리 이동
                    </Button>
                  )}
                  {selectedTimeline.auditId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => onNavigate?.('compliance-audit', { auditId: selectedTimeline.auditId })}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      감사 로그 이동
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProofQuestionCard({
  question,
  answer,
  detail,
  verdict,
}: {
  question: string;
  answer: string;
  detail: string;
  verdict: 'yes' | 'no';
}) {
  return (
    <div className={`rounded-lg border p-3 ${verdict === 'yes' ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
      <div className="flex items-center gap-2 mb-1">
        {verdict === 'yes' ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
        <span className="text-xs font-semibold text-gray-700">{question}</span>
      </div>
      <p className={`text-sm font-bold ${verdict === 'yes' ? 'text-green-700' : 'text-red-700'}`}>{answer}</p>
      <p className="mt-1 text-xs text-gray-600 leading-relaxed">{detail}</p>
    </div>
  );
}

function GovernanceMetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-[11px] text-gray-500 mt-1">{detail}</p>
    </div>
  );
}

function StageNode({
  title,
  subtitle,
  description,
  badge,
  badgeClass,
}: {
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  badgeClass: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-700">{title}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeClass}`}>{badge}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900 mt-1">{subtitle}</p>
      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{description}</p>
    </div>
  );
}

function TimelineFilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded border transition-colors ${
        active ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

function DetailBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-semibold text-gray-700">{title}</span>
      </div>
      {children}
    </div>
  );
}
