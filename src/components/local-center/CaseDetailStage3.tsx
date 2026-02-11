/**
 * CaseDetailStage3.tsx
 * ─────────────────────────────
 * 3차 대상자 · 케이스 작업 공간 (추적관리)
 * "3초 안에 무엇을 해야 하는지 보이게"
 *
 * 섹션 순서(고정) — CaseDetailStage2와 동일 구조:
 *  [0] Header Strip (sticky)
 *  [1] NEXT ACTION Bar
 *  [2] 상태 요약 카드 4장
 *  [3] 작업 가이드 (인터랙티브 체크리스트)
 *  [4] 커뮤니케이션 패널 (전화 + 문자 + 확인 다이얼로그)
 *  [5] 타임라인
 *  [6] 구조화 메모
 *  [7] 책임·출처·감사
 *  + PII 접근 다이얼로그
 *  + SMS 발송 확인 다이얼로그
 *  + 인라인 Toast 알림
 *
 * 금지: "AI 판단/결정/진단/위험/확정"
 * 허용: "안내/확인 필요/기록/후속 조치"
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Phone, Send, Calendar, FileText,
  CheckCircle, AlertTriangle, Clock, Shield,
  Eye, EyeOff, ChevronDown, ChevronUp,
  RefreshCw, Plus, MessageSquare, PhoneCall,
  Users, Loader2, X, PhoneOff,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '../ui/dialog';
import {
  generateCases,
  CONTACT_STATUS_LABELS, CONSULT_STATUS_LABELS,
  maskPhone,
  type Case, type RiskLevel,
} from './caseData';

/* ═══════════════════════════════════════════
   Stage 3 Extended Fields
   ═══════════════════════════════════════════ */
interface Stage3Case extends Case {
  riskBucket: string;
  trackingCadence: string;
  nextReviewDate: string;
  daysTilReview: number;
  attritionRisk: boolean;
  recentChange: string;
  reviewsCompleted: number;
  recommendedAction: string;
}

function buildStage3(c: Case, idx: number): Stage3Case {
  const buckets = ['high_risk', 'moderate_risk', 'stable'];
  const cadences = ['monthly', 'bimonthly', 'quarterly'];
  const d = new Date(); d.setDate(d.getDate() + (idx % 45) - 10);
  const daysTil = Math.round((d.getTime() - Date.now()) / 86400000);
  return {
    ...c,
    riskBucket: buckets[idx % 3],
    trackingCadence: cadences[idx % 3],
    nextReviewDate: d.toISOString().slice(0, 10),
    daysTilReview: daysTil,
    attritionRisk: idx % 5 === 0,
    recentChange: idx % 3 === 0 ? '확인 지표 +5점 상승' : idx % 3 === 1 ? '변동 없음' : '확인 지표 -3점 하락',
    reviewsCompleted: Math.floor(idx / 3),
    recommendedAction: ['재평가 일정 생성', '재접촉 시도', '추적 강도 조정', '보호자 확인'][idx % 4],
  };
}

const BUCKET_LABELS: Record<string, string> = { high_risk: '고위험 추적', moderate_risk: '중위험 추적', stable: '안정' };
const CADENCE_LABELS: Record<string, string> = { monthly: '월 1회', bimonthly: '격월', quarterly: '분기 1회' };

/* ─── NextAction 분기 맵 (3차 전용) ─── */
function getNextAction(sc: Stage3Case) {
  if (sc.daysTilReview < 0) {
    return {
      sentence: '재평가 기한이 초과되었습니다. 즉시 일정을 수립해 주세요.',
      urgency: 'overdue' as const,
      primary: { label: '재평가 일정 생성', icon: Calendar },
      secondary: [
        { label: '전화 연결', icon: Phone },
        { label: '메모 기록', icon: FileText },
      ],
    };
  }
  if (sc.attritionRisk) {
    return {
      sentence: '이탈 위험이 감지되었습니다. 우선 접촉이 필요합니다.',
      urgency: 'attrition' as const,
      primary: { label: '재접촉 시도', icon: Phone },
      secondary: [
        { label: '보호자 확인', icon: Users },
        { label: '메모 기록', icon: FileText },
      ],
    };
  }
  if (sc.daysTilReview <= 7) {
    return {
      sentence: '재평가일이 임박했습니다. 리마인드를 발송해 주세요.',
      urgency: 'upcoming' as const,
      primary: { label: '리마인드 발송', icon: Send },
      secondary: [
        { label: '전화 연결', icon: Phone },
        { label: '메모 기록', icon: FileText },
      ],
    };
  }
  return {
    sentence: '정기 추적이 정상 진행 중입니다. 상태를 확인해 주세요.',
    urgency: 'normal' as const,
    primary: { label: '상태 확인 기록', icon: FileText },
    secondary: [
      { label: '전화 연결', icon: Phone },
      { label: '문자 발송', icon: Send },
    ],
  };
}

/* ─── 가이드 분기 ─── */
function getGuideItems(sc: Stage3Case): { text: string; defaultDone: boolean }[] {
  const base: { text: string; defaultDone: boolean }[] = [];
  base.push({ text: '재평가 일정 수립', defaultDone: sc.daysTilReview > 0 });
  base.push({ text: '이탈 위험 점검', defaultDone: !sc.attritionRisk });
  base.push({ text: '보호자 연락 확인', defaultDone: false });

  if (sc.daysTilReview < 0) {
    base.push({ text: '기한 초과 — 즉시 접촉 시도', defaultDone: false });
    base.push({ text: '방문 또는 전화 재평가 진행', defaultDone: false });
  } else if (sc.attritionRisk) {
    base.push({ text: '우선 접촉 — 대상자 또는 보호자', defaultDone: false });
    base.push({ text: '추적 강도 상향 검토', defaultDone: false });
  } else if (sc.daysTilReview <= 7) {
    base.push({ text: '리마인드 문자 발송', defaultDone: false });
    base.push({ text: '건강 상태 변화 사전 확인', defaultDone: false });
  } else {
    base.push({ text: '최근 재평가 완료', defaultDone: sc.reviewsCompleted > 0 });
    base.push({ text: '추적 주기 적정성 확인', defaultDone: false });
  }
  return base;
}

/* ─── SMS 템플릿 ─── */
const SMS_TEMPLATES = [
  { id: 'review_guide', label: '재평가 안내',
    preview: (name: string, sc: Stage3Case) =>
      `${name}님, 강남구 치매안심센터입니다. 정기 건강 확인 일정을 안내드립니다. ${sc.nextReviewDate}에 방문 또는 전화 상담이 예정되어 있습니다. 문의: 02-1234-5678` },
  { id: 'visit_remind', label: '방문 예약 리마인드',
    preview: (name: string, sc: Stage3Case) =>
      `${name}님, 강남구 치매안심센터입니다. ${sc.reservation?.date ?? sc.nextReviewDate} 방문 예약 안내입니다. 준비물: 신분증 문의: 02-1234-5678` },
  { id: 'followup', label: '사후관리 안부',
    preview: (name: string) =>
      `${name}님, 강남구 치매안심센터입니다. 최근 건강 상태는 어떠신가요? 도움이 필요하시면 언제든 연락 주세요. 문의: 02-1234-5678` },
];

/* ─── PII Mock Data ─── */
function buildPiiData(c: Case, idx: number) {
  const addresses = ['서울 강남구 역삼동 123-45', '서울 강남구 논현동 67-89', '서울 강남구 삼성동 200-10'];
  const emergNames = ['김영희(딸)', '이철수(아들)', '박미경(배우자)'];
  const medHist = [['고혈압', '당뇨'], ['관절염'], ['고혈압', '고지혈증', '골다공증']];
  return {
    fullName: c.patientName,
    residentNumber: `${1940 + (idx % 30)}0${(idx % 9) + 1}15-${idx % 2 === 0 ? '1' : '2'}******`,
    fullAddress: addresses[idx % 3],
    detailedPhone: c.phone,
    emergencyContactName: emergNames[idx % 3],
    emergencyContact: `010-${String(3000 + idx).padStart(4, '0')}-${String(7000 + idx).padStart(4, '0')}`,
    medicalHistory: medHist[idx % 3],
  };
}

const getRiskColor = (level: RiskLevel) =>
  level === 'high' ? 'text-red-600 bg-red-50 border-red-200'
    : level === 'medium' ? 'text-orange-600 bg-orange-50 border-orange-200'
    : 'text-green-600 bg-green-50 border-green-200';
const getRiskLabel = (level: RiskLevel) => level === 'high' ? '높음' : level === 'medium' ? '보통' : '양호';

/* ═══════════════════════════════════════════
   Notification Component (inline toast)
   ═══════════════════════════════════════════ */
type NotificationType = 'success' | 'info' | 'warning' | 'error';
interface Notification { type: NotificationType; message: string }

function NotificationBanner({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  const styles: Record<NotificationType, string> = {
    success: 'bg-green-50 border-green-300 text-green-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
    error: 'bg-red-50 border-red-300 text-red-800',
  };
  const icons: Record<NotificationType, React.ReactNode> = {
    success: <CheckCircle className="h-4 w-4 text-green-600" />,
    info: <Clock className="h-4 w-4 text-blue-600" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    error: <AlertTriangle className="h-4 w-4 text-red-600" />,
  };
  return (
    <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 border rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 ${styles[notification.type]}`}>
      {icons[notification.type]}
      <span className="text-sm font-medium">{notification.message}</span>
      <button onClick={onClose} className="ml-3 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */
interface CaseDetailStage3Props {
  caseId: string;
  onBack: () => void;
}

export function CaseDetailStage3({ caseId, onBack }: CaseDetailStage3Props) {
  const allCases = useMemo(() => generateCases(), []);
  const baseCase = useMemo(() => allCases.find(c => c.id === caseId), [allCases, caseId]);
  const idx = useMemo(() => allCases.findIndex(c => c.id === caseId), [allCases, caseId]);
  const sc = useMemo(() => baseCase ? buildStage3(baseCase, idx >= 0 ? idx : 0) : null, [baseCase, idx]);
  const piiData = useMemo(() => baseCase ? buildPiiData(baseCase, idx >= 0 ? idx : 0) : null, [baseCase, idx]);

  /* ── state ── */
  const [contactResult, setContactResult] = useState('');
  const [nextActionSelect, setNextActionSelect] = useState('');
  const [memoText, setMemoText] = useState('');
  const [memoLines, setMemoLines] = useState<string[]>(baseCase?.autoMemo.lines ?? []);
  const [piiVisible, setPiiVisible] = useState(false);
  const [actionLog, setActionLog] = useState<{ action: string; ts: string }[]>([]);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [commTab, setCommTab] = useState<'call' | 'sms'>('call');
  const [smsTemplate, setSmsTemplate] = useState('');
  const [callNote, setCallNote] = useState('');

  // ── Enhanced UX state ──
  const [notification, setNotification] = useState<Notification | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [piiDialogOpen, setPiiDialogOpen] = useState(false);
  const [accessReason, setAccessReason] = useState('');
  const [piiAccessed, setPiiAccessed] = useState(false);
  const [smsConfirmOpen, setSmsConfirmOpen] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [guideChecked, setGuideChecked] = useState<boolean[]>([]);
  const [callActive, setCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callResult, setCallResult] = useState('');
  const [memoSaving, setMemoSaving] = useState(false);
  const [smsHistory, setSmsHistory] = useState<{ date: string; template: string; status: string }[]>(
    baseCase?.smsHistory?.map(s => ({ date: s.sentAt.slice(0, 16), template: s.template, status: 'sent' })) ?? []
  );

  // ── guide checklist init ──
  const guideItemsDef = useMemo(() => sc ? getGuideItems(sc) : [], [sc]);
  useEffect(() => {
    setGuideChecked(guideItemsDef.map(g => g.defaultDone));
  }, [guideItemsDef]);

  // ── notification auto-dismiss ──
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(timer);
  }, [notification]);

  // ── call timer ──
  useEffect(() => {
    if (!callActive) return;
    const iv = setInterval(() => setCallSeconds(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [callActive]);

  const showNotify = useCallback((type: NotificationType, message: string) => {
    setNotification({ type, message });
  }, []);

  /* ── handlers ── */
  const handleAction = useCallback(async (actionType: string) => {
    setActionLoading(actionType);
    await new Promise(r => setTimeout(r, 600));
    const ts = new Date().toISOString();
    setActionLog(prev => [{ action: actionType, ts }, ...prev.slice(0, 29)]);
    const now = ts.slice(0, 16).replace('T', ' ');
    setMemoLines(prev => [`[${now}] ${actionType} 완료`, ...prev]);
    console.log('[AUDIT] Stage3 Action:', { caseId, actionType, ts, mode: 'DEMO' });
    setActionLoading(null);
    showNotify('success', `${actionType} — 처리 완료`);
  }, [caseId, showNotify]);

  const handleRequestPiiAccess = () => {
    if (!accessReason) {
      showNotify('warning', '열람 사유를 선택해 주세요.');
      return;
    }
    console.log('[AUDIT] PII Access:', {
      action: 'PII_ACCESS', caseId, userId: 'USER-001',
      reason: accessReason, timestamp: new Date().toISOString(),
    });
    setPiiAccessed(true);
    setPiiVisible(true);
    showNotify('info', '개인정보 열람이 승인되었습니다. 접근 기록이 저장됩니다.');
  };

  const handleClosePii = () => {
    setPiiAccessed(false);
    setPiiVisible(false);
    setPiiDialogOpen(false);
    setAccessReason('');
    console.log('[AUDIT] PII Close:', { caseId, timestamp: new Date().toISOString() });
  };

  const handleSmsConfirm = async () => {
    if (!smsTemplate || !sc) return;
    setSmsSending(true);
    try {
      const tpl = SMS_TEMPLATES.find(t => t.id === smsTemplate);
      const resp = await fetch('http://localhost:4120/api/outreach/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId, center_id: 'center-gangnam-001',
          template_id: smsTemplate, citizen_phone: sc.phone,
          variables: {
            recipient_name: sc.patientName, center_name: '강남구 치매안심센터',
            center_phone: '02-1234-5678',
          },
          dedupe_key: `${caseId}-${smsTemplate}-${Date.now()}`,
        }),
      });
      if (!resp.ok) throw new Error('API 응답 오류');
      const result = await resp.json();
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setSmsHistory(prev => [{ date: now, template: tpl?.label ?? smsTemplate, status: 'sent' }, ...prev]);
      setMemoLines(prev => [`[${now}] SMS 발송: ${tpl?.label} (${result.status ?? 'sent'})`, ...prev]);
      showNotify('success', `SMS 발송 완료 — ${tpl?.label}`);
    } catch {
      const tpl = SMS_TEMPLATES.find(t => t.id === smsTemplate);
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setSmsHistory(prev => [{ date: now, template: tpl?.label ?? smsTemplate, status: 'demo' }, ...prev]);
      setMemoLines(prev => [`[${now}] SMS 발송(DEMO): ${tpl?.label}`, ...prev]);
      showNotify('info', `SMS 발송 완료 (DEMO 모드) — ${tpl?.label}`);
    } finally {
      setSmsSending(false);
      setSmsConfirmOpen(false);
      setSmsTemplate('');
    }
  };

  const handleCallStart = () => {
    setCallActive(true);
    setCallSeconds(0);
    setCallResult('');
    showNotify('info', '전화 연결 중...');
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    setMemoLines(prev => [`[${now}] 전화 연결 시작`, ...prev]);
  };

  const handleCallEnd = () => {
    setCallActive(false);
    const duration = `${Math.floor(callSeconds / 60)}:${String(callSeconds % 60).padStart(2, '0')}`;
    showNotify('info', `통화 종료 — ${duration}`);
  };

  const handleCallLog = () => {
    if (!callNote.trim() && !callResult) {
      showNotify('warning', '통화 결과 또는 메모를 입력해 주세요.');
      return;
    }
    const duration = callActive ? `${Math.floor(callSeconds / 60)}:${String(callSeconds % 60).padStart(2, '0')}` : '';
    const ts = new Date().toISOString();
    const now = ts.slice(0, 16).replace('T', ' ');
    const resultText = callResult ? `[${callResult}]` : '';
    const durationText = duration ? ` (${duration})` : '';
    const logText = `전화 접촉${durationText}: ${resultText} ${callNote.trim()}`.trim();
    setActionLog(prev => [{ action: logText, ts }, ...prev.slice(0, 29)]);
    setMemoLines(prev => [`[${now}] ${logText}`, ...prev]);
    console.log('[AUDIT] Stage3 Call:', { caseId, callResult, callNote, duration, ts });
    setCallNote('');
    setCallResult('');
    if (callActive) { setCallActive(false); setCallSeconds(0); }
    showNotify('success', '통화 기록이 저장되었습니다.');
  };

  const handleAddMemo = async () => {
    if (!memoText.trim()) return;
    setMemoSaving(true);
    await new Promise(r => setTimeout(r, 400));
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const prefix = contactResult ? `[${contactResult}]` : '';
    const suffix = nextActionSelect ? ` → 다음: ${nextActionSelect}` : '';
    setMemoLines(prev => [`[${now}] ${prefix} ${memoText.trim()}${suffix}`, ...prev]);
    setMemoText('');
    setContactResult('');
    setNextActionSelect('');
    setMemoSaving(false);
    showNotify('success', '운영 기록이 저장되었습니다.');
  };

  const toggleGuide = (i: number) => {
    setGuideChecked(prev => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
    const item = guideItemsDef[i];
    if (item && !guideChecked[i]) {
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setMemoLines(prev => [`[${now}] 체크: ${item.text}`, ...prev]);
    }
  };

  /* ── null guard ── */
  if (!sc) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto" />
          <p className="text-lg text-gray-700">케이스를 찾을 수 없습니다: {caseId}</p>
          <Button onClick={onBack}>← 목록으로</Button>
        </div>
      </div>
    );
  }

  const ddayColor = sc.daysTilReview < 0 ? 'text-red-600' : sc.daysTilReview <= 7 ? 'text-orange-600' : 'text-blue-600';
  const ddayText = sc.daysTilReview >= 0 ? `D-${sc.daysTilReview}` : `D+${Math.abs(sc.daysTilReview)}`;

  const na = getNextAction(sc);
  const VISIBLE_GUIDE = 3;
  const visibleGuide = guideExpanded ? guideItemsDef : guideItemsDef.slice(0, VISIBLE_GUIDE);
  const completedGuide = guideChecked.filter(Boolean).length;
  const totalGuide = guideItemsDef.length;

  const VISIBLE_TIMELINE = 3;
  const reviewLines: string[] = [];
  if (sc.reviewsCompleted > 0) {
    for (let i = 0; i < Math.min(sc.reviewsCompleted, 3); i++) {
      const rd = new Date();
      rd.setMonth(rd.getMonth() - (i + 1) * (sc.trackingCadence === 'monthly' ? 1 : sc.trackingCadence === 'bimonthly' ? 2 : 3));
      reviewLines.push(`[${rd.toISOString().slice(0, 10)}] 재평가 #${sc.reviewsCompleted - i} ${i === 0 ? '(최근 완료)' : '(완료)'}`);
    }
  }
  const allTimeline = [...memoLines, ...reviewLines];
  const visibleTimeline = timelineExpanded ? allTimeline : allTimeline.slice(0, VISIBLE_TIMELINE);

  const actionBarBorder =
    na.urgency === 'overdue' ? 'border-red-300 bg-gradient-to-r from-red-50 to-white' :
    na.urgency === 'attrition' ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-white' :
    na.urgency === 'upcoming' ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-white' :
    'border-emerald-300 bg-gradient-to-r from-emerald-50 to-white';

  const primaryBtnColor =
    na.urgency === 'overdue' ? 'bg-red-600 hover:bg-red-700' :
    na.urgency === 'attrition' ? 'bg-orange-600 hover:bg-orange-700' :
    na.urgency === 'upcoming' ? 'bg-amber-600 hover:bg-amber-700' :
    'bg-emerald-600 hover:bg-emerald-700';

  const formatCallTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Notification Toast ── */}
      {notification && (
        <NotificationBanner notification={notification} onClose={() => setNotification(null)} />
      )}

      {/* ════════ [0] Header Strip (sticky) ════════ */}
      <div className="sticky top-0 z-20 bg-white border-b-2 border-gray-300 shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" onClick={onBack} className="text-gray-600 h-9 px-3 text-sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> 목록
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-amber-300 text-amber-700 bg-amber-50">DEMO</Badge>
              <Badge variant="outline" className="text-sm px-3.5 py-1.5 border-emerald-300 text-emerald-700 bg-emerald-50 font-bold">3차 대상자 (추적관리)</Badge>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm overflow-x-auto">
            <span className="text-lg font-bold text-gray-900">{sc.patientName}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">{sc.age}세 · {sc.gender}</span>
            <span className="text-gray-300">|</span>
            <span className={`text-2xl font-bold ${ddayColor}`}>{ddayText}</span>
            <span className="text-xs text-gray-400">{sc.nextReviewDate}</span>
            <span className="text-gray-300">|</span>
            <span className={`px-2.5 py-1 rounded text-sm font-bold border ${getRiskColor(sc.riskLevel)}`}>
              {getRiskLabel(sc.riskLevel)} {sc.riskScore}점
            </span>
            <span className="text-gray-300">|</span>
            <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
              sc.riskBucket === 'high_risk' ? 'bg-red-50 text-red-700' :
              sc.riskBucket === 'moderate_risk' ? 'bg-orange-50 text-orange-700' :
              'bg-green-50 text-green-700'
            }`}>
              {BUCKET_LABELS[sc.riskBucket]}
            </span>
            {sc.attritionRisk && (
              <>
                <span className="text-gray-300">|</span>
                <span className="px-2.5 py-1 rounded text-xs font-bold bg-red-100 text-red-700 animate-pulse">⚠ 이탈 확인 필요</span>
              </>
            )}
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">담당: {sc.counselor}</span>
            <span className="text-gray-300">|</span>
            <Button
              variant="ghost" size="sm" className="h-8 px-2 text-xs"
              onClick={() => {
                if (piiAccessed) { setPiiVisible(!piiVisible); }
                else { setPiiDialogOpen(true); }
              }}
            >
              {piiVisible ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
              {piiVisible ? sc.phone : maskPhone(sc.phone)}
            </Button>
          </div>
        </div>
      </div>

      {/* ════════ Main Content ════════ */}
      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">

        {/* ════════ [1] NEXT ACTION Bar ════════ */}
        <Card className={`border-2 ${actionBarBorder}`}>
          <CardContent className="px-5 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${
                  na.urgency === 'overdue' ? 'text-red-500' :
                  na.urgency === 'attrition' ? 'text-orange-500' :
                  na.urgency === 'upcoming' ? 'text-amber-600' :
                  'text-emerald-500'
                }`}>NEXT ACTION</p>
                <p className="text-sm font-bold text-gray-900">{na.sentence}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  사후관리 주기: {CADENCE_LABELS[sc.trackingCadence]} · 다음 예정: {sc.nextReviewDate}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  className={`h-10 px-5 text-sm font-bold text-white shadow ${primaryBtnColor}`}
                  onClick={() => handleAction(na.primary.label)}
                  disabled={actionLoading === na.primary.label}
                >
                  {actionLoading === na.primary.label
                    ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    : <na.primary.icon className="h-4 w-4 mr-1.5" />
                  }
                  {na.primary.label}
                </Button>
                {na.secondary.map((s, i) => (
                  <Button
                    key={i} variant="outline" className="h-9 text-xs border-gray-300"
                    onClick={() => {
                      if (s.label === '전화 연결') { setCommTab('call'); handleCallStart(); }
                      else if (s.label === '문자 발송') { setCommTab('sms'); }
                      else if (s.label === '메모 기록') {
                        document.getElementById('memo-section-s3')?.scrollIntoView({ behavior: 'smooth' });
                      } else { handleAction(s.label); }
                    }}
                    disabled={actionLoading === s.label}
                  >
                    {actionLoading === s.label
                      ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      : <s.icon className="h-3.5 w-3.5 mr-1" />
                    }
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ════════ [2] 상태 요약 카드 4장 ════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border border-gray-200">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-gray-500 mb-1">재평가 D-day</p>
              <p className={`text-2xl font-bold ${ddayColor}`}>{ddayText}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{sc.nextReviewDate}</p>
            </CardContent>
          </Card>
          <Card className="border border-gray-200">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-gray-500 mb-1">추적 주기</p>
              <p className="text-lg font-bold text-gray-800">{CADENCE_LABELS[sc.trackingCadence]}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{BUCKET_LABELS[sc.riskBucket]}</p>
            </CardContent>
          </Card>
          <Card className="border border-gray-200">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-gray-500 mb-1">완료된 재평가</p>
              <p className="text-2xl font-bold text-blue-600">{sc.reviewsCompleted}회</p>
              <p className="text-[10px] text-gray-400 mt-0.5">접촉: {CONTACT_STATUS_LABELS[sc.contactStatus]}</p>
            </CardContent>
          </Card>
          <Card className="border border-gray-200">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-gray-500 mb-1">최근 변화</p>
              <p className="text-sm font-bold text-gray-800 truncate">{sc.recentChange}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">상담: {CONSULT_STATUS_LABELS[sc.consultStatus]}</p>
            </CardContent>
          </Card>
        </div>

        {/* ════════ [3] 작업 가이드 (인터랙티브) ════════ */}
        <Card className="border-emerald-200">
          <CardHeader className="py-2.5 px-5 border-b border-emerald-200 bg-emerald-50/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-emerald-800 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" />
                작업 가이드 — 추적관리
              </CardTitle>
              <span className="text-[10px] font-semibold text-emerald-600">
                {completedGuide}/{totalGuide} 완료
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${totalGuide > 0 ? (completedGuide / totalGuide) * 100 : 0}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {visibleGuide.map((item, i) => {
                const checked = guideChecked[i] ?? item.defaultDone;
                return (
                  <button
                    key={i}
                    className="w-full flex items-center gap-2 text-xs text-left py-1 hover:bg-emerald-50/50 rounded px-1 transition"
                    onClick={() => toggleGuide(i)}
                  >
                    {checked
                      ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      : <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0 hover:border-emerald-400 transition" />
                    }
                    <span className={checked ? 'text-gray-400 line-through' : 'text-gray-800'}>{item.text}</span>
                  </button>
                );
              })}
            </div>
            {guideItemsDef.length > VISIBLE_GUIDE && (
              <Button
                variant="ghost" size="sm"
                className="mt-2 h-6 text-[10px] text-emerald-700 px-2"
                onClick={() => setGuideExpanded(!guideExpanded)}
              >
                {guideExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {guideExpanded ? '접기' : `전체 보기 (${guideItemsDef.length})`}
              </Button>
            )}
            <div className="mt-3 pt-3 border-t border-emerald-100">
              <p className="text-[10px] text-gray-500">
                ⚠ "치매 확정/악화" 표현 금지 · "정기 건강 확인을 위해 연락드립니다" 톤 유지 · 이탈 시 강압적 표현 대신 지원 의지 전달
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ════════ [4] 커뮤니케이션 패널 ════════ */}
        <Card>
          <CardHeader className="py-2.5 px-5 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xs font-bold text-gray-700">커뮤니케이션</CardTitle>
              <div className="flex bg-gray-100 rounded p-0.5">
                <button
                  className={`px-3 py-1 rounded text-[10px] font-semibold transition ${commTab === 'call' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                  onClick={() => setCommTab('call')}
                >
                  <PhoneCall className="h-3 w-3 inline mr-1" />전화
                  {callActive && <span className="ml-1 inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                </button>
                <button
                  className={`px-3 py-1 rounded text-[10px] font-semibold transition ${commTab === 'sms' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                  onClick={() => setCommTab('sms')}
                >
                  <MessageSquare className="h-3 w-3 inline mr-1" />문자
                  {smsHistory.length > 0 && <span className="ml-1 text-[9px] text-gray-400">({smsHistory.length})</span>}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {commTab === 'call' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {!callActive ? (
                    <Button
                      className="h-9 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleCallStart}
                    >
                      <Phone className="h-3.5 w-3.5 mr-1.5" /> 전화 걸기
                    </Button>
                  ) : (
                    <Button
                      className="h-9 px-4 text-xs bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleCallEnd}
                    >
                      <PhoneOff className="h-3.5 w-3.5 mr-1.5" /> 통화 종료
                    </Button>
                  )}
                  <span className="text-xs text-gray-500">
                    수신: {piiVisible ? sc.phone : maskPhone(sc.phone)}
                  </span>
                  {callActive && (
                    <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      {formatCallTime(callSeconds)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium">통화 결과</label>
                    <Select value={callResult} onValueChange={setCallResult}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="선택" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="접촉 성공">접촉 성공</SelectItem>
                        <SelectItem value="부재중">부재중</SelectItem>
                        <SelectItem value="번호 오류">번호 오류</SelectItem>
                        <SelectItem value="통화 거부">통화 거부</SelectItem>
                        <SelectItem value="보호자 통화">보호자 통화</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium">통화 메모</label>
                    <Textarea
                      value={callNote}
                      onChange={e => setCallNote(e.target.value)}
                      placeholder="통화 결과를 간략히 기록하세요..."
                      className="mt-1 text-xs min-h-[36px] h-8"
                    />
                  </div>
                </div>
                <Button size="sm" className="h-7 text-[10px]" onClick={handleCallLog} disabled={!callNote.trim() && !callResult}>
                  <Plus className="h-3 w-3 mr-1" /> 통화 기록 저장
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">DEMO</Badge>
                  <span className="text-[10px] text-gray-400">수신: {piiVisible ? sc.phone : maskPhone(sc.phone)}</span>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium">템플릿 선택</label>
                  <Select value={smsTemplate} onValueChange={setSmsTemplate}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="선택하세요" /></SelectTrigger>
                    <SelectContent>
                      {SMS_TEMPLATES.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {smsTemplate && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <p className="text-[10px] text-gray-400 mb-1">미리보기</p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {SMS_TEMPLATES.find(t => t.id === smsTemplate)?.preview(sc.patientName, sc)}
                    </p>
                  </div>
                )}
                <Button
                  size="sm" className="h-8 text-xs"
                  onClick={() => setSmsConfirmOpen(true)}
                  disabled={!smsTemplate}
                >
                  <Send className="h-3.5 w-3.5 mr-1" /> 발송 확인
                </Button>

                {smsHistory.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-500 mb-2">발송 이력</p>
                    <div className="space-y-1">
                      {smsHistory.slice(0, 5).map((h, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-600">{h.date} · {h.template}</span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                            h.status === 'sent' ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'
                          }`}>
                            {h.status === 'sent' ? '발송완료' : 'DEMO'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ════════ [5] 타임라인 ════════ */}
        <Card>
          <CardHeader className="py-2.5 px-5 border-b border-gray-200">
            <CardTitle className="text-xs font-bold text-gray-700 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              타임라인
              {allTimeline.length > 0 && <span className="text-[10px] font-normal text-gray-400">({allTimeline.length}건)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {allTimeline.length === 0 ? (
              <p className="text-xs text-gray-400 py-3">아직 추적 기록이 없습니다.</p>
            ) : (
              <>
                <div className="relative pl-5 space-y-3">
                  <div className="absolute left-1.5 top-1.5 bottom-1.5 w-0.5 bg-gray-200" />
                  {visibleTimeline.map((line, i) => {
                    const isReview = line.includes('재평가');
                    const isSms = line.includes('SMS');
                    const isCall = line.includes('전화');
                    const isWarning = line.includes('⚠');
                    return (
                      <div key={i} className="relative">
                        <div className={`absolute -left-3.5 top-1 w-2 h-2 rounded-full border-2 ${
                          isWarning ? 'bg-red-400 border-red-400' :
                          isSms ? 'bg-orange-400 border-orange-400' :
                          isCall ? 'bg-emerald-400 border-emerald-400' :
                          isReview ? 'bg-blue-400 border-blue-400' :
                          i === 0 ? 'bg-emerald-500 border-emerald-500' :
                          'bg-white border-gray-300'
                        }`} />
                        <p className={`text-xs ${
                          isWarning ? 'text-red-700 font-medium' :
                          i === 0 ? 'text-gray-900 font-medium' :
                          'text-gray-600'
                        }`}>{line}</p>
                      </div>
                    );
                  })}
                </div>
                {allTimeline.length > VISIBLE_TIMELINE && (
                  <Button
                    variant="ghost" size="sm"
                    className="mt-2 h-6 text-[10px] text-emerald-600 px-2"
                    onClick={() => setTimelineExpanded(!timelineExpanded)}
                  >
                    {timelineExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    {timelineExpanded ? '접기' : `전체 보기 (${allTimeline.length}건)`}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ════════ [6] 구조화 메모 ════════ */}
        <Card id="memo-section-s3">
          <CardHeader className="py-2.5 px-5 border-b border-gray-200">
            <CardTitle className="text-xs font-bold text-gray-700 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              운영 기록
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 font-medium">접촉 결과</label>
                <Select value={contactResult} onValueChange={setContactResult}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="접촉 성공">접촉 성공</SelectItem>
                    <SelectItem value="부재">부재</SelectItem>
                    <SelectItem value="번호 오류">번호 오류</SelectItem>
                    <SelectItem value="거부">거부</SelectItem>
                    <SelectItem value="보호자 접촉">보호자 접촉</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium">다음 행동</label>
                <Select value={nextActionSelect} onValueChange={setNextActionSelect}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="재평가 일정 생성">재평가 일정 생성</SelectItem>
                    <SelectItem value="재시도 (전화)">재시도 (전화)</SelectItem>
                    <SelectItem value="문자 발송">문자 발송</SelectItem>
                    <SelectItem value="추적 주기 조정">추적 주기 조정</SelectItem>
                    <SelectItem value="보호자 연락">보호자 연락</SelectItem>
                    <SelectItem value="종료 검토">종료 검토</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium">근거 · 특이사항</label>
              <Textarea
                value={memoText}
                onChange={e => setMemoText(e.target.value)}
                placeholder="추적 접촉 결과, 변화 관찰, 보호자 의견, 다음 조치 근거 등을 기록하세요..."
                className="mt-1 text-xs min-h-[72px]"
              />
            </div>
            <Button size="sm" className="h-8 text-xs" onClick={handleAddMemo} disabled={!memoText.trim() || memoSaving}>
              {memoSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              {memoSaving ? '저장 중...' : '기록 저장'}
            </Button>
          </CardContent>
        </Card>

        {/* ════════ [7] 책임·출처·감사 ════════ */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50 hover:bg-gray-100 transition"
            onClick={() => setAuditOpen(!auditOpen)}
          >
            <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-1.5">
              <Shield className="h-3 w-3" /> 책임 · 출처 · 감사
            </span>
            {auditOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
          </button>
          {auditOpen && (
            <div className="px-5 py-3 bg-white space-y-2 text-xs text-gray-600">
              <InfoRow label="데이터 출처" value="건강보험공단 검진데이터, 지역센터 상담이력" />
              <InfoRow label="수집 시각" value={sc.autoMemo.lastUpdatedAt} />
              <InfoRow label="참고 모델" value="치매특화판정모듈 v3.2 (참고용)" />
              <InfoRow label="최종 책임" value="사례관리자 / 의료진" />
              {actionLog.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 mb-1">최근 수행 이력</p>
                  {actionLog.slice(0, 8).map((log, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-gray-400 py-0.5">
                      <span className="w-1 h-1 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                      <span>{log.ts.slice(11, 19)} · {log.action}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-gray-400 text-center leading-relaxed pb-4">
          ※ 본 정보는 참고용이며 최종 조치는 사례관리자/의료진이 확인합니다. 추적 분류 및 이탈 지표는 참고용이며 확정이 아닙니다.
        </p>
      </div>

      {/* ════════ PII Access Dialog ════════ */}
      <Dialog open={piiDialogOpen} onOpenChange={setPiiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              개인정보 열람 요청
            </DialogTitle>
            <DialogDescription>
              개인정보 열람 시 모든 접근 기록이 감사로그에 저장되며, 상급기관에서 추적됩니다.
            </DialogDescription>
          </DialogHeader>

          {!piiAccessed ? (
            <div className="space-y-4 py-2">
              <div className="border-2 border-red-200 bg-red-50 p-4 rounded">
                <p className="text-sm text-red-900 font-medium">⚠️ 개인정보보호법 준수 안내</p>
                <p className="text-xs text-red-800 mt-2 leading-relaxed">
                  개인정보는 업무상 필요한 경우에만 열람할 수 있습니다.
                  모든 열람 이력은 시스템에 자동 기록되며, 부적절한 접근 시 관련 법규에 따라 처벌받을 수 있습니다.
                </p>
              </div>
              <div>
                <Label>열람 사유 선택 *</Label>
                <Select value={accessReason} onValueChange={setAccessReason}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="사유를 선택하세요" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tracking">추적관리 접촉을 위한 연락처 확인</SelectItem>
                    <SelectItem value="review">재평가 일정 조율</SelectItem>
                    <SelectItem value="emergency">응급 상황 대응</SelectItem>
                    <SelectItem value="family_contact">보호자 연락 필요</SelectItem>
                    <SelectItem value="referral">타기관 연계·의뢰</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-gray-100 p-3 rounded text-xs text-gray-700">
                <p className="font-semibold mb-1">열람 이력 기록:</p>
                <p>• 접근 일시: {new Date().toLocaleString('ko-KR')}</p>
                <p>• 접근자: {sc.counselor} (USER-001)</p>
                <p>• 케이스 ID: {caseId}</p>
                <p>• 접근 사유: {accessReason || '(선택 필요)'}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="border-2 border-green-200 bg-green-50 p-4 rounded">
                <p className="text-sm text-green-900 font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" /> 개인정보 열람 승인됨
                </p>
              </div>
              {piiData && (
                <div className="border-2 border-gray-300 bg-white p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">성명</div>
                      <div className="font-semibold text-gray-900">{piiData.fullName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">주민등록번호</div>
                      <div className="font-semibold text-gray-900">{piiData.residentNumber}</div>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="text-xs text-gray-500 mb-1">주소</div>
                    <div className="font-medium text-gray-900">{piiData.fullAddress}</div>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="text-xs text-gray-500 mb-1">연락처</div>
                    <div className="font-medium text-gray-900">{piiData.detailedPhone}</div>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="text-xs text-gray-500 mb-1">비상연락망</div>
                    <div className="font-medium text-gray-900">{piiData.emergencyContactName}: {piiData.emergencyContact}</div>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="text-xs text-gray-500 mb-1">기존 병력</div>
                    <div className="font-medium text-gray-900">{piiData.medicalHistory.join(', ')}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!piiAccessed ? (
              <>
                <Button variant="outline" onClick={() => setPiiDialogOpen(false)}>취소</Button>
                <Button onClick={handleRequestPiiAccess} disabled={!accessReason}>확인 및 열람</Button>
              </>
            ) : (
              <Button onClick={handleClosePii} className="w-full">
                <EyeOff className="h-4 w-4 mr-2" /> 닫기 (비식별 상태로 복귀)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ SMS Confirm Dialog ════════ */}
      <Dialog open={smsConfirmOpen} onOpenChange={setSmsConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-600" />
              SMS 발송 확인
            </DialogTitle>
            <DialogDescription>아래 내용으로 문자를 발송합니다. 발송 기록은 자동 저장됩니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>수신번호</Label>
              <Input value={maskPhone(sc.phone)} disabled className="mt-1 bg-gray-50" />
            </div>
            <div>
              <Label>템플릿</Label>
              <Input value={SMS_TEMPLATES.find(t => t.id === smsTemplate)?.label ?? ''} disabled className="mt-1 bg-gray-50" />
            </div>
            {smsTemplate && (
              <div className="border border-gray-200 bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500 mb-1">발송 내용</p>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {SMS_TEMPLATES.find(t => t.id === smsTemplate)?.preview(sc.patientName, sc)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsConfirmOpen(false)} disabled={smsSending}>취소</Button>
            <Button onClick={handleSmsConfirm} disabled={smsSending} className="bg-emerald-600 hover:bg-emerald-700">
              {smsSending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />발송 중...</> : 'SMS 발송'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Helper ─── */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-xs">
      <span className="text-gray-500 flex-shrink-0 w-24">{label}</span>
      <span className="text-gray-800 text-right">{value}</span>
    </div>
  );
}
