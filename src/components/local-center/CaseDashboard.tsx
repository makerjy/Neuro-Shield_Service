/**
 * CaseDashboard.tsx
 * ─────────────────────────────
 * 케이스 관리 대시보드 — Stage 1 / 2 / 3 탭 통합
 *
 * - Stage 1 (초기 선별): 우선도 기반 정렬, 접촉 상태 필터
 * - Stage 2 (정밀검사→경로배정): 위험도 그룹핑/필터, 전환 상태, 실명 표시
 * - Stage 3 (추적관리): 위험도 + D-day 필터, 이탈 위험, 실명 표시
 *
 * UX 원칙:
 *  - "AI가 진단/판단/결정/확정" 금지 → "참고 결과 / 가능성 / 권장 경로"
 *  - 문구 톤: "안내/확인/기록/연락" 중심
 *  - DEMO 모드 배지 노출
 *  - 최종 조치 주체 = 사례관리자/의료진
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  Search, Filter, Star, Phone, Send, ChevronRight,
  AlertTriangle, CheckCircle, Clock, Eye, Users,
  Activity, FlaskConical, RefreshCw, Calendar,
  Shield, AlertCircle, TrendingUp, X,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import {
  generateCases, generateTasks,
  CONTACT_STATUS_LABELS, CONSULT_STATUS_LABELS,
  SECOND_EXAM_LABELS, SECOND_EXAM_COLORS, EXAM_TYPE_LABELS,
  maskPhone,
  type Case, type RiskLevel, type Task,
} from './caseData';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */
type StageTab = 1 | 2 | 3;

interface StageCase extends Case {
  stage: StageTab;
  /* Stage 2 extended */
  carePathway?: string;
  transitionStatus?: string;
  dataQuality?: 'good' | 'warning' | 'missing';
  dueDate?: string;
  recommendedAction?: string;
  /* Stage 3 extended */
  riskBucket?: string;
  trackingCadence?: string;
  nextReviewDate?: string;
  daysTilReview?: number;
  attritionRisk?: boolean;
  recentChange?: string;
  reviewsCompleted?: number;
}

interface CaseDashboardProps {
  onCaseSelect: (caseId: string, stage?: number) => void;
}

/* ═══════════════════════════════════════════
   Stage Assignment (same logic as StageDashboard)
   ═══════════════════════════════════════════ */
function assignStage(c: Case, idx: number): StageCase {
  const mod = idx % 10;
  let stage: StageTab = 1;
  if (mod >= 6 && mod <= 8) stage = 2;
  else if (mod === 9) stage = 3;
  else if (c.secondExamStatus === 'DONE' || c.secondExamStatus === 'RESULT_CONFIRMED') stage = 3;
  else if (c.secondExamStatus === 'SCHEDULED' || (c.consultStatus === 'DONE' && c.secondExamStatus === 'NONE')) stage = 2;

  const pathways = ['MCI_TRACK', 'NORMAL_TRACK', 'REFERRAL'];
  const transitions2 = ['pending_exam', 'exam_scheduled', 'exam_done', 'mci_not_enrolled', 'referral_review'];
  const buckets = ['high_risk', 'moderate_risk', 'stable'];
  const cadences = ['monthly', 'bimonthly', 'quarterly'];

  const d = new Date();
  d.setDate(d.getDate() + (idx % 45) - 10);
  const dueDateStr = d.toISOString().slice(0, 10);
  const daysTil = Math.round((d.getTime() - Date.now()) / 86400000);

  return {
    ...c,
    stage,
    carePathway: pathways[idx % 3],
    transitionStatus: transitions2[idx % 5],
    dataQuality: idx % 7 === 0 ? 'missing' : idx % 4 === 0 ? 'warning' : 'good',
    dueDate: dueDateStr,
    recommendedAction: stage === 2
      ? ['정밀검사 안내 발송', '예약 생성·연결', '추적관리 등록', '의뢰 검토'][idx % 4]
      : stage === 3
      ? ['재평가 일정 생성', '재접촉 시도', '추적 강도 조정', '보호자 확인'][idx % 4]
      : '초기 선별검사 안내',
    riskBucket: buckets[idx % 3],
    trackingCadence: cadences[idx % 3],
    nextReviewDate: dueDateStr,
    daysTilReview: daysTil,
    attritionRisk: idx % 5 === 0,
    recentChange: idx % 3 === 0 ? '확인 지표 +5점 상승' : idx % 3 === 1 ? '변동 없음' : '확인 지표 -3점 하락',
    reviewsCompleted: Math.floor(idx / 3),
  };
}

/* ═══════════════════════════════════════════
   KPI Definitions
   ═══════════════════════════════════════════ */
const STAGE_KPIS: Record<StageTab, { label: string; color: string; getValue: (cs: StageCase[]) => number }[]> = {
  1: [
    { label: '신규 배정', color: 'text-blue-600', getValue: cs => cs.filter(c => c.status === 'not_contacted').length },
    { label: '접촉 완료', color: 'text-green-600', getValue: cs => cs.filter(c => c.contactStatus === 'REACHED').length },
    { label: '상담 진행', color: 'text-cyan-600', getValue: cs => cs.filter(c => c.consultStatus === 'IN_PROGRESS').length },
    { label: '미접촉', color: 'text-orange-600', getValue: cs => cs.filter(c => c.contactStatus === 'UNREACHED').length },
    { label: '긴급 우선', color: 'text-red-600', getValue: cs => cs.filter(c => c.riskLevel === 'high' && c.contactStatus === 'UNREACHED').length },
  ],
  2: [
    { label: '정밀검사 대기', color: 'text-blue-600', getValue: cs => cs.filter(c => c.transitionStatus === 'pending_exam').length },
    { label: '예약 진행', color: 'text-cyan-600', getValue: cs => cs.filter(c => c.transitionStatus === 'exam_scheduled').length },
    { label: '검사 완료', color: 'text-green-600', getValue: cs => cs.filter(c => c.transitionStatus === 'exam_done').length },
    { label: '추적관리 미등록', color: 'text-orange-600', getValue: cs => cs.filter(c => c.transitionStatus === 'mci_not_enrolled').length },
    { label: '의뢰 검토', color: 'text-red-600', getValue: cs => cs.filter(c => c.transitionStatus === 'referral_review').length },
  ],
  3: [
    { label: '재평가 예정(30일)', color: 'text-blue-600', getValue: cs => cs.filter(c => (c.daysTilReview ?? 99) <= 30 && (c.daysTilReview ?? 0) > 0).length },
    { label: '재평가 지연', color: 'text-red-600', getValue: cs => cs.filter(c => (c.daysTilReview ?? 0) < 0).length },
    { label: '이탈 위험', color: 'text-orange-600', getValue: cs => cs.filter(c => c.attritionRisk).length },
    { label: '고위험 추적', color: 'text-purple-600', getValue: cs => cs.filter(c => c.riskBucket === 'high_risk').length },
    { label: '전환/종료 필요', color: 'text-gray-600', getValue: cs => cs.filter(c => (c.reviewsCompleted ?? 0) >= 4).length },
  ],
};

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */
const getRiskColor = (level: RiskLevel) =>
  level === 'high' ? 'text-red-600 bg-red-50 border-red-200'
    : level === 'medium' ? 'text-orange-600 bg-orange-50 border-orange-200'
    : 'text-green-600 bg-green-50 border-green-200';

const getRiskLabel = (level: RiskLevel) => level === 'high' ? '높음' : level === 'medium' ? '보통' : '양호';

const TRANSITION_LABELS: Record<string, string> = {
  pending_exam: '검사 대기', exam_scheduled: '예약 진행', exam_done: '검사 완료',
  mci_not_enrolled: 'MCI 미등록', referral_review: '의뢰 검토',
};
const BUCKET_LABELS: Record<string, string> = {
  high_risk: '고위험 추적', moderate_risk: '중위험 추적', stable: '안정',
};
const PATHWAY_LABELS: Record<string, string> = {
  MCI_TRACK: 'MCI 경로', NORMAL_TRACK: '일반 경로', REFERRAL: '의뢰 경로',
};

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */
export function CaseDashboard({ onCaseSelect }: CaseDashboardProps) {
  const [activeStage, setActiveStage] = useState<StageTab>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTaskSidebar, setShowTaskSidebar] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Stage 1 filters
  const [s1ContactFilter, setS1ContactFilter] = useState<string>('all');
  const [s1RiskFilter, setS1RiskFilter] = useState<string>('all');

  // Stage 2 filters
  const [s2RiskFilter, setS2RiskFilter] = useState<string>('all');
  const [s2TransitionFilter, setS2TransitionFilter] = useState<string>('all');

  // Stage 3 filters
  const [s3RiskFilter, setS3RiskFilter] = useState<string>('all');
  const [s3DdayFilter, setS3DdayFilter] = useState<string>('all');
  const [s3AttritionFilter, setS3AttritionFilter] = useState<boolean>(false);

  /* ── Data ── */
  const allCases = useMemo(() => generateCases(), []);
  const stageCases = useMemo(() => allCases.map((c, i) => assignStage(c, i)), [allCases]);
  const tasks = useMemo(() => generateTasks(allCases), [allCases]);

  // Toggle favorite
  const toggleFav = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Init favorites from data
  useMemo(() => {
    const initial = new Set<string>();
    allCases.forEach(c => { if (c.isFavorite) initial.add(c.id); });
    setFavorites(initial);
  }, [allCases]);

  /* ── Filtered + Sorted ── */
  const filtered = useMemo(() => {
    let list = stageCases.filter(c => c.stage === activeStage);

    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c =>
        c.id.toLowerCase().includes(q) ||
        c.patientName.toLowerCase().includes(q) ||
        c.counselor.toLowerCase().includes(q)
      );
    }

    // Stage 1 filters
    if (activeStage === 1) {
      if (s1ContactFilter !== 'all') list = list.filter(c => c.contactStatus === s1ContactFilter);
      if (s1RiskFilter !== 'all') list = list.filter(c => c.riskLevel === s1RiskFilter);
      // Sort: 우선도(high→med→low), then 미접촉 first, then 최근 접촉 오래된 순
      list.sort((a, b) => {
        const riskOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const rd = (riskOrder[a.riskLevel] ?? 2) - (riskOrder[b.riskLevel] ?? 2);
        if (rd !== 0) return rd;
        const cd = (a.contactStatus === 'UNREACHED' ? 0 : 1) - (b.contactStatus === 'UNREACHED' ? 0 : 1);
        if (cd !== 0) return cd;
        return (a.lastContact ?? '0000').localeCompare(b.lastContact ?? '0000');
      });
    }

    // Stage 2 filters
    if (activeStage === 2) {
      if (s2RiskFilter !== 'all') list = list.filter(c => c.riskLevel === s2RiskFilter);
      if (s2TransitionFilter !== 'all') list = list.filter(c => c.transitionStatus === s2TransitionFilter);
      // Sort: 위험도(high first) then due date
      list.sort((a, b) => {
        const riskOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const rd = (riskOrder[a.riskLevel] ?? 2) - (riskOrder[b.riskLevel] ?? 2);
        if (rd !== 0) return rd;
        return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
      });
    }

    // Stage 3 filters
    if (activeStage === 3) {
      if (s3RiskFilter !== 'all') list = list.filter(c => c.riskLevel === s3RiskFilter);
      if (s3AttritionFilter) list = list.filter(c => c.attritionRisk);
      if (s3DdayFilter !== 'all') {
        if (s3DdayFilter === 'overdue') list = list.filter(c => (c.daysTilReview ?? 0) < 0);
        else if (s3DdayFilter === '7d') list = list.filter(c => (c.daysTilReview ?? 99) <= 7 && (c.daysTilReview ?? 0) >= 0);
        else if (s3DdayFilter === '30d') list = list.filter(c => (c.daysTilReview ?? 99) <= 30 && (c.daysTilReview ?? 0) >= 0);
      }
      // Sort: overdue first, then nearest D-day
      list.sort((a, b) => (a.daysTilReview ?? 999) - (b.daysTilReview ?? 999));
    }

    return list;
  }, [stageCases, activeStage, searchTerm, s1ContactFilter, s1RiskFilter, s2RiskFilter, s2TransitionFilter, s3RiskFilter, s3DdayFilter, s3AttritionFilter]);

  const kpiValues = useMemo(() => {
    const stageList = stageCases.filter(c => c.stage === activeStage);
    return STAGE_KPIS[activeStage].map(d => ({ ...d, value: d.getValue(stageList) }));
  }, [stageCases, activeStage]);

  const stageCounts = useMemo(() => ({
    1: stageCases.filter(c => c.stage === 1).length,
    2: stageCases.filter(c => c.stage === 2).length,
    3: stageCases.filter(c => c.stage === 3).length,
  }), [stageCases]);

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">케이스 관리</h1>
            <p className="text-xs text-gray-500">강남구 치매안심센터 · <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">DEMO</Badge></p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowTaskSidebar(!showTaskSidebar)}>
              <Clock className="h-3.5 w-3.5 mr-1" />
              오늘 할 일 ({tasks.filter(t => t.priority === 'urgent' || t.priority === 'today').length})
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stage Tabs ── */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-1 bg-gray-100 p-1.5 rounded-xl w-fit">
          {([1, 2, 3] as StageTab[]).map(s => {
            const stageColor = s === 1 ? 'border-blue-500 text-blue-700' : s === 2 ? 'border-violet-500 text-violet-700' : 'border-emerald-500 text-emerald-700';
            const activeBg = s === 1 ? 'bg-white' : s === 2 ? 'bg-white' : 'bg-white';
            return (
              <button
                key={s}
                onClick={() => setActiveStage(s)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] border-l-[3px] ${
                  activeStage === s
                    ? `${activeBg} ${stageColor} shadow-sm`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {s === 1 ? '1차 대상자 (초기 선별)' : s === 2 ? '2차 대상자 (정밀검사)' : '3차 대상자 (추적관리)'}
                <span className="ml-1.5 text-xs font-normal text-gray-400">({stageCounts[s]})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="px-6 py-3">
        <div className="grid grid-cols-5 gap-3">
          {kpiValues.map((kpi, i) => {
            const topBorder = activeStage === 1 ? 'border-t-blue-400' : activeStage === 2 ? 'border-t-violet-400' : 'border-t-emerald-400';
            return (
              <Card key={i} className={`border border-gray-200 border-t-2 ${topBorder} hover:shadow-md transition-shadow cursor-default`}>
                <CardContent className="p-3">
                  <p className="text-xs text-gray-500 truncate">{kpi.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="px-6 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="이름 · ID · 담당자 검색..."
              className="pl-8 h-8 w-56 text-xs"
            />
          </div>

          {/* Stage 1 Filters */}
          {activeStage === 1 && (
            <>
              <Select value={s1ContactFilter} onValueChange={setS1ContactFilter}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="접촉 상태" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">접촉 전체</SelectItem>
                  <SelectItem value="UNREACHED">미접촉</SelectItem>
                  <SelectItem value="REACHED">접촉완료</SelectItem>
                </SelectContent>
              </Select>
              <Select value={s1RiskFilter} onValueChange={setS1RiskFilter}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="우선도" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">우선도 전체</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="medium">보통</SelectItem>
                  <SelectItem value="low">양호</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          {/* Stage 2 Filters */}
          {activeStage === 2 && (
            <>
              <Select value={s2RiskFilter} onValueChange={setS2RiskFilter}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="위험도" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">위험도 전체</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="medium">보통</SelectItem>
                  <SelectItem value="low">양호</SelectItem>
                </SelectContent>
              </Select>
              <Select value={s2TransitionFilter} onValueChange={setS2TransitionFilter}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="전환 상태" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전환 전체</SelectItem>
                  <SelectItem value="pending_exam">검사 대기</SelectItem>
                  <SelectItem value="exam_scheduled">예약 진행</SelectItem>
                  <SelectItem value="exam_done">검사 완료</SelectItem>
                  <SelectItem value="mci_not_enrolled">MCI 미등록</SelectItem>
                  <SelectItem value="referral_review">의뢰 검토</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          {/* Stage 3 Filters */}
          {activeStage === 3 && (
            <>
              <Select value={s3RiskFilter} onValueChange={setS3RiskFilter}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="위험도" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">위험도 전체</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="medium">보통</SelectItem>
                  <SelectItem value="low">양호</SelectItem>
                </SelectContent>
              </Select>
              <Select value={s3DdayFilter} onValueChange={setS3DdayFilter}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="D-day" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">D-day 전체</SelectItem>
                  <SelectItem value="overdue">지연 (D+)</SelectItem>
                  <SelectItem value="7d">7일 이내</SelectItem>
                  <SelectItem value="30d">30일 이내</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <Checkbox
                  checked={s3AttritionFilter}
                  onCheckedChange={(v) => setS3AttritionFilter(!!v)}
                  className="h-4 w-4"
                />
                이탈 위험만
              </label>
            </>
          )}

          <div className="ml-auto text-xs text-gray-400">
            {filtered.length}건 표시
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="px-6 pb-6">
        <div className={`grid gap-4 ${showTaskSidebar ? 'grid-cols-12' : 'grid-cols-1'}`}>
          {/* Case Table */}
          <div className={showTaskSidebar ? 'col-span-9' : 'col-span-1'}>
            <Card>
              <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-xs">
                  <thead className={`sticky top-0 z-[1] ${activeStage === 1 ? 'bg-blue-50/70' : activeStage === 2 ? 'bg-violet-50/70' : 'bg-emerald-50/70'}`}>
                    <tr>
                      <th className="px-2 py-2.5 text-left w-8">★</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">
                        {activeStage === 1 ? 'ID' : '대상자'}
                      </th>
                      {activeStage >= 2 && (
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">연령/성별</th>
                      )}
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">
                        {activeStage === 1 ? '우선도' : '위험도'}
                      </th>

                      {/* Stage 1 columns */}
                      {activeStage === 1 && (
                        <>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">이름</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">접촉 상태</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">상담</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">2차 검사</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">최근 접촉</th>
                        </>
                      )}

                      {/* Stage 2 columns */}
                      {activeStage === 2 && (
                        <>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">전환 상태</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">관리경로(참고)</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Due</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">데이터</th>
                        </>
                      )}

                      {/* Stage 3 columns */}
                      {activeStage === 3 && (
                        <>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">D-day</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">추적 분류</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">이탈</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">최근 변화</th>
                        </>
                      )}

                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">담당</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">권장 조치</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600">상세</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(c => (
                      <tr
                        key={c.id}
                        className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                        onClick={() => onCaseSelect(c.id, c.stage)}
                      >
                        {/* Favorite */}
                        <td className="px-2 py-2">
                          <button
                            onClick={e => { e.stopPropagation(); toggleFav(c.id); }}
                            className={`text-sm ${favorites.has(c.id) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                          >
                            ★
                          </button>
                        </td>

                        {/* ID or Name (Stage 2/3 shows real name) */}
                        {activeStage === 1 ? (
                          <td className="px-3 py-2 font-mono text-blue-600 text-[11px]">{c.id.replace('CASE-2026-', '')}</td>
                        ) : (
                          <td className="px-3 py-2">
                            <span className="font-semibold text-gray-900">{c.patientName}</span>
                            <span className="block text-[10px] text-gray-400 font-mono">{c.id.replace('CASE-2026-', '')}</span>
                          </td>
                        )}

                        {/* Age/Gender for Stage 2/3 */}
                        {activeStage >= 2 && (
                          <td className="px-3 py-2 text-gray-600">{c.age}세 · {c.gender}</td>
                        )}

                        {/* Risk / Priority */}
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getRiskColor(c.riskLevel)}`}>
                            {getRiskLabel(c.riskLevel)} {c.riskScore}
                          </span>
                        </td>

                        {/* ── Stage 1 specific ── */}
                        {activeStage === 1 && (
                          <>
                            <td className="px-3 py-2 font-medium text-gray-800">{c.patientName}</td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={c.contactStatus === 'UNREACHED' ? 'destructive' : 'default'}
                                className="text-[10px]"
                              >
                                {CONTACT_STATUS_LABELS[c.contactStatus]}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{CONSULT_STATUS_LABELS[c.consultStatus]}</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className={`text-[10px] ${SECOND_EXAM_COLORS[c.secondExamStatus]}`}>
                                {SECOND_EXAM_LABELS[c.secondExamStatus]}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-gray-500">{c.lastContact ?? '—'}</td>
                          </>
                        )}

                        {/* ── Stage 2 specific ── */}
                        {activeStage === 2 && (
                          <>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                c.transitionStatus === 'exam_done' ? 'bg-green-50 text-green-700' :
                                c.transitionStatus === 'referral_review' ? 'bg-red-50 text-red-700' :
                                c.transitionStatus === 'mci_not_enrolled' ? 'bg-orange-50 text-orange-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {TRANSITION_LABELS[c.transitionStatus ?? ''] ?? c.transitionStatus}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                                {PATHWAY_LABELS[c.carePathway ?? ''] ?? c.carePathway}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500">{c.dueDate?.slice(5)}</td>
                            <td className="px-3 py-2">
                              {c.dataQuality === 'missing' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                              {c.dataQuality === 'warning' && <AlertCircle className="h-3.5 w-3.5 text-orange-500" />}
                              {c.dataQuality === 'good' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                            </td>
                          </>
                        )}

                        {/* ── Stage 3 specific ── */}
                        {activeStage === 3 && (
                          <>
                            <td className="px-3 py-2">
                              <span className={`font-mono text-xs font-bold ${
                                (c.daysTilReview ?? 0) < 0 ? 'text-red-600' :
                                (c.daysTilReview ?? 0) <= 7 ? 'text-orange-600' : 'text-gray-600'
                              }`}>
                                D{(c.daysTilReview ?? 0) >= 0 ? `-${c.daysTilReview}` : `+${Math.abs(c.daysTilReview ?? 0)}`}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                c.riskBucket === 'high_risk' ? 'bg-red-50 text-red-700' :
                                c.riskBucket === 'moderate_risk' ? 'bg-orange-50 text-orange-700' :
                                'bg-green-50 text-green-700'
                              }`}>
                                {BUCKET_LABELS[c.riskBucket ?? ''] ?? c.riskBucket}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {c.attritionRisk && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                                  ⚠ 확인 필요
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-gray-500 max-w-[100px] truncate">
                              {c.recentChange}
                            </td>
                          </>
                        )}

                        {/* Counselor */}
                        <td className="px-3 py-2 text-gray-600">{c.counselor}</td>

                        {/* Recommended action */}
                        <td className="px-3 py-2 text-[11px] text-gray-700 max-w-[120px] truncate">
                          {c.recommendedAction}
                        </td>

                        {/* Detail button */}
                        <td className="px-3 py-2 text-center">
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0"
                            onClick={e => { e.stopPropagation(); onCaseSelect(c.id, c.stage); }}
                          >
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </Button>
                        </td>
                      </tr>
                    ))}

                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={20} className="px-6 py-12 text-center text-gray-400">
                          <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p>조건에 맞는 케이스가 없습니다</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* ── Task Sidebar ── */}
          {showTaskSidebar && (
            <div className="col-span-3 space-y-3">
              <Card>
                <CardHeader className="py-3 px-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">오늘 할 일</CardTitle>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowTaskSidebar(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-[520px] overflow-auto">
                  {tasks.slice(0, 15).map(t => (
                    <div
                      key={t.id}
                      className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => onCaseSelect(t.caseId, 1)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          t.priority === 'urgent' ? 'bg-red-500' :
                          t.priority === 'today' ? 'bg-orange-500' : 'bg-blue-400'
                        }`} />
                        <span className="text-xs font-medium text-gray-800 truncate">{t.title}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 pl-4">{t.patientName} · {t.description.slice(0, 30)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Disclaimer */}
              <div className="bg-gray-100 border border-gray-200 rounded p-3">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  ※ 본 정보는 참고용이며 최종 조치는 사례관리자/의료진이 확인합니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
