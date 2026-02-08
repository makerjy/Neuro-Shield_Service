/**
 * InterventionManager.tsx
 * ─────────────────────────────────────────────────────────
 * "병목 기반 개입 관리" 통합 화면
 *   WHY  (병목 요약)
 *   → WHAT (권장 조치 편집 가능 리스트)
 *   → HOW  (실행/상태 추적)
 *
 * localStorage 기반 persist · AI 초안 생성 · 편집/추가/삭제/승인/상태변경 모두 동작
 * ─────────────────────────────────────────────────────────
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Download,
  ChevronRight,
  Edit3,
  Trash2,
  Filter,
  Search,
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import type {
  BottleneckSignal,
  InterventionPlan,
  PlanStatus,
  Impact,
  InterventionType,
  BottleneckType,
} from '../../lib/interventionStore';
import {
  seedBottlenecks,
  loadPlans,
  savePlans,
  upsertPlan,
  deletePlan,
  transitionPlanStatus,
  exportPlansAsJson,
  exportPlansAsCsv,
  BOTTLENECK_TYPE_LABELS,
  IMPACT_LABELS,
  IMPACT_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_LABELS,
} from '../../lib/interventionStore';
import { generateRecommendations } from '../../lib/recommendationEngine';
import { PlanEditModal } from './PlanEditModal';

// ═══════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════
interface InterventionManagerProps {
  region: string;
  centerId?: string | null;
  onNavigateToBottleneck?: () => void;
}

const ALL_STATUSES: PlanStatus[] = ['DRAFT', 'APPROVED', 'IN_PROGRESS', 'DONE', 'REJECTED'];

// ═══════════════════════════════════════════════════════════
// 컴포넌트
// ═══════════════════════════════════════════════════════════
export function InterventionManager({ region, centerId, onNavigateToBottleneck }: InterventionManagerProps) {
  // ─── 데이터 ───
  const bottlenecks = useMemo(() => seedBottlenecks(region), [region]);
  const [plans, setPlans] = useState<InterventionPlan[]>([]);

  // 초기 로드 + AI 초안 시드
  useEffect(() => {
    let existing = loadPlans(region);
    if (existing.length === 0) {
      // 첫 방문 → AI 초안 생성
      const recs = generateRecommendations(bottlenecks, region, []);
      existing = recs;
      savePlans(region, existing);
    }
    setPlans(existing);
  }, [region, bottlenecks]);

  // ─── 필터 / 하이라이트 ───
  const [highlightKpi, setHighlightKpi] = useState<string | null>(null);
  const [highlightBnType, setHighlightBnType] = useState<BottleneckType | null>(null);
  const [filterStatus, setFilterStatus] = useState<PlanStatus | null>(null);
  const [filterCenter, setFilterCenter] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  // 초기 centerId 필터
  useEffect(() => {
    if (centerId) {
      const bn = bottlenecks.find(b => b.centerId === centerId);
      if (bn) setFilterCenter(bn.centerName);
    }
  }, [centerId, bottlenecks]);

  // ─── 모달 ───
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InterventionPlan | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectMemo, setRejectMemo] = useState('');

  // ─── 내보내기 모달 ───
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // 필터 적용
  // ═══════════════════════════════════════════════════════════
  const filteredPlans = useMemo(() => {
    let list = plans;
    if (filterStatus) list = list.filter(p => p.status === filterStatus);
    if (filterCenter) list = list.filter(p => p.centerName.includes(filterCenter));
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.centerName.toLowerCase().includes(q) ||
        p.linkedKpis.some(k => k.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [plans, filterStatus, filterCenter, searchText]);

  // 하이라이트 여부 판별
  const isPlanHighlighted = useCallback((plan: InterventionPlan) => {
    if (!highlightKpi && !highlightBnType) return true; // 필터 없으면 전부 표시
    if (highlightKpi && plan.linkedKpis.some(k => k.includes(highlightKpi))) return true;
    if (highlightBnType) {
      const bn = bottlenecks.find(b => b.id === plan.linkedBottleneckId);
      if (bn && bn.bottleneckType === highlightBnType) return true;
    }
    return false;
  }, [highlightKpi, highlightBnType, bottlenecks]);

  // ═══════════════════════════════════════════════════════════
  // 액션 핸들러
  // ═══════════════════════════════════════════════════════════
  const handleSavePlan = useCallback((plan: InterventionPlan) => {
    const updated = upsertPlan(region, plan);
    setPlans(updated);
  }, [region]);

  const handleDeletePlan = useCallback((planId: string) => {
    if (!window.confirm('이 조치를 삭제하시겠습니까?')) return;
    const updated = deletePlan(region, planId);
    setPlans(updated);
  }, [region]);

  const handleStatusChange = useCallback((planId: string, newStatus: PlanStatus) => {
    if (newStatus === 'REJECTED') {
      setRejectTargetId(planId);
      setRejectMemo('');
      setRejectDialogOpen(true);
      return;
    }
    const updated = transitionPlanStatus(region, planId, newStatus);
    setPlans(updated);
  }, [region]);

  const handleRejectConfirm = useCallback(() => {
    if (!rejectTargetId || !rejectMemo.trim()) return;
    const updated = transitionPlanStatus(region, rejectTargetId, 'REJECTED', rejectMemo.trim());
    setPlans(updated);
    setRejectDialogOpen(false);
    setRejectTargetId(null);
  }, [region, rejectTargetId, rejectMemo]);

  const handleRegenerateAI = useCallback(() => {
    const recs = generateRecommendations(bottlenecks, region, plans);
    if (recs.length === 0) {
      alert('모든 병목에 대한 조치가 이미 존재합니다. 신규 초안이 없습니다.');
      return;
    }
    const merged = [...plans, ...recs];
    savePlans(region, merged);
    setPlans(merged);
    alert(`${recs.length}건의 AI 초안이 추가되었습니다. 기존 관리자 수정 항목은 유지됩니다.`);
  }, [bottlenecks, region, plans]);

  const handleOpenNew = () => {
    setEditTarget(null);
    setEditModalOpen(true);
  };

  const handleEdit = (plan: InterventionPlan) => {
    setEditTarget(plan);
    setEditModalOpen(true);
  };

  const clearFilters = () => {
    setHighlightKpi(null);
    setHighlightBnType(null);
    setFilterStatus(null);
    setFilterCenter('');
    setSearchText('');
  };

  // ═══════════════════════════════════════════════════════════
  // 통계 계산
  // ═══════════════════════════════════════════════════════════
  const statusCounts = useMemo(() => {
    const counts: Record<PlanStatus, number> = { DRAFT: 0, APPROVED: 0, IN_PROGRESS: 0, DONE: 0, REJECTED: 0 };
    plans.forEach(p => counts[p.status]++);
    return counts;
  }, [plans]);

  const bnTypeCounts = useMemo(() => {
    const counts: Partial<Record<BottleneckType, number>> = {};
    bottlenecks.forEach(b => { counts[b.bottleneckType] = (counts[b.bottleneckType] ?? 0) + 1; });
    return counts;
  }, [bottlenecks]);

  const impactCounts = useMemo(() => {
    const counts: Record<Impact, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    bottlenecks.forEach(b => counts[b.impact]++);
    return counts;
  }, [bottlenecks]);

  // 센터 목록 (필터용)
  const centerNames = useMemo(() => {
    const names = new Set(bottlenecks.map(b => b.centerName));
    plans.forEach(p => names.add(p.centerName));
    return Array.from(names).sort();
  }, [bottlenecks, plans]);

  const hasActiveFilter = filterStatus || filterCenter || searchText || highlightKpi || highlightBnType;

  // ═══════════════════════════════════════════════════════════
  // 상태 전이 버튼 결정
  // ═══════════════════════════════════════════════════════════
  const getNextStatusActions = (status: PlanStatus): { label: string; next: PlanStatus; variant: 'default' | 'outline' | 'destructive' }[] => {
    switch (status) {
      case 'DRAFT': return [
        { label: '승인', next: 'APPROVED', variant: 'default' },
        { label: '반려', next: 'REJECTED', variant: 'destructive' },
      ];
      case 'APPROVED': return [
        { label: '시행 시작', next: 'IN_PROGRESS', variant: 'default' },
        { label: '반려', next: 'REJECTED', variant: 'destructive' },
      ];
      case 'IN_PROGRESS': return [
        { label: '완료', next: 'DONE', variant: 'default' },
        { label: '반려', next: 'REJECTED', variant: 'destructive' },
      ];
      case 'DONE': return [];
      case 'REJECTED': return [
        { label: '초안으로 복귀', next: 'DRAFT', variant: 'outline' },
      ];
      default: return [];
    }
  };

  // ─── 최근 업데이트 ───
  const latestUpdate = useMemo(() => {
    const dates = bottlenecks.map(b => b.updatedAt).sort().reverse();
    return dates[0] ? new Date(dates[0]).toLocaleString('ko-KR') : '-';
  }, [bottlenecks]);

  return (
    <div className="h-full overflow-auto bg-gray-50">
      {/* ═══════════════════════════════════════════════════════
         헤더
      ═══════════════════════════════════════════════════════ */}
      <div className="border-b-2 border-gray-900 bg-white sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                병목 기반 개입 관리
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                WHY (병목 원인) → WHAT (권장 조치) → HOW (실행 추적) 통합 운영
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* 내보내기 */}
              <div className="relative">
                <Button variant="outline" onClick={() => setExportMenuOpen(o => !o)}>
                  <Download className="h-4 w-4 mr-2" />
                  계획서 내보내기
                </Button>
                {exportMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                      <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { exportPlansAsJson(filteredPlans); setExportMenuOpen(false); }}>
                        JSON 내보내기
                      </button>
                      <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { exportPlansAsCsv(filteredPlans); setExportMenuOpen(false); }}>
                        CSV 내보내기
                      </button>
                    </div>
                  </>
                )}
              </div>
              {onNavigateToBottleneck && (
                <Button variant="outline" onClick={onNavigateToBottleneck}>
                  병목 분석 탭
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-8">
        {/* ═══════════════════════════════════════════════════════
           WHY: 병목 요약 패널
        ═══════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">W</span>
            병목 요약 (WHY)
          </h2>

          {/* 상단 통계 카드 */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {/* 병목 유형 분포 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2 font-medium">병목 유형</div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(bnTypeCounts) as [BottleneckType, number][]).map(([t, c]) => (
                  <button key={t}
                    onClick={() => setHighlightBnType(prev => prev === t ? null : t)}
                    className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                      highlightBnType === t
                        ? 'bg-amber-100 text-amber-800 border-amber-400 ring-2 ring-amber-200'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {BOTTLENECK_TYPE_LABELS[t]} <span className="font-bold">{c}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 영향도 분포 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2 font-medium">영향도</div>
              <div className="flex gap-3">
                {(['HIGH', 'MEDIUM', 'LOW'] as Impact[]).map(imp => (
                  <div key={imp} className="text-center">
                    <div className={`text-2xl font-bold ${imp === 'HIGH' ? 'text-red-600' : imp === 'MEDIUM' ? 'text-amber-600' : 'text-green-600'}`}>
                      {impactCounts[imp]}
                    </div>
                    <div className="text-[10px] text-gray-500">{IMPACT_LABELS[imp]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 총 조치 / 상태 보드 (HOW 미리 보기) */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2 font-medium">조치 현황</div>
              <div className="text-3xl font-bold text-gray-900">{plans.length}<span className="text-sm text-gray-500 font-normal">건</span></div>
              <div className="text-xs text-gray-500 mt-1">
                DRAFT {statusCounts.DRAFT} · 승인 {statusCounts.APPROVED} · 시행 {statusCounts.IN_PROGRESS} · 완료 {statusCounts.DONE}
              </div>
            </div>

            {/* 최근 업데이트 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2 font-medium">최근 업데이트</div>
              <div className="text-sm font-medium text-gray-900">{latestUpdate}</div>
              <div className="text-xs text-gray-500 mt-1">병목 시그널 {bottlenecks.length}개 모니터링</div>
            </div>
          </div>

          {/* 병목 시그널 테이블 */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700">센터</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700">병목 유형</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700">영향도</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700">약한 KPI</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700">근거</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700 w-20">조치</th>
                </tr>
              </thead>
              <tbody>
                {bottlenecks.map(bn => {
                  const planCount = plans.filter(p => p.linkedBottleneckId === bn.id).length;
                  const isHl = highlightBnType === bn.bottleneckType || highlightKpi && bn.weakKpis.some(k => k.includes(highlightKpi));
                  return (
                    <tr key={bn.id} className={`border-b border-gray-100 transition-colors ${
                      isHl ? 'bg-amber-50' : 'hover:bg-gray-50'
                    }`}>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-gray-900">{bn.centerName}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs">
                          {BOTTLENECK_TYPE_LABELS[bn.bottleneckType]}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className={IMPACT_COLORS[bn.impact] + ' text-xs'}>
                          {IMPACT_LABELS[bn.impact]}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {bn.weakKpis.map((kpi, i) => (
                            <button key={i}
                              onClick={() => setHighlightKpi(prev => prev === kpi ? null : kpi)}
                              className={`px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                                highlightKpi === kpi
                                  ? 'bg-blue-100 text-blue-700 border-blue-300 ring-1 ring-blue-200'
                                  : kpi === '우수'
                                    ? 'bg-green-50 text-green-700 border-green-300'
                                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              {kpi}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-0.5">
                          {bn.evidence.slice(0, 2).map((ev, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-gray-600">
                              {ev.trend === 'UP' ? <TrendingUp className="h-3 w-3 text-red-500" /> : ev.trend === 'DOWN' ? <TrendingDown className="h-3 w-3 text-green-500" /> : null}
                              <span>{ev.kpi}{ev.value != null ? `: ${typeof ev.value === 'number' && ev.value > 0 ? '+' : ''}${ev.value}` : ''}</span>
                              {ev.note && <span className="text-gray-400">({ev.note})</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-sm font-semibold text-blue-600">{planCount}</span>
                        <span className="text-xs text-gray-500">건</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           WHAT: 권장 조치 리스트 (편집 가능)
        ═══════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">W</span>
            권장 조치 (WHAT)
          </h2>

          {/* 상단 액션 바 */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button onClick={handleOpenNew}>
                <Plus className="h-4 w-4 mr-1" />
                조치 추가
              </Button>
              <Button variant="outline" onClick={handleRegenerateAI}>
                <Sparkles className="h-4 w-4 mr-1 text-amber-500" />
                AI 권장 조치 재생성
              </Button>
            </div>

            {/* 필터 */}
            <div className="flex items-center gap-2">
              {/* 센터 필터 */}
              <select
                className="bg-white border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={filterCenter}
                onChange={e => setFilterCenter(e.target.value)}
              >
                <option value="">전체 센터</option>
                {centerNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>

              {/* 검색 */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  className="pl-7 pr-3 py-1.5 bg-white border border-gray-300 rounded text-xs w-44 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="제목, KPI 검색..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
              </div>

              {/* 필터 해제 */}
              {hasActiveFilter && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-gray-500">
                  <XCircle className="h-3.5 w-3.5 mr-1" />필터 해제
                </Button>
              )}
            </div>
          </div>

          {/* 조치 테이블 */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700 w-[22%]">조치 제목</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700 w-[12%]">센터</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700 w-[7%]">유형</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700 w-[12%]">연결 KPI</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700 w-[7%]">우선</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700 w-[7%]">상태</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700 w-[7%]">생성</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700 w-[7%]">기간</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700 w-[19%]">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-400">조건에 맞는 조치가 없습니다</td></tr>
                )}
                {filteredPlans.map(plan => {
                  const hl = isPlanHighlighted(plan);
                  const actions = getNextStatusActions(plan.status);
                  return (
                    <tr key={plan.id}
                      className={`border-b border-gray-100 transition-all ${
                        !hl && (highlightKpi || highlightBnType) ? 'opacity-30' : 'hover:bg-gray-50'
                      } ${hl && (highlightKpi || highlightBnType) ? 'bg-blue-50 border-l-4 border-l-blue-400' : ''}`}
                    >
                      {/* 제목 */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-gray-900 line-clamp-1">{plan.title}</div>
                        {plan.adminMemo && <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">📝 {plan.adminMemo}</div>}
                      </td>
                      {/* 센터 */}
                      <td className="py-2.5 px-3 text-gray-700 text-xs">{plan.centerName}</td>
                      {/* 유형 */}
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${
                          plan.type === 'TRAINING' ? 'bg-indigo-50 text-indigo-700 border-indigo-300' :
                          plan.type === 'STAFFING' ? 'bg-purple-50 text-purple-700 border-purple-300' :
                          'bg-cyan-50 text-cyan-700 border-cyan-300'
                        }`}>
                          {TYPE_LABELS[plan.type]}
                        </Badge>
                      </td>
                      {/* KPI */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {plan.linkedKpis.slice(0, 3).map((k, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">{k}</span>
                          ))}
                        </div>
                      </td>
                      {/* 우선순위 */}
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className={IMPACT_COLORS[plan.priority] + ' text-[10px]'}>
                          {IMPACT_LABELS[plan.priority]}
                        </Badge>
                      </td>
                      {/* 상태 */}
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className={STATUS_COLORS[plan.status] + ' text-[10px]'}>
                          {STATUS_LABELS[plan.status]}
                        </Badge>
                      </td>
                      {/* 생성자 */}
                      <td className="py-2.5 px-3 text-center text-[10px] text-gray-500">
                        {plan.createdBy === 'AI' && <span className="text-amber-600 font-medium">AI</span>}
                        {plan.createdBy === 'ADMIN_EDIT' && <span className="text-blue-600 font-medium">수정</span>}
                        {plan.createdBy === 'ADMIN_MANUAL' && <span className="text-green-600 font-medium">직접</span>}
                      </td>
                      {/* 기간 */}
                      <td className="py-2.5 px-3 text-center text-xs text-gray-600">
                        {plan.durationDays ? `${plan.durationDays}일` : '-'}
                      </td>
                      {/* 작업 */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {/* 편집 */}
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)} className="h-7 px-2 text-xs">
                            <Edit3 className="h-3 w-3 mr-1" />편집
                          </Button>
                          {/* 상태 전이 */}
                          {actions.map(act => (
                            <Button key={act.next} variant={act.variant as any} size="sm"
                              onClick={() => handleStatusChange(plan.id, act.next)}
                              className="h-7 px-2 text-xs"
                            >
                              {act.label}
                            </Button>
                          ))}
                          {/* 삭제 */}
                          <Button variant="ghost" size="sm" onClick={() => handleDeletePlan(plan.id)} className="h-7 px-1.5 text-xs text-gray-400 hover:text-red-600">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-600">
            <strong>범례:</strong>{' '}
            <span className="text-amber-600 font-medium">AI</span> = 시스템 초안 ·{' '}
            <span className="text-blue-600 font-medium">수정</span> = AI→관리자 수정 ·{' '}
            <span className="text-green-600 font-medium">직접</span> = 관리자 직접 생성 |{' '}
            <strong className="ml-2">총 {filteredPlans.length}건</strong> (전체 {plans.length}건)
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           HOW: 실행/상태 추적
        ═══════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold">H</span>
            실행 추적 (HOW)
          </h2>

          {/* 상태 보드 */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {ALL_STATUSES.map(st => {
              const active = filterStatus === st;
              const Icon = st === 'DRAFT' ? FileText : st === 'APPROVED' ? CheckCircle : st === 'IN_PROGRESS' ? Clock : st === 'DONE' ? CheckCircle : XCircle;
              return (
                <button key={st}
                  onClick={() => setFilterStatus(prev => prev === st ? null : st)}
                  className={`bg-white border rounded-lg p-4 text-left transition-all ${
                    active ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className={STATUS_COLORS[st] + ' text-xs'}>{STATUS_LABELS[st]}</Badge>
                    <Icon className={`h-4 w-4 ${
                      st === 'DRAFT' ? 'text-gray-400' : st === 'APPROVED' ? 'text-blue-500' : st === 'IN_PROGRESS' ? 'text-purple-500' : st === 'DONE' ? 'text-green-500' : 'text-red-500'
                    }`} />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mt-2">{statusCounts[st]}</div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {st === 'DRAFT' ? '검토 대기' : st === 'APPROVED' ? '시행 예정' : st === 'IN_PROGRESS' ? '진행 중' : st === 'DONE' ? '처리 완료' : '사유 확인'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 상태 흐름 안내 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Badge variant="outline" className={STATUS_COLORS['DRAFT']}>초안</Badge>
            <ArrowRight className="h-3.5 w-3.5" />
            <Badge variant="outline" className={STATUS_COLORS['APPROVED']}>승인</Badge>
            <ArrowRight className="h-3.5 w-3.5" />
            <Badge variant="outline" className={STATUS_COLORS['IN_PROGRESS']}>시행중</Badge>
            <ArrowRight className="h-3.5 w-3.5" />
            <Badge variant="outline" className={STATUS_COLORS['DONE']}>완료</Badge>
            <span className="ml-4 text-gray-400">|</span>
            <span className="ml-2">어느 단계에서든</span>
            <Badge variant="outline" className={STATUS_COLORS['REJECTED']}>반려</Badge>
            <span>가능 (사유 필수)</span>
          </div>

          {/* 최근 승인/완료 이력 */}
          {plans.filter(p => p.approvedAt).length > 0 && (
            <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">최근 승인/완료 이력</h3>
              <div className="space-y-1.5">
                {plans.filter(p => p.approvedAt).sort((a, b) => (b.approvedAt ?? '').localeCompare(a.approvedAt ?? '')).slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs text-gray-600">
                    <Badge variant="outline" className={STATUS_COLORS[p.status] + ' text-[10px]'}>{STATUS_LABELS[p.status]}</Badge>
                    <span className="font-medium text-gray-900">{p.title}</span>
                    <span className="text-gray-400">승인: {new Date(p.approvedAt!).toLocaleDateString('ko-KR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 분석 기준 */}
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-600">
            <strong>분석 기준:</strong> 최근 2개월 KPI 데이터, 인력 현황, 병목 분석 결과 종합 |
            <strong className="ml-3">업데이트:</strong> 매주 월요일 09:00 |
            <strong className="ml-3">담당:</strong> 광역센터장 |
            <strong className="ml-3">데이터 저장:</strong> localStorage (region: {region})
          </div>
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════
         모달: 편집/추가
      ═══════════════════════════════════════════════════════ */}
      <PlanEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        plan={editTarget}
        bottlenecks={bottlenecks}
        region={region}
        onSave={handleSavePlan}
      />

      {/* ═══════════════════════════════════════════════════════
         모달: 반려 사유 입력
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>반려 사유 입력</DialogTitle>
            <DialogDescription>반려 시 사유를 반드시 입력해야 합니다.</DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <textarea
              className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="반려 사유를 입력하세요..."
              value={rejectMemo}
              onChange={e => setRejectMemo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>취소</Button>
            <Button variant="destructive" disabled={!rejectMemo.trim()} onClick={handleRejectConfirm}>
              반려 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
