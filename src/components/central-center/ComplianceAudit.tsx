import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Download, Shield, AlertTriangle, CheckCircle, Clock,
  Activity, Eye, User, MapPin, FileText,
  ExternalLink, ChevronDown, ChevronUp, Filter, Search,
  XCircle, Rocket, AlertCircle,
} from 'lucide-react';
import type { TabContext } from '../../lib/useTabContext';
import {
  MOCK_UNIFIED_AUDIT,
  type UnifiedAuditEvent,
  type UnifiedEventType,
  type EventSeverity,
  type EventStatus,
} from '../../mocks/mockCentralOps';

/* ─── Props ─── */
interface ComplianceAuditProps {
  context?: TabContext;
  onNavigate?: (page: string, ctx?: Partial<TabContext>) => void;
}

/* ─── 준수 체크리스트 (Snapshot용) ─── */
const complianceSnapshot = [
  { item: '위험 점수·확률 미노출', ok: true },
  { item: '진단 관련 용어 미사용', ok: true },
  { item: '목적 제한 명시', ok: true },
  { item: '선택적 참여 강조', ok: true },
];

/* ─── 이벤트 타입 메타 ─── */
const EVENT_TYPE_META: Record<UnifiedEventType, { icon: React.ReactNode; label: string; color: string; dotColor: string }> = {
  violation:     { icon: <XCircle className="h-4 w-4" />,     label: '규정 위반',   color: 'text-red-600',    dotColor: 'bg-red-500' },
  policy_change: { icon: <Activity className="h-4 w-4" />,    label: '정책 변경',   color: 'text-blue-600',   dotColor: 'bg-blue-500' },
  model_deploy:  { icon: <Rocket className="h-4 w-4" />,      label: '모델 배포',   color: 'text-purple-600', dotColor: 'bg-purple-500' },
  resolution:    { icon: <CheckCircle className="h-4 w-4" />, label: '조치 완료',   color: 'text-green-600',  dotColor: 'bg-green-500' },
};

const SEVERITY_META: Record<EventSeverity, { cls: string; label: string }> = {
  high:   { cls: 'bg-red-50 text-red-700 border-red-200', label: '높음' },
  medium: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: '중간' },
  low:    { cls: 'bg-gray-100 text-gray-600 border-gray-200', label: '낮음' },
};

const STATUS_META: Record<EventStatus, { cls: string; label: string; icon: React.ReactNode }> = {
  reviewing: { cls: 'bg-orange-50 text-orange-700 border-orange-200', label: '검토 중', icon: <Clock className="h-3 w-3" /> },
  resolved:  { cls: 'bg-green-50 text-green-700 border-green-200',   label: '해결됨', icon: <CheckCircle className="h-3 w-3" /> },
  pending:   { cls: 'bg-purple-50 text-purple-700 border-purple-200', label: '대기',   icon: <Clock className="h-3 w-3" /> },
};

/* ─── KPI 요약 계산 ─── */
function computeKpiSummary(events: UnifiedAuditEvent[]) {
  const allEvents = MOCK_UNIFIED_AUDIT;
  const totalViolations = allEvents.filter(e => e.type === 'violation').length;
  const unresolved = allEvents.filter(e => e.type === 'violation' && e.status !== 'resolved').length;
  const highSeverity = allEvents.filter(e => e.severity === 'high').length;
  const recent30 = events.length;
  return { totalViolations, unresolved, highSeverity, recent30 };
}

/* ═══ 메인 컴포넌트 ═══ */
export function ComplianceAudit({ context, onNavigate }: ComplianceAuditProps) {
  /* 필터 상태 */
  const [typeFilter, setTypeFilter] = useState<UnifiedEventType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  /* 선택 상태 */
  const [selectedId, setSelectedId] = useState<string | null>(context?.auditId || null);
  const [showCompliance, setShowCompliance] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedId && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedId]);

  /* 필터링 */
  const filteredEvents = useMemo(() => {
    let result = [...MOCK_UNIFIED_AUDIT];
    if (typeFilter !== 'all') result = result.filter(e => e.type === typeFilter);
    if (severityFilter !== 'all') result = result.filter(e => e.severity === severityFilter);
    if (statusFilter !== 'all') result = result.filter(e => e.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        (e.center?.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [typeFilter, severityFilter, statusFilter, searchQuery]);

  const selected = useMemo(() => MOCK_UNIFIED_AUDIT.find(e => e.id === selectedId) || null, [selectedId]);
  const kpiSummary = useMemo(() => computeKpiSummary(filteredEvents), [filteredEvents]);

  return (
    <div className="space-y-4 p-1">
      {/* ═══ Header ═══ */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">규정 준수 및 감사</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            문제 발생 → 변경 이력 → 개입 근거를 하나의 흐름에서 추적합니다.
          </p>
        </div>
        <Button size="sm" onClick={() => alert('감사 보고서 내보내기 (mock)')}>
          <Download className="h-4 w-4 mr-2" />감사 보고서 내보내기
        </Button>
      </div>

      {/* ═══ [A] 감사 상태 요약 (Status Bar) ═══ */}
      <div className={`rounded-xl border-2 p-4 ${
        kpiSummary.unresolved > 0 ? 'border-red-300 bg-gradient-to-r from-red-50 via-white to-white' : 'border-green-300 bg-gradient-to-r from-green-50 via-white to-white'
      }`}>
        {/* 요약 문장 앵커 */}
        <p className="text-sm font-bold text-gray-900 mb-3">
          현재 감사 상태:{' '}
          {kpiSummary.unresolved > 0 ? (
            <>
              고위험 이벤트 <span className="text-red-600">{kpiSummary.highSeverity}건</span> 중{' '}
              <span className="text-red-600 underline underline-offset-2 decoration-2">{kpiSummary.unresolved}건 미해결</span>
            </>
          ) : (
            <span className="text-green-700">모든 위반 사항 해결 완료</span>
          )}
        </p>
        {/* KPI 수치 행 */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCell icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            label="전체 규정 위반" value={kpiSummary.totalViolations}
            highlight={kpiSummary.totalViolations > 0} />
          <KpiCell icon={<Clock className="h-4 w-4 text-orange-500" />}
            label="미해결 위반" value={kpiSummary.unresolved}
            highlight={kpiSummary.unresolved > 0} />
          <KpiCell icon={<AlertCircle className="h-4 w-4 text-rose-600" />}
            label="고위험 이벤트" value={kpiSummary.highSeverity}
            highlight={kpiSummary.highSeverity > 0} />
          <KpiCell icon={<Activity className="h-4 w-4 text-blue-500" />}
            label="최근 30일 이벤트" value={kpiSummary.recent30}
            highlight={false} />
        </div>
      </div>

      {/* ═══ 필터 바 ═══ */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-gray-400 shrink-0" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as UnifiedEventType | 'all')}
          className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500">
          <option value="all">모든 유형</option>
          <option value="violation">🔴 규정 위반</option>
          <option value="policy_change">🔵 정책 변경</option>
          <option value="model_deploy">🟣 모델 배포</option>
          <option value="resolution">🟢 조치 완료</option>
        </select>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value as EventSeverity | 'all')}
          className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500">
          <option value="all">모든 심각도</option>
          <option value="high">높음</option>
          <option value="medium">중간</option>
          <option value="low">낮음</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as EventStatus | 'all')}
          className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500">
          <option value="all">모든 상태</option>
          <option value="reviewing">검토 중</option>
          <option value="resolved">해결됨</option>
          <option value="pending">대기</option>
        </select>
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="제목, 담당자, 대상 검색…"
            className="w-full text-xs border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <span className="text-[11px] text-gray-400 ml-auto">{filteredEvents.length}건</span>
      </div>

      {/* ═══ [B] 메인 영역: 타임라인(좌 4) + 상세(우 6) ═══ */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 3fr' }}>

        {/* ── 좌측: 감사 이벤트 타임라인 (Vertical Rail) ── */}
        <div className="relative max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
          {/* 고정 세로 기준선 */}
          <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gray-200 z-0" />

          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">필터 조건에 맞는 이벤트가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-1">
            {filteredEvents.map((ev) => {
              const meta = EVENT_TYPE_META[ev.type];
              const sevMeta = SEVERITY_META[ev.severity];
              const stMeta = STATUS_META[ev.status];
              const isSelected = selectedId === ev.id;
              const isHighRisk = ev.severity === 'high' && ev.type === 'violation';
              const isResolution = ev.type === 'resolution';
              return (
                <button key={ev.id} onClick={() => setSelectedId(ev.id)}
                  className={`w-full text-left relative pl-10 pr-3 rounded-lg border transition-all z-10 ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50 shadow-md ring-1 ring-blue-200'
                      : isHighRisk
                        ? 'border-red-200 bg-red-50/40 hover:bg-red-50/80 hover:border-red-300'
                        : isResolution
                          ? 'border-transparent hover:border-gray-200 hover:bg-gray-50/60'
                          : 'border-transparent hover:border-gray-200 hover:bg-gray-50/80'
                  } ${isHighRisk ? 'py-4' : isResolution ? 'py-2' : 'py-3'}`}>

                  {/* 아이콘 on rail */}
                  <div className={`absolute left-[7px] rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                    isHighRisk ? 'top-4 w-[18px] h-[18px] ring-2 ring-red-300' : 'top-3 w-4 h-4'
                  } ${meta.dotColor}`}>
                    {isHighRisk && <span className="block w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>

                  {/* 1행: 이벤트 성격 + 상태배지(우측) */}
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        isHighRisk ? meta.color + ' bg-red-100 border-red-300' : meta.color
                      }`}>
                        {meta.icon}<span className="ml-0.5">{meta.label}</span>
                      </span>
                      {ev.severity !== 'low' && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border font-medium ${sevMeta.cls}`}>{sevMeta.label}</span>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border shrink-0 ${stMeta.cls}`}>
                      {stMeta.icon}<span>{stMeta.label}</span>
                    </span>
                  </div>

                  {/* 2행: 핵심 문장 */}
                  <div className={`leading-snug mb-0.5 ${
                    isHighRisk ? 'text-sm font-bold text-red-900' : isResolution ? 'text-xs font-medium text-gray-600' : 'text-sm font-semibold text-gray-900'
                  }`}>{ev.title}</div>

                  {/* 3행: 부가 정보 (낮은 우선순위) */}
                  <div className={`flex items-center gap-2 text-[11px] ${
                    isResolution ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    <span>{ev.actor}</span>
                    {ev.center && <><span>·</span><span>{ev.center}</span></>}
                    <span className="ml-auto text-[10px] text-gray-400 font-mono">
                      {new Date(ev.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </button>
              );
            })}
            </div>
          )}
        </div>

        {/* ── 우측: 감사 브리핑 패널 ── */}
        <div ref={detailRef}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-80 text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <Eye className="h-10 w-10 mb-3 text-gray-300" />
              <p className="text-sm font-medium">좌측 타임라인에서 이벤트를 선택하세요</p>
              <p className="text-xs mt-1">위반·변경·배포·조치 이벤트의 상세 정보를 확인합니다.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">

              {/* ★ 판단 요약 문장 (시각적 앵커) */}
              <div className={`rounded-xl p-3.5 border-2 ${
                selected.type === 'violation' && selected.status !== 'resolved'
                  ? 'bg-red-50 border-red-300'
                  : selected.type === 'violation'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-slate-50 border-slate-200'
              }`}>
                <p className={`text-sm font-bold leading-relaxed ${
                  selected.type === 'violation' && selected.status !== 'resolved'
                    ? 'text-red-900'
                    : 'text-gray-900'
                }`}>
                  판단 요약:{' '}
                  <span className="font-normal">
                    {selected.type === 'violation'
                      ? `${selected.violationType || '규정 위반'}으로 인한 ${selected.target} 관련 이슈.`
                      : selected.type === 'resolution'
                        ? `${selected.target} 관련 조치 완료.`
                        : `${selected.target} 관련 ${EVENT_TYPE_META[selected.type].label} 이벤트.`}
                    {' '}
                    {selected.status === 'resolved'
                      ? '조치 완료 — 확산 없음.'
                      : selected.status === 'reviewing'
                        ? '현재 검토 중 — 개입 필요.'
                        : '대기 상태.'}
                  </span>
                </p>
              </div>

              {/* 이벤트 헤더 (축소) */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border ${
                  selected.type === 'violation' ? 'bg-red-100 text-red-700 border-red-300' : EVENT_TYPE_META[selected.type].color
                }`}>
                  {EVENT_TYPE_META[selected.type].icon}
                  {EVENT_TYPE_META[selected.type].label}
                </span>
                <span className={`px-2 py-1 rounded text-[10px] border ${SEVERITY_META[selected.severity].cls}`}>
                  {SEVERITY_META[selected.severity].label}
                </span>
                <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded text-[10px] border ${STATUS_META[selected.status].cls}`}>
                  {STATUS_META[selected.status].icon}
                  <span>{STATUS_META[selected.status].label}</span>
                </span>
                <span className="ml-auto text-[11px] text-gray-400">
                  {new Date(selected.timestamp).toLocaleString('ko-KR')}
                </span>
              </div>
              <div className="px-0.5">
                <h3 className="text-base font-bold text-gray-900">{selected.title}</h3>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                  <span>{selected.actor} ({selected.actorRole})</span>
                  {selected.center && <><span>·</span><span>{selected.center}</span></>}
                </div>
              </div>

              {/* ── 브리핑 카드: 문제 요약 ── */}
              <BriefCard
                icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                keyword="문제 요약"
                accentBorder={selected.type === 'violation'}
              >
                {selected.violationType && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-400 w-16 shrink-0">유형</span>
                    <span className="font-semibold text-gray-900">{selected.violationType}</span>
                  </div>
                )}
                {selected.violatedRegulation && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-400 w-16 shrink-0">규정</span>
                    <span className="font-semibold text-red-700">{selected.violatedRegulation}</span>
                  </div>
                )}
                {!selected.violationType && !selected.violatedRegulation && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-400 w-16 shrink-0">대상</span>
                    <span className="font-semibold text-gray-900">{selected.target}</span>
                  </div>
                )}
              </BriefCard>

              {/* ── 브리핑 카드: 발생 원인 ── */}
              <BriefCard
                icon={<Search className="h-4 w-4 text-blue-500" />}
                keyword="발생 원인"
              >
                <p className="text-xs text-gray-800 leading-relaxed">{selected.cause}</p>
                {selected.relatedChangeId && (
                  <button onClick={() => onNavigate?.('model-governance', { changeId: selected.relatedChangeId })}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1">
                    <ExternalLink className="h-3 w-3" />관련 정책 변경 보기
                  </button>
                )}
              </BriefCard>

              {/* ── 브리핑 카드: 개입 주체 ── */}
              <BriefCard
                icon={<User className="h-4 w-4 text-indigo-500" />}
                keyword="개입 주체"
              >
                <div className="grid grid-cols-3 gap-2">
                  {selected.requestor && <RoleChip label="요청자" value={selected.requestor} color="blue" />}
                  {selected.approver && <RoleChip label="승인자" value={selected.approver} color="green" />}
                  {selected.executor && <RoleChip label="실행자" value={selected.executor} color="gray" />}
                </div>
              </BriefCard>

              {/* ── 브리핑 카드: 판단 근거 ── */}
              <BriefCard
                icon={<Shield className="h-4 w-4 text-emerald-600" />}
                keyword="판단 근거"
              >
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-2">
                  <p className="text-xs text-emerald-900 leading-relaxed font-medium">{selected.rationale}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selected.policyRef && (
                    <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                      <FileText className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">정책 문서</div>
                        <div className="text-xs font-medium text-gray-800">{selected.policyRef}</div>
                      </div>
                    </div>
                  )}
                  {selected.internalStandardId && (
                    <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                      <Shield className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">내부 기준</div>
                        <div className="text-xs font-medium text-gray-800">{selected.internalStandardId}</div>
                      </div>
                    </div>
                  )}
                </div>
                {selected.approvalComment && (
                  <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg mt-2">
                    <MapPin className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[10px] text-amber-600 uppercase tracking-wide">처리 코멘트</div>
                      <div className="text-xs text-amber-900">{selected.approvalComment}</div>
                    </div>
                  </div>
                )}
                {/* KPI 스냅샷 */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <div className="text-[10px] text-blue-600 mb-0.5">당시 SLA</div>
                    <div className="text-base font-bold text-blue-900">{selected.kpiSnapshot.slaRate}%</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <div className="text-[10px] text-red-600 mb-0.5">리스크 Top 3</div>
                    {selected.kpiSnapshot.riskTop3.map((r, i) => (
                      <div key={i} className="text-[10px] font-medium text-red-800">{i + 1}. {r}</div>
                    ))}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                    <div className="text-[10px] text-gray-500 mb-0.5">컨텍스트 지역</div>
                    <div className="text-xs font-bold text-gray-900">{selected.kpiSnapshot.regionContext}</div>
                  </div>
                </div>
              </BriefCard>

              {/* [E] Compliance Snapshot — 위반 시 자동확장 */}
              <ComplianceBar
                items={complianceSnapshot}
                forceExpand={selected.type === 'violation' && selected.status !== 'resolved'}
                showCompliance={showCompliance}
                setShowCompliance={setShowCompliance}
              />

              {/* 액션 버튼 */}
              <div className="flex gap-2 justify-end pt-1">
                {selected.relatedChangeId && (
                  <Button variant="outline" size="sm"
                    onClick={() => onNavigate?.('model-governance', { changeId: selected.relatedChangeId })}
                    className="text-blue-600 text-xs">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />정책 영향 분석 보기
                  </Button>
                )}
                <Button variant="outline" size="sm"
                  onClick={() => alert('JSON 감사 보고서 내보내기 (mock)')}
                  className="text-gray-600 text-xs">
                  <Download className="h-3.5 w-3.5 mr-1" />Export JSON
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ 서브 컴포넌트 ═══ */

/** [A] KPI 셀 — 상태 바 내부 */
function KpiCell({ icon, label, value, highlight }: {
  icon: React.ReactNode; label: string; value: number; highlight: boolean;
}) {
  return (
    <div className={`rounded-lg p-2.5 border transition-colors ${
      highlight
        ? 'border-red-200 bg-white shadow-sm'
        : 'border-transparent bg-white/60'
    }`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <span className="text-[11px] text-gray-500">{label}</span>
      </div>
      <div className={`text-xl font-bold ${
        highlight ? 'text-red-700' : 'text-gray-700'
      }`}>{value}</div>
    </div>
  );
}

/** [D] 브리핑 카드 래퍼 */
function BriefCard({ icon, keyword, children, accentBorder }: {
  icon: React.ReactNode; keyword: string;
  children: React.ReactNode; accentBorder?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${
      accentBorder ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{keyword}</span>
      </div>
      {children}
    </div>
  );
}

/** [E] 준수 상태 바 */
function ComplianceBar({ items, forceExpand, showCompliance, setShowCompliance }: {
  items: { item: string; ok: boolean }[];
  forceExpand: boolean;
  showCompliance: boolean;
  setShowCompliance: (v: boolean) => void;
}) {
  const allOk = items.every((c) => c.ok);
  const open = forceExpand || showCompliance;
  const failCount = items.filter((c) => !c.ok).length;
  return (
    <div className={`rounded-lg border overflow-hidden ${
      !allOk ? 'border-red-200' : 'border-gray-200'
    }`}>
      <button
        onClick={() => setShowCompliance(!showCompliance)}
        className={`w-full flex items-center justify-between px-4 py-2 transition-colors ${
          !allOk ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-2">
          {allOk
            ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            : <XCircle className="h-3.5 w-3.5 text-red-600" />}
          <span className="text-xs font-semibold text-gray-700">준수 상태</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
            allOk
              ? 'text-green-700 bg-green-50 border-green-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}>
            {allOk ? `${items.length}/${items.length} 준수` : `${failCount}건 위반`}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 py-2 bg-white grid grid-cols-2 gap-x-4 gap-y-1">
          {items.map((c, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              {c.ok
                ? <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                : <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
              <span className={`text-xs ${c.ok ? 'text-gray-600' : 'text-red-700 font-medium'}`}>{c.item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 역할 칩 */
function RoleChip({ label, value, color }: { label: string; value: string; color: 'blue' | 'green' | 'gray' }) {
  const cls: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };
  return (
    <div className={`rounded-lg border p-2 ${cls[color]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-60 mb-0.5">{label}</div>
      <div className="text-xs font-medium leading-tight">{value}</div>
    </div>
  );
}
