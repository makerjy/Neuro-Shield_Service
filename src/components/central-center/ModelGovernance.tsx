import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  AlertCircle, CheckCircle, Clock,
  ArrowUpRight, ArrowDownRight, Minus,
  Filter, Rocket, RotateCcw, Shield, AlertTriangle,
  GitBranch, FlaskConical, UserCheck, Upload, BarChart3,
  ExternalLink, Database, Brain, Link2,
} from 'lucide-react';
import type { TabContext } from '../../lib/useTabContext';
import {
  MOCK_POLICY_CHANGES,
  type PolicyChangeEvent,
} from '../../mocks/mockCentralOps';

/* ─── Props ─── */
interface ModelGovernanceProps {
  context?: TabContext;
  onNavigate?: (page: string, ctx?: Partial<TabContext>) => void;
}

/* ═══ Local enrichment types ═══ */
interface TimelineStep {
  stage: string;
  label: string;
  actor: string;
  date: string | null;
  summary: string;
  completed: boolean;
}

interface PredictionRow {
  label: string;
  predictedPp: number;
  actualPp: number;
  judgment: 'accurate' | 'partial_error' | 'missed' | 'pending';
}

interface RiskIssue {
  type: 'quality_alert' | 'compliance' | 'similar_change' | 'model_drift';
  title: string;
  severity: 'high' | 'medium' | 'low';
  targetPage?: string;
}

/* ═══ Decision timeline enrichment ═══ */
const TIMELINES: Record<string, TimelineStep[]> = {
  chg_20260124: [
    { stage: 'proposal', label: '변경 제안', actor: '이영희 (서울시)', date: '2026-01-24', summary: '60~64점 구간 이탈률 24%, 조기 개입 필요', completed: true },
    { stage: 'sandbox', label: '샌드박스 평가', actor: '시스템 자동', date: '2026-01-24', summary: '대상자 +8.2%, 업무량 +4.5%, SLA 위험 낮음', completed: true },
    { stage: 'approval', label: '승인/거부 결정', actor: '-', date: null, summary: '중앙관리자 검토 대기', completed: false },
    { stage: 'deploy', label: '실제 배포', actor: '-', date: null, summary: '-', completed: false },
    { stage: 'post_eval', label: '사후 영향 평가', actor: '-', date: null, summary: '-', completed: false },
  ],
  chg_20260120: [
    { stage: 'proposal', label: '변경 제안', actor: '박중앙 (보건복지부)', date: '2026-01-18', summary: '센터 업무량 최적화를 위해 경미 위험 기준 상향 제안', completed: true },
    { stage: 'sandbox', label: '샌드박스 평가', actor: '시스템 자동', date: '2026-01-18', summary: 'SLA +2.5%p 예측, 업무량 -3% 예상', completed: true },
    { stage: 'approval', label: '승인 결정', actor: '김정책 (보건복지부)', date: '2026-01-19', summary: '샌드박스 결과 양호, 전국 배포 승인', completed: true },
    { stage: 'deploy', label: '실제 배포', actor: '박중앙 (보건복지부)', date: '2026-01-20', summary: 'v2.3.1 전국 배포 완료', completed: true },
    { stage: 'post_eval', label: '사후 영향 평가', actor: '이분석 (중앙)', date: '2026-01-25', summary: 'SLA +2.6%p 실현, 예측과 부합', completed: true },
  ],
  chg_20260115: [
    { stage: 'proposal', label: '변경 제안', actor: '최현장 (서울시 센터장)', date: '2026-01-13', summary: 'L3 케이스 7일 주기로 위험 신호 2건 놓침', completed: true },
    { stage: 'sandbox', label: '샌드박스 평가', actor: '시스템 자동', date: '2026-01-13', summary: 'SLA +1.5%p 예측, 업무량 +12%', completed: true },
    { stage: 'approval', label: '승인 결정', actor: '박중앙 (보건복지부)', date: '2026-01-14', summary: '서울 시범 적용 후 확대 결정', completed: true },
    { stage: 'deploy', label: '실제 배포', actor: '김센터 (강남구)', date: '2026-01-15', summary: 'v2.3.0 서울특별시 배포 완료', completed: true },
    { stage: 'post_eval', label: '사후 영향 평가', actor: '이분석 (중앙)', date: '2026-01-22', summary: 'SLA +1.4%p, 응답적시율 +2.4%p 실현', completed: true },
  ],
  chg_20260110: [
    { stage: 'proposal', label: '변경 제안', actor: '이모델 (중앙)', date: '2026-01-05', summary: 'v3.1 대비 재현율 +3.2%p, A/B 테스트 완료', completed: true },
    { stage: 'sandbox', label: '샌드박스 평가', actor: '시스템 자동', date: '2026-01-06', summary: 'SLA +1.5%p 예측, 리스크 낮음', completed: true },
    { stage: 'approval', label: '승인 결정', actor: '박중앙 (보건복지부)', date: '2026-01-08', summary: 'A/B 결과 긍정적, 전국 배포 승인', completed: true },
    { stage: 'deploy', label: '실제 배포', actor: '이모델 (중앙)', date: '2026-01-10', summary: 'v3.2.0 전국 배포 완료', completed: true },
    { stage: 'post_eval', label: '사후 영향 평가', actor: '이분석 (중앙)', date: '2026-01-17', summary: 'SLA +1.7%p, 전반적 개선 확인', completed: true },
  ],
  chg_20260105: [
    { stage: 'proposal', label: '변경 제안', actor: '박중앙 (보건복지부)', date: '2026-01-02', summary: '독거 노인 위험도 과소평가 문제 제기', completed: true },
    { stage: 'sandbox', label: '샌드박스 평가', actor: '시스템 자동', date: '2026-01-03', summary: 'SLA +1.0%p 예측, 업무량 +18% 경고', completed: true },
    { stage: 'approval', label: '승인 결정', actor: '김정책 (보건복지부)', date: '2026-01-04', summary: '업무량 리스크 인지하에 시범 배포 승인', completed: true },
    { stage: 'deploy', label: '실제 배포', actor: '박중앙 (보건복지부)', date: '2026-01-05', summary: 'v2.2.5 전국 배포', completed: true },
    { stage: 'post_eval', label: '사후 영향 평가', actor: '이분석 (중앙)', date: '2026-01-12', summary: 'SLA -2.2%p, 예측 실패 → 1주 후 롤백 결정', completed: true },
  ],
};

/* ═══ Prediction vs actual comparison ═══ */
const PREDICTIONS: Record<string, PredictionRow[]> = {
  chg_20260124: [
    { label: 'SLA 준수율', predictedPp: -1.2, actualPp: 0, judgment: 'pending' },
    { label: '응답 적시율', predictedPp: -0.8, actualPp: 0, judgment: 'pending' },
    { label: '센터 업무량', predictedPp: 4.5, actualPp: 0, judgment: 'pending' },
    { label: '데이터 품질', predictedPp: 0, actualPp: 0, judgment: 'pending' },
  ],
  chg_20260120: [
    { label: 'SLA 준수율', predictedPp: 2.5, actualPp: 2.6, judgment: 'accurate' },
    { label: '응답 적시율', predictedPp: 3.0, actualPp: 2.6, judgment: 'partial_error' },
    { label: '처리 완료율', predictedPp: 1.5, actualPp: 1.4, judgment: 'accurate' },
    { label: '센터 업무량', predictedPp: -3.0, actualPp: -2.8, judgment: 'accurate' },
  ],
  chg_20260115: [
    { label: 'SLA 준수율', predictedPp: 1.5, actualPp: 1.4, judgment: 'accurate' },
    { label: '응답 적시율', predictedPp: 2.0, actualPp: 2.4, judgment: 'partial_error' },
    { label: '처리 완료율', predictedPp: 2.0, actualPp: 1.8, judgment: 'accurate' },
    { label: '센터 업무량', predictedPp: 12.0, actualPp: 10.5, judgment: 'partial_error' },
  ],
  chg_20260110: [
    { label: 'SLA 준수율', predictedPp: 1.5, actualPp: 1.7, judgment: 'accurate' },
    { label: '응답 적시율', predictedPp: 1.0, actualPp: 1.2, judgment: 'accurate' },
    { label: '처리 완료율', predictedPp: 1.5, actualPp: 1.3, judgment: 'accurate' },
    { label: '데이터 충족률', predictedPp: 0.5, actualPp: 0.6, judgment: 'accurate' },
  ],
  chg_20260105: [
    { label: 'SLA 준수율', predictedPp: 1.0, actualPp: -2.2, judgment: 'missed' },
    { label: '응답 적시율', predictedPp: 0.5, actualPp: -2.4, judgment: 'missed' },
    { label: '처리 완료율', predictedPp: 1.5, actualPp: -2.7, judgment: 'missed' },
    { label: '센터 업무량', predictedPp: 18.0, actualPp: 22.0, judgment: 'partial_error' },
  ],
};

/* ═══ Related risk issues ═══ */
const RISK_ISSUES: Record<string, RiskIssue[]> = {
  chg_20260124: [
    { type: 'similar_change', title: '유사한 L2 기준 조정이 2026-01-20에 실시됨 → 결과 비교 필요', severity: 'medium', targetPage: 'model-governance' },
    { type: 'quality_alert', title: '경기도 L2 누락 케이스 12건 감지', severity: 'medium', targetPage: 'quality-monitoring' },
  ],
  chg_20260120: [
    { type: 'compliance', title: '변경 배포 감사 로그 기록 완료', severity: 'low', targetPage: 'compliance-audit' },
  ],
  chg_20260115: [
    { type: 'quality_alert', title: '서울시 접촉 성공률 62% 모니터링 필요', severity: 'medium', targetPage: 'quality-monitoring' },
    { type: 'compliance', title: '변경 배포 감사 로그 기록 완료', severity: 'low', targetPage: 'compliance-audit' },
  ],
  chg_20260110: [
    { type: 'model_drift', title: 'v3.2 배포 후 드리프트 지수 0.12 안정', severity: 'low', targetPage: 'quality-monitoring' },
    { type: 'compliance', title: '모델 배포 감사 로그 기록 완료', severity: 'low', targetPage: 'compliance-audit' },
  ],
  chg_20260105: [
    { type: 'similar_change', title: '⚠ 유사한 독거 가중치 조정이 2025-11에 SLA 위반을 유발한 이력이 있음', severity: 'high', targetPage: 'compliance-audit' },
    { type: 'compliance', title: 'SLA 위반 2건 발생 → 규정 준수 경고', severity: 'high', targetPage: 'compliance-audit' },
    { type: 'quality_alert', title: '업무량 과다로 데이터 입력 지연 발생', severity: 'medium', targetPage: 'quality-monitoring' },
  ],
};

/* ═══ Helpers ═══ */
const TYPE_LABEL: Record<string, string> = {
  rule_threshold: '규칙 변경', model_version: '모델 배포',
  ruleset: '규칙셋', contact_rule: '접촉 규칙',
};

const RISK_STYLE: Record<string, { cls: string; label: string }> = {
  low:    { cls: 'bg-green-100 text-green-700', label: 'Low' },
  medium: { cls: 'bg-amber-100 text-amber-700', label: 'Medium' },
  high:   { cls: 'bg-red-100 text-red-700',   label: 'High' },
};

const STATUS_CONF: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  reviewing: { cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: <Clock className="h-3 w-3" />, label: '검토 중' },
  deployed:  { cls: 'bg-green-50 text-green-700 border-green-200',   icon: <Rocket className="h-3 w-3" />, label: '배포됨' },
  rollback:  { cls: 'bg-red-50 text-red-700 border-red-200',         icon: <RotateCcw className="h-3 w-3" />, label: '롤백됨' },
  pending:   { cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: <Clock className="h-3 w-3" />, label: '대기 중' },
};

const JUDGMENT_STYLE: Record<string, { cls: string; label: string }> = {
  accurate:      { cls: 'bg-green-100 text-green-700', label: '예측 적중' },
  partial_error: { cls: 'bg-amber-100 text-amber-700', label: '부분 오차' },
  missed:        { cls: 'bg-red-100 text-red-700',     label: '예측 실패' },
  pending:       { cls: 'bg-gray-100 text-gray-500',   label: '평가 대기' },
};

const STAGE_ICON: Record<string, React.ReactNode> = {
  proposal:  <GitBranch className="h-4 w-4" />,
  sandbox:   <FlaskConical className="h-4 w-4" />,
  approval:  <UserCheck className="h-4 w-4" />,
  deploy:    <Upload className="h-4 w-4" />,
  post_eval: <BarChart3 className="h-4 w-4" />,
};

const ISSUE_ICON: Record<string, React.ReactNode> = {
  quality_alert:  <Database className="h-3.5 w-3.5 text-blue-500" />,
  compliance:     <Shield className="h-3.5 w-3.5 text-amber-500" />,
  similar_change: <Link2 className="h-3.5 w-3.5 text-purple-500" />,
  model_drift:    <Brain className="h-3.5 w-3.5 text-indigo-500" />,
};

/* ═══════════════════════════════════════════════
   Decision Control View
   ═══════════════════════════════════════════════ */
export function ModelGovernance({ context, onNavigate }: ModelGovernanceProps) {
  /* ── state ── */
  const [selectedId, setSelectedId] = useState<string>(
    context?.changeId || MOCK_POLICY_CHANGES[0]?.id || '',
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [approvalNote, setApprovalNote] = useState('');
  const [showApprovalForm, setShowApprovalForm] = useState(false);

  /* ── derived ── */
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return MOCK_POLICY_CHANGES;
    return MOCK_POLICY_CHANGES.filter((c) => c.status === statusFilter);
  }, [statusFilter]);

  const selected = useMemo(
    () => MOCK_POLICY_CHANGES.find((c) => c.id === selectedId) ?? MOCK_POLICY_CHANGES[0],
    [selectedId],
  );

  const timeline    = TIMELINES[selected.id] ?? [];
  const predictions = PREDICTIONS[selected.id] ?? [];
  const issues      = RISK_ISSUES[selected.id] ?? [];
  const risk        = RISK_STYLE[selected.riskLevel ?? 'low'];
  const status      = STATUS_CONF[selected.status] ?? STATUS_CONF.pending;

  /* ── handlers ── */
  const handleApproval = (approved: boolean) => {
    if (!approvalNote.trim()) { alert('승인 또는 거부 사유를 입력하세요.'); return; }
    const action = approved ? '승인' : '거부';
    if (window.confirm(`이 변경 결정을 ${action}하시겠습니까?\n\n사유: ${approvalNote}`)) {
      alert(`변경 결정이 ${action}되었습니다.\n모든 결정은 감사 로그에 자동 기록됩니다.`);
      setApprovalNote('');
      setShowApprovalForm(false);
    }
  };

  return (
    <div className="space-y-4 p-1">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">모델·규칙 변경 통제</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          변경 결정의 근거·리스크·책임·결과를 한눈에 검증합니다.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* ═══ Left: Decision List ═══ */}
        <div className="col-span-4 space-y-3">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 w-full focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체 상태</option>
              <option value="reviewing">검토 중</option>
              <option value="deployed">배포됨</option>
              <option value="rollback">롤백됨</option>
            </select>
          </div>

          {/* Decision cards */}
          <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {filtered.map((ev) => {
              const evRisk = RISK_STYLE[ev.riskLevel ?? 'low'];
              const evStatus = STATUS_CONF[ev.status] ?? STATUS_CONF.pending;
              const evIssues = RISK_ISSUES[ev.id] ?? [];
              const highIssues = evIssues.filter((i) => i.severity === 'high');
              return (
                <button
                  key={ev.id}
                  onClick={() => { setSelectedId(ev.id); setShowApprovalForm(false); }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedId === ev.id
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  {/* Badges row */}
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${evStatus.cls}`}>
                      {evStatus.icon}{evStatus.label}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${evRisk.cls}`}>
                      {evRisk.label}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                      {TYPE_LABEL[ev.type] || ev.type}
                    </span>
                    {highIssues.length > 0 && (
                      <AlertTriangle className="h-3 w-3 text-red-500 ml-auto" />
                    )}
                  </div>
                  {/* Title */}
                  <div className="text-sm font-semibold text-gray-900 mb-1">{ev.title}</div>
                  {/* Meta */}
                  <div className="text-[11px] text-gray-500">
                    {ev.requestedBy ?? ev.deployedBy} · {new Date(ev.deployedAt).toLocaleDateString('ko-KR')}
                    <span className="ml-1 text-gray-400">· {ev.affectedRegions.join(', ')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ Right: Decision Detail ═══ */}
        <div className="col-span-8 space-y-4">
          {/* [A] Decision Summary Header */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Badge strip */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${status.cls}`}>
                      {status.icon}{status.label}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${risk.cls}`}>
                      위험: {risk.label}
                    </span>
                    <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700 font-medium">
                      {TYPE_LABEL[selected.type]}
                    </span>
                    <span className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                      {selected.affectedRegions.join(', ')}
                    </span>
                    {issues.some((i) => i.severity === 'high') && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-50 text-red-700 border border-red-200">
                        <AlertTriangle className="h-3 w-3" />경고 연결
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{selected.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">{selected.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    <span>제안: <strong className="text-gray-700">{selected.requestedBy ?? '-'}</strong></span>
                    <span>승인: <strong className="text-gray-700">{selected.approvedBy ?? '-'}</strong></span>
                    <span>배포: <strong className="text-gray-700">{selected.deployedBy}</strong></span>
                    <span>버전: {selected.version}</span>
                  </div>
                </div>

                {/* Approval action buttons in header */}
                {selected.status === 'reviewing' && (
                  <div className="shrink-0 flex flex-col gap-1.5">
                    {!showApprovalForm ? (
                      <Button size="sm" onClick={() => setShowApprovalForm(true)} className="whitespace-nowrap">
                        결정 내리기
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => handleApproval(true)} className="whitespace-nowrap">승인</Button>
                        <Button size="sm" variant="outline" onClick={() => handleApproval(false)}
                          className="whitespace-nowrap text-red-600 border-red-300 hover:bg-red-50">
                          거부
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowApprovalForm(false)}
                          className="text-xs text-gray-400">
                          취소
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Approval form (only for reviewing items) */}
              {selected.status === 'reviewing' && showApprovalForm && (
                <div className="mt-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-yellow-900">
                      이 결정은 전체 시스템에 영향을 줍니다. 승인/거부 사유를 명시하세요.
                    </p>
                  </div>
                  <textarea
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                    placeholder="결정 사유를 입력하세요 (필수)"
                    className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                  {selected.currentRule && selected.proposedRule && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="bg-white border border-gray-200 rounded p-2">
                        <div className="text-[10px] text-gray-400 uppercase">현재 규칙</div>
                        <div className="text-xs font-medium text-gray-900">{selected.currentRule}</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <div className="text-[10px] text-blue-500 uppercase">제안 규칙</div>
                        <div className="text-xs font-medium text-blue-900">{selected.proposedRule}</div>
                      </div>
                    </div>
                  )}
                  {selected.reason && (
                    <div className="mt-2 p-2 bg-white border rounded text-xs text-gray-700">
                      <span className="font-medium">제안 근거:</span> {selected.reason}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Main content grid: Timeline+Predictions (left) + Risk panel (right) */}
          <div className="grid grid-cols-12 gap-4">
            {/* [B] Timeline + [C] Predictions */}
            <div className="col-span-7 space-y-4">
              {/* [B] Decision Timeline */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">결정 과정 타임라인</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    {timeline.map((step, idx) => {
                      const isLast = idx === timeline.length - 1;
                      const nextIncomplete = step.completed && (idx === timeline.length - 1 || !timeline[idx + 1]?.completed);
                      const isCurrent = step.completed && nextIncomplete && !isLast;
                      return (
                        <div key={idx} className="flex gap-3 pb-4 last:pb-0">
                          {/* Vertical connector */}
                          <div className="flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                              step.completed
                                ? isCurrent
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-400'
                            }`}>
                              {step.completed
                                ? isCurrent ? STAGE_ICON[step.stage] : <CheckCircle className="h-3.5 w-3.5" />
                                : STAGE_ICON[step.stage]}
                            </div>
                            {!isLast && (
                              <div className={`w-px flex-1 min-h-[16px] ${
                                step.completed ? 'bg-green-300' : 'bg-gray-200'
                              }`} />
                            )}
                          </div>
                          {/* Content */}
                          <div className="flex-1 pb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${step.completed ? 'text-gray-900' : 'text-gray-400'}`}>
                                {step.label}
                              </span>
                              {step.date && (
                                <span className="text-[10px] text-gray-400">{step.date}</span>
                              )}
                            </div>
                            <div className={`text-[11px] mt-0.5 ${step.completed ? 'text-gray-600' : 'text-gray-300'}`}>
                              {step.summary}
                            </div>
                            {step.completed && step.actor !== '-' && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                담당: {step.actor}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* [C] Prediction vs Actual */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    결정 품질 평가
                    <span className="text-[10px] font-normal text-gray-400">사전 예측 vs 실제 결과</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/60">
                        <th className="text-left py-2 px-2 text-[11px] font-semibold text-gray-600">항목</th>
                        <th className="text-right py-2 px-2 text-[11px] font-semibold text-gray-600">사전 예측</th>
                        <th className="text-right py-2 px-2 text-[11px] font-semibold text-gray-600">실제 결과</th>
                        <th className="text-right py-2 px-2 text-[11px] font-semibold text-gray-600">차이</th>
                        <th className="text-center py-2 px-2 text-[11px] font-semibold text-gray-600">판단</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.map((p, i) => {
                        const diff = p.actualPp - p.predictedPp;
                        const j = JUDGMENT_STYLE[p.judgment];
                        return (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2 px-2 text-xs font-medium text-gray-900">{p.label}</td>
                            <td className="py-2 px-2 text-xs text-right text-gray-700">
                              {p.predictedPp >= 0 ? '+' : ''}{p.predictedPp.toFixed(1)}%p
                            </td>
                            <td className="py-2 px-2 text-xs text-right font-medium text-gray-900">
                              {p.judgment === 'pending'
                                ? '-'
                                : `${p.actualPp >= 0 ? '+' : ''}${p.actualPp.toFixed(1)}%p`}
                            </td>
                            <td className="py-2 px-2 text-xs text-right">
                              {p.judgment === 'pending' ? (
                                <span className="text-gray-400">-</span>
                              ) : (
                                <span className={diff >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${j.cls}`}>
                                {j.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* [D] Risk & Related Issues Panel */}
            <div className="col-span-5">
              <Card className="sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-500" />
                    리스크 & 연관 이슈
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {issues.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400">
                      연관된 리스크 이슈 없음
                    </div>
                  ) : (
                    issues.map((issue, i) => (
                      <button
                        key={i}
                        onClick={() => issue.targetPage && onNavigate?.(issue.targetPage, {})}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors hover:bg-gray-50 ${
                          issue.severity === 'high'
                            ? 'border-red-200 bg-red-50/50'
                            : issue.severity === 'medium'
                            ? 'border-amber-200 bg-amber-50/30'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {ISSUE_ICON[issue.type]}
                          <div className="flex-1">
                            <div className="text-xs text-gray-900 leading-relaxed">{issue.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-medium ${
                                issue.severity === 'high' ? 'text-red-600' :
                                issue.severity === 'medium' ? 'text-amber-600' : 'text-gray-500'
                              }`}>
                                {issue.severity === 'high' ? '높음' : issue.severity === 'medium' ? '보통' : '낮음'}
                              </span>
                              {issue.targetPage && (
                                <ExternalLink className="h-2.5 w-2.5 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}

                  {/* Cross-page navigation */}
                  <div className="pt-2 border-t border-gray-200 space-y-1.5">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">연결 화면</p>
                    <button
                      onClick={() => onNavigate?.('quality-monitoring', {})}
                      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-blue-50 transition-colors text-left text-xs text-gray-700"
                    >
                      <Database className="h-3.5 w-3.5 text-blue-500" />
                      데이터 & 모델 품질
                      <ExternalLink className="h-2.5 w-2.5 text-gray-400 ml-auto" />
                    </button>
                    <button
                      onClick={() => onNavigate?.('compliance-audit', { changeId: selected.id })}
                      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-amber-50 transition-colors text-left text-xs text-gray-700"
                    >
                      <Shield className="h-3.5 w-3.5 text-amber-500" />
                      감사 로그에서 이 변경 보기
                      <ExternalLink className="h-2.5 w-2.5 text-gray-400 ml-auto" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
