/**
 * StageDashboard.tsx
 * ─────────────────────────────
 * 치매안심센터(Local Center) Stage 1/2/3 목적 중심 대시보드
 * - Stage 1: 초기 선별 (기존 레이아웃 유지, 문구 정리)
 * - Stage 2: 정밀검사 권유~관리경로 배정
 * - Stage 3: 추적관리 (재평가/이탈방지)
 *
 * Non-Negotiables:
 *  - "AI가 진단/판단/결정/확정" 금지, "참고 결과/가능성/권장 경로" 사용
 *  - Stage 2/3 민감 CTA는 sensitiveAccess=GRANTED 일 때만
 *  - 최종 조치 주체: 사례관리자/의료진
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, Clock, Phone, Send, Eye, ChevronRight,
  Calendar, Shield, Activity, FlaskConical, RefreshCw, Users,
  FileText, AlertCircle, TrendingUp, ArrowLeft, Search, Filter, Star,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import { generateCases, type Case, type RiskLevel } from './caseData';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */
type StageTab = 1 | 2 | 3;

interface StageCase extends Case {
  stage: StageTab;
  /* Stage 2 fields */
  carePathway?: string;        // MCI_TRACK, NORMAL_TRACK, REFERRAL
  transitionStatus?: string;   // pending_exam, exam_scheduled, exam_done, mci_not_enrolled, referral_review
  dataQuality?: 'good' | 'warning' | 'missing';
  dueDate?: string;
  recommendedAction?: string;
  /* Stage 3 fields */
  riskBucket?: string;         // high_risk, moderate_risk, stable
  trackingCadence?: string;    // monthly, bimonthly, quarterly
  nextReviewDate?: string;
  daysTilReview?: number;
  attritionRisk?: boolean;
  recentChange?: string;
  reviewsCompleted?: number;
}

type SensitiveAccess = 'GRANTED' | 'DENIED' | 'PENDING';

/* ═══════════════════════════════════════════
   Mock Data Generation
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
    recentChange: idx % 3 === 0 ? '위험도 +5점 상승' : idx % 3 === 1 ? '변동 없음' : '위험도 -3점 하락',
    reviewsCompleted: Math.floor(idx / 3),
  };
}

/* ═══════════════════════════════════════════
   KPI Definitions per Stage
   ═══════════════════════════════════════════ */
const STAGE_KPIS: Record<StageTab, { label: string; color: string; getValue: (cases: StageCase[]) => number }[]> = {
  1: [
    { label: '신규 배정', color: 'text-blue-600', getValue: cs => cs.filter(c => c.status === 'not_contacted').length },
    { label: '접촉 완료', color: 'text-green-600', getValue: cs => cs.filter(c => c.contactStatus === 'REACHED').length },
    { label: '상담 진행', color: 'text-cyan-600', getValue: cs => cs.filter(c => c.consultStatus === 'IN_PROGRESS').length },
    { label: '미접촉', color: 'text-orange-600', getValue: cs => cs.filter(c => c.contactStatus === 'UNREACHED').length },
    { label: '긴급 우선', color: 'text-red-600', getValue: cs => cs.filter(c => c.riskLevel === 'high' && c.contactStatus === 'UNREACHED').length },
  ],
  2: [
    { label: '정밀검사 권유 대기', color: 'text-blue-600', getValue: cs => cs.filter(c => c.transitionStatus === 'pending_exam').length },
    { label: '예약 진행 중', color: 'text-cyan-600', getValue: cs => cs.filter(c => c.transitionStatus === 'exam_scheduled').length },
    { label: '정밀검사 완료', color: 'text-green-600', getValue: cs => cs.filter(c => c.transitionStatus === 'exam_done').length },
    { label: 'MCI 추적관리 미등록', color: 'text-orange-600', getValue: cs => cs.filter(c => c.transitionStatus === 'mci_not_enrolled').length },
    { label: '의뢰 검토 필요', color: 'text-red-600', getValue: cs => cs.filter(c => c.transitionStatus === 'referral_review').length },
  ],
  3: [
    { label: '재평가 예정(30일)', color: 'text-blue-600', getValue: cs => cs.filter(c => (c.daysTilReview ?? 99) <= 30 && (c.daysTilReview ?? 0) > 0).length },
    { label: '재평가 지연', color: 'text-red-600', getValue: cs => cs.filter(c => (c.daysTilReview ?? 0) < 0).length },
    { label: '연락 실패/이탈 위험', color: 'text-orange-600', getValue: cs => cs.filter(c => c.attritionRisk).length },
    { label: '고위험 추적군', color: 'text-purple-600', getValue: cs => cs.filter(c => c.riskBucket === 'high_risk').length },
    { label: '추적 전환/종료 필요', color: 'text-gray-600', getValue: cs => cs.filter(c => c.reviewsCompleted && c.reviewsCompleted >= 4).length },
  ],
};

/* ═══════════════════════════════════════════
   Stage Dashboard Component
   ═══════════════════════════════════════════ */
interface StageDashboardProps {
  onCaseSelect: (caseId: string) => void;
  centerName?: string;
  sensitiveAccess?: SensitiveAccess;
}

export function StageDashboard({
  onCaseSelect,
  centerName = '강남구 치매안심센터',
  sensitiveAccess = 'GRANTED',
}: StageDashboardProps) {
  const [activeStage, setActiveStage] = useState<StageTab>(1);
  const [period, setPeriod] = useState('30d');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<{ caseId: string; action: string; ts: string }[]>([]);

  /* ── Data ── */
  const allCases = useMemo(() => generateCases(), []);
  const stageCases = useMemo(() => allCases.map((c, i) => assignStage(c, i)), [allCases]);

  const filtered = useMemo(() => {
    return stageCases
      .filter(c => c.stage === activeStage)
      .filter(c => !searchTerm || c.id.toLowerCase().includes(searchTerm.toLowerCase()) || c.patientName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [stageCases, activeStage, searchTerm]);

  const kpiValues = useMemo(() => {
    const defs = STAGE_KPIS[activeStage];
    return defs.map(d => ({ ...d, value: d.getValue(filtered) }));
  }, [filtered, activeStage]);

  const selectedCase = useMemo(() => {
    if (!selectedCaseId) return null;
    return stageCases.find(c => c.id === selectedCaseId) ?? null;
  }, [stageCases, selectedCaseId]);

  /* ── Handlers ── */
  const handleMockAction = useCallback((caseId: string, actionType: string) => {
    // Stage Dashboard actions: mock only (no external service call)
    const ts = new Date().toISOString();
    console.log('[STAGE_ACTION]', { caseId, actionType, ts, result: 'MOCK_SENT' });
    setActionLog(prev => [{ caseId, action: actionType, ts }, ...prev.slice(0, 49)]);
    alert(`[모의 실행] ${actionType} → MOCK_SENT\n※ 본 정보는 참고용이며 최종 조치는 사례관리자/의료진이 확인합니다.`);
  }, []);

  const getRiskColor = (level: RiskLevel) => {
    return level === 'high' ? 'text-red-600 bg-red-50 border-red-200' : level === 'medium' ? 'text-orange-600 bg-orange-50 border-orange-200' : 'text-green-600 bg-green-50 border-green-200';
  };
  const getRiskLabel = (level: RiskLevel) => level === 'high' ? '높음' : level === 'medium' ? '보통' : '양호';

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── Header ─── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Stage 대시보드</h1>
            <p className="text-xs text-gray-500">{centerName} · {sensitiveAccess === 'GRANTED' ? '🔓 민감정보 접근 허용' : '🔒 민감정보 접근 제한'}</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">최근 7일</SelectItem>
                <SelectItem value="30d">최근 30일</SelectItem>
                <SelectItem value="90d">최근 90일</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ─── Stage Segment ─── */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {([1, 2, 3] as StageTab[]).map(s => (
            <button
              key={s}
              onClick={() => { setActiveStage(s); setSelectedCaseId(null); }}
              className={`px-5 py-2 rounded-md text-sm font-semibold transition-all min-h-[44px] ${
                activeStage === s
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 1 ? '1차 대상자' : s === 2 ? '2차 대상자' : '3차 대상자'}
              <span className="ml-1.5 text-xs font-normal text-gray-400">
                ({stageCases.filter(c => c.stage === s).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="px-6 py-3">
        <div className="grid grid-cols-5 gap-3">
          {kpiValues.map((kpi, i) => (
            <Card key={i} className="border border-gray-200">
              <CardContent className="p-3">
                <p className="text-xs text-gray-500 truncate">{kpi.label}</p>
                <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ─── Main: Queue + Guidance ─── */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-12 gap-4">
          {/* Left: Case Queue */}
          <div className="col-span-8">
            <Card>
              <CardHeader className="py-3 px-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">케이스 큐 ({filtered.length}건)</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        placeholder="검색..." className="pl-8 h-8 w-48 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <div className="overflow-auto max-h-[520px]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">ID</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">이름</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">{activeStage === 1 ? '우선도' : '위험도'}</th>
                      {activeStage === 1 && <th className="px-3 py-2 text-left font-semibold text-gray-600">접촉상태</th>}
                      {activeStage === 2 && (
                        <>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Due</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">관리경로(참고)</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">전환 상태</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">데이터 품질</th>
                        </>
                      )}
                      {activeStage === 3 && (
                        <>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">D-day</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">위험 버킷(참고)</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">이탈 위험</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">최근 변화</th>
                        </>
                      )}
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">권장 다음 조치</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">CTA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.slice(0, 50).map(c => (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCaseId(c.id)}
                        className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedCaseId === c.id ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-3 py-2 font-mono text-blue-600">{c.id.replace('CASE-2026-', '')}</td>
                        <td className="px-3 py-2 font-medium">{c.patientName}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getRiskColor(c.riskLevel)}`}>
                            {getRiskLabel(c.riskLevel)}
                          </span>
                        </td>

                        {/* Stage 1 columns */}
                        {activeStage === 1 && (
                          <td className="px-3 py-2">
                            <Badge variant={c.contactStatus === 'UNREACHED' ? 'destructive' : 'default'} className="text-[10px]">
                              {c.contactStatus === 'UNREACHED' ? '미접촉' : '접촉완료'}
                            </Badge>
                          </td>
                        )}

                        {/* Stage 2 columns */}
                        {activeStage === 2 && (
                          <>
                            <td className="px-3 py-2 text-gray-500">{c.dueDate?.slice(5)}</td>
                            <td className="px-3 py-2">
                              <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{c.carePathway}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                c.transitionStatus === 'exam_done' ? 'bg-green-50 text-green-700' :
                                c.transitionStatus === 'referral_review' ? 'bg-red-50 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{c.transitionStatus}</span>
                            </td>
                            <td className="px-3 py-2">
                              {c.dataQuality === 'missing' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                              {c.dataQuality === 'warning' && <AlertCircle className="h-3.5 w-3.5 text-orange-500" />}
                              {c.dataQuality === 'good' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                            </td>
                          </>
                        )}

                        {/* Stage 3 columns */}
                        {activeStage === 3 && (
                          <>
                            <td className="px-3 py-2">
                              <span className={`font-mono text-xs font-bold ${(c.daysTilReview ?? 0) < 0 ? 'text-red-600' : (c.daysTilReview ?? 0) <= 7 ? 'text-orange-600' : 'text-gray-600'}`}>
                                D{(c.daysTilReview ?? 0) >= 0 ? `-${c.daysTilReview}` : `+${Math.abs(c.daysTilReview ?? 0)}`}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                c.riskBucket === 'high_risk' ? 'bg-red-50 text-red-700' :
                                c.riskBucket === 'moderate_risk' ? 'bg-orange-50 text-orange-700' :
                                'bg-green-50 text-green-700'
                              }`}>{c.riskBucket}</span>
                            </td>
                            <td className="px-3 py-2">
                              {c.attritionRisk && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">⚠ 이탈위험</span>}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">{c.recentChange}</td>
                          </>
                        )}

                        <td className="px-3 py-2 text-xs text-gray-700 max-w-[120px] truncate">{c.recommendedAction}</td>
                        <td className="px-3 py-2">
                          {sensitiveAccess === 'GRANTED' || activeStage === 1 ? (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 text-[10px] px-2"
                              onClick={(e) => { e.stopPropagation(); handleMockAction(c.id, c.recommendedAction ?? 'DEFAULT'); }}
                            >
                              실행
                            </Button>
                          ) : (
                            <span className="text-[10px] text-gray-400">🔒 접근 제한</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right: Guidance Panel */}
          <div className="col-span-4 space-y-4">
            {selectedCase ? (
              <>
                {/* Case Summary */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-blue-900">{selectedCase.patientName}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getRiskColor(selectedCase.riskLevel)}`}>
                        {activeStage === 1 ? '우선' : ''} {getRiskLabel(selectedCase.riskLevel)} {selectedCase.riskScore}점
                      </span>
                    </div>
                    <p className="text-xs text-blue-800">
                      {selectedCase.age}세 · {selectedCase.gender} · 담당: {selectedCase.counselor}
                      {activeStage >= 2 && ` · 경로: ${selectedCase.carePathway}`}
                    </p>
                    <Button size="sm" variant="outline" className="mt-3 w-full h-9 text-xs" onClick={() => onCaseSelect(selectedCase.id)}>
                      상세보기 <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Checklist / Guidance */}
                <Card>
                  <CardHeader className="py-3 px-4 border-b border-gray-200">
                    <CardTitle className="text-xs font-semibold text-gray-600">
                      {activeStage === 1 ? '초기 대응 체크리스트' : activeStage === 2 ? '2차 검사 체크리스트' : '추적관리 체크리스트'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {activeStage === 1 && (
                        <>
                          <CheckItem done={selectedCase.contactStatus === 'REACHED'}>대상자 접촉 완료</CheckItem>
                          <CheckItem done={selectedCase.consultStatus === 'DONE'}>초기 상담 수행</CheckItem>
                          <CheckItem done={selectedCase.secondExamStatus !== 'NONE'}>선별검사 예약/의뢰</CheckItem>
                          <CheckItem done={false}>결과 확인 및 경로 안내</CheckItem>
                        </>
                      )}
                      {activeStage === 2 && (
                        <>
                          <CheckItem done={selectedCase.transitionStatus !== 'pending_exam'}>정밀검사 안내 발송</CheckItem>
                          <CheckItem done={selectedCase.transitionStatus === 'exam_scheduled' || selectedCase.transitionStatus === 'exam_done'}>예약 확정</CheckItem>
                          <CheckItem done={selectedCase.transitionStatus === 'exam_done'}>검사 완료 확인</CheckItem>
                          <CheckItem done={false}>관리경로 배정 (참고 분류 확인)</CheckItem>
                          <CheckItem done={false}>추적관리 등록 여부 확인</CheckItem>
                        </>
                      )}
                      {activeStage === 3 && (
                        <>
                          <CheckItem done={(selectedCase.daysTilReview ?? 99) > 0}>재평가 일정 수립</CheckItem>
                          <CheckItem done={!selectedCase.attritionRisk}>이탈 위험 점검</CheckItem>
                          <CheckItem done={false}>보호자 연락 확인</CheckItem>
                          <CheckItem done={(selectedCase.reviewsCompleted ?? 0) > 0}>최근 재평가 완료</CheckItem>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recommended Actions */}
                <Card className="border-green-200">
                  <CardHeader className="py-3 px-4 border-b border-green-200 bg-green-50">
                    <CardTitle className="text-xs font-semibold text-green-800">추천 액션</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                    {activeStage === 2 && sensitiveAccess === 'GRANTED' && (
                      <>
                        {selectedCase.transitionStatus === 'pending_exam' && (
                          <ActionButton label="정밀검사 안내 발송 (모의)" onClick={() => handleMockAction(selectedCase.id, 'STAGE2_SEND_EXAM_GUIDE')} />
                        )}
                        {selectedCase.transitionStatus === 'exam_scheduled' && (
                          <ActionButton label="예약 확인 연락" onClick={() => handleMockAction(selectedCase.id, 'STAGE2_CREATE_RESERVATION')} />
                        )}
                        {selectedCase.transitionStatus === 'mci_not_enrolled' && (
                          <ActionButton label="추적관리 등록" onClick={() => handleMockAction(selectedCase.id, 'STAGE2_ENROLL_FOLLOWUP')} />
                        )}
                        {selectedCase.transitionStatus === 'referral_review' && (
                          <ActionButton label="의뢰 초안 작성" onClick={() => handleMockAction(selectedCase.id, 'STAGE2_CREATE_REFERRAL_DRAFT')} />
                        )}
                      </>
                    )}
                    {activeStage === 3 && sensitiveAccess === 'GRANTED' && (
                      <>
                        <ActionButton label="재평가 일정 생성/변경" onClick={() => handleMockAction(selectedCase.id, 'STAGE3_SCHEDULE_REVIEW')} />
                        {selectedCase.attritionRisk && (
                          <ActionButton label="재접촉 시도 (모의)" onClick={() => handleMockAction(selectedCase.id, 'STAGE3_RECONTACT_ATTEMPT')} variant="destructive" />
                        )}
                      </>
                    )}
                    {activeStage === 1 && (
                      <ActionButton label="초기 상담 시작" onClick={() => onCaseSelect(selectedCase.id)} />
                    )}
                    {(activeStage >= 2 && sensitiveAccess !== 'GRANTED') && (
                      <div className="text-xs text-gray-400 text-center py-2">🔒 민감정보 접근 승인 후 액션을 수행할 수 있습니다.</div>
                    )}
                  </CardContent>
                </Card>

                {/* Stage 3: Recent History */}
                {activeStage === 3 && (
                  <Card>
                    <CardHeader className="py-3 px-4 border-b border-gray-200">
                      <CardTitle className="text-xs font-semibold text-gray-600">최근 3회 이력</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                      {[1, 2, 3].map(n => (
                        <div key={n} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                          <span>재평가 #{(selectedCase.reviewsCompleted ?? 0) + 1 - n} · {n === 1 ? '2주 전' : n === 2 ? '2개월 전' : '5개월 전'}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Fixed Disclaimer */}
                <div className="bg-gray-100 border border-gray-200 rounded p-3">
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    ※ 본 정보는 참고용이며 최종 조치는 사례관리자/의료진이 확인합니다.
                  </p>
                </div>
              </>
            ) : (
              <Card className="border-dashed border-2 border-gray-200">
                <CardContent className="p-8 text-center">
                  <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">좌측 목록에서 케이스를<br />선택해주세요</p>
                </CardContent>
              </Card>
            )}

            {/* Recent Action Log */}
            {actionLog.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4 border-b border-gray-200">
                  <CardTitle className="text-xs font-semibold text-gray-600">최근 수행 로그</CardTitle>
                </CardHeader>
                <CardContent className="p-3 max-h-40 overflow-auto">
                  {actionLog.slice(0, 5).map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px] text-gray-500 py-1">
                      <span className="flex-shrink-0 w-1 h-1 rounded-full bg-green-400 mt-1.5" />
                      <span>{log.ts.slice(11, 19)} · {log.caseId.replace('CASE-2026-', '')} · {log.action}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Helper Components ─── */
function CheckItem({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {done ? <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />}
      <span className={done ? 'text-gray-500 line-through' : 'text-gray-800'}>{children}</span>
    </div>
  );
}

function ActionButton({ label, onClick, variant }: { label: string; onClick: () => void; variant?: string }) {
  return (
    <Button
      size="sm" variant={variant === 'destructive' ? 'destructive' : 'outline'}
      className="w-full h-9 text-xs justify-start min-h-[44px]"
      onClick={onClick}
    >
      <ChevronRight className="h-3 w-3 mr-1.5" />
      {label}
    </Button>
  );
}
