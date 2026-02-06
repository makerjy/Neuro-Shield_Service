import React, { useState, useMemo } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Brain,
  Clock,
  Shield,
  FileText,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  MessageSquare,
  FlaskConical,
  Sparkles,
  Send,
  ClipboardList,
  Plus,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import {
  generateCases, 
  SECOND_EXAM_LABELS, SECOND_EXAM_COLORS, EXAM_TYPE_LABELS,
  CONTACT_STATUS_LABELS, CONSULT_STATUS_LABELS, RESERVATION_TYPE_LABELS,
  maskPhone,
  type Case, type RiskLevel, type SecondExamStatus, type SmsHistoryEntry,
} from './caseData';

// ── AI 분석 + PII 보강 데이터 (케이스별로 고정 mock) ──
interface AiAnalysisData {
  riskPercentile: number;
  riskRanking: string;
  lastUpdated: string;
  recentChange: string;
  urgency: 'immediate' | 'within_3_days' | 'routine';
  keyFactors: { name: string; impact: number; description: string }[];
  operationalGuidelines: string[];
  analysisInfo: {
    aiModel: string; responsible: string; dataSource: string;
    updateDate: string; deidentified: boolean;
  };
}
interface PiiData {
  fullName: string; fullAddress: string; detailedPhone: string;
  emergencyContact: string; emergencyContactName: string;
  residentNumber: string; medicalHistory: string[];
}

function buildAiAnalysis(c: Case): AiAnalysisData {
  const urgency: AiAnalysisData['urgency'] =
    c.riskLevel === 'high' ? 'immediate' : c.riskLevel === 'medium' ? 'within_3_days' : 'routine';
  return {
    riskPercentile: c.riskScore >= 70 ? 92 : c.riskScore >= 50 ? 65 : 30,
    riskRanking: `전체 케이스 중 상위 ${c.riskScore >= 70 ? 8 : c.riskScore >= 50 ? 35 : 70}%`,
    lastUpdated: c.lastContact || '2026-01-20',
    recentChange: c.riskLevel === 'high' ? '2주 전 대비 +5점 상승' : c.riskLevel === 'medium' ? '변동 없음' : '1주 전 대비 -3점 하락',
    urgency,
    keyFactors: [
      { name: '최근 기억력 검사 점수', impact: 85, description: '18/30 (2개월 전 대비 -4점 하락)' },
      { name: '고위험 연령대', impact: 72, description: `${c.age}세, 치매 ${c.riskLevel === 'high' ? '고' : '중'}위험군` },
      { name: '사회적 고립도', impact: 68, description: '단독 생활, 최근 3개월 사회활동 없음' },
      { name: '건강검진 미실시', impact: 55, description: '최근 12개월 건강검진 기록 없음' },
      { name: '생활습관 리스크', impact: 48, description: '운동부족, 식사 불규칙' },
    ],
    operationalGuidelines: [
      '최근 2회 전화 미응답 지속. 우선 SMS로 예약 권고 발송 후, 3일 내 재연락 시도 필요.',
      '단독 생활이며 인지기능 저하 징후 확인됨. 즉시 초기 선별검사 예약 진행 권장.',
      '이상 징후 재발생 시 관할 보건소 및 응급연락망 가동 고려 필요.',
    ],
    analysisInfo: {
      aiModel: '치매특화판정모듈 v3.2', responsible: '김행정 (중앙관리자)',
      dataSource: '건강보험공단 검진데이터, 지역센터 상담이력',
      updateDate: c.lastContact ? `${c.lastContact} 14:30` : '2026-01-20 14:30',
      deidentified: true,
    },
  };
}

function buildPii(c: Case): PiiData {
  const names = ['김민수','박영희','이철수','정은지','최동현','한지영','송재호','윤미선','강태우','오수빈'];
  const name = names[parseInt(c.id.replace(/\D/g, ''), 10) % names.length] || '김민수';
  return {
    fullName: name, fullAddress: '서울시 강남구 테헤란로 123, 아파트 101동 1001호',
    detailedPhone: c.phone, emergencyContact: '010-9876-5432',
    emergencyContactName: '보호자 (배우자)', residentNumber: `${String(2026 - c.age).slice(2)}0215-${c.gender === '남' ? '1' : '2'}******`,
    medicalHistory: c.riskLevel === 'high' ? ['고혈압','당뇨병','고지혈증'] : c.riskLevel === 'medium' ? ['고혈압'] : [],
  };
}

// Consultation Step Types
type ConsultationStep = 'greeting' | 'purpose' | 'assessment' | 'scheduling';

interface ConsultationScript {
  step: ConsultationStep;
  title: string;
  aiSuggestion: string;
  tips: string[];
}

export function CaseDetail({ caseId, onBack, onStartConsultation }: { 
  caseId: string; 
  onBack: () => void;
  onStartConsultation?: (caseId: string) => void;
}) {
  const [piiDialogOpen, setPiiDialogOpen] = useState(false);
  const [accessReason, setAccessReason] = useState('');
  const [piiData, setPiiData] = useState<any>(null);
  
  // Consultation Dialog States
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<ConsultationStep>('greeting');
  const [consultationNotes, setConsultationNotes] = useState<Record<ConsultationStep, string>>({
    greeting: '',
    purpose: '',
    assessment: '',
    scheduling: '',
  });
  
  // Consultation Completion States
  const [consultationResult, setConsultationResult] = useState<'completed' | 'postponed' | 'refused' | ''>('');
  const [resultReason, setResultReason] = useState('');
  const [consultationMemo, setConsultationMemo] = useState('');
  
  // Referral & Appointment States
  const [referralType, setReferralType] = useState<'screening' | 'health_center' | 'medical' | ''>('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [preVisitNotes, setPreVisitNotes] = useState('');
  
  // Dropout States
  const [dropoutReason, setDropoutReason] = useState('');
  const [dropoutDetails, setDropoutDetails] = useState('');
  const [recontactPlan, setRecontactPlan] = useState('');

  // ═══ 신규 state: SMS, 운영메모, RAG ═══
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsTemplate, setSmsTemplate] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [newMemoText, setNewMemoText] = useState('');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragResult, setRagResult] = useState<{ actions: string[]; cautions: string[]; churnSignals: string[] } | null>(null);

  // ═══ 공유 데이터에서 케이스 조회 ═══
  const allCases = useMemo(() => generateCases(), []);
  const sharedCase = useMemo(() => allCases.find(c => c.id === caseId), [allCases, caseId]);
  const [localMemoLines, setLocalMemoLines] = useState<string[]>(sharedCase?.autoMemo.lines || []);
  const [localSmsHistory, setLocalSmsHistory] = useState<SmsHistoryEntry[]>(sharedCase?.smsHistory || []);

  // ═══ 공유 케이스 기반 파생 데이터 ═══
  const aiAnalysis = useMemo(() => sharedCase ? buildAiAnalysis(sharedCase) : null, [sharedCase]);
  const piiSource = useMemo(() => sharedCase ? buildPii(sharedCase) : null, [sharedCase]);

  // Consultation Scripts (AI Generated)
  const consultationScripts: Record<ConsultationStep, ConsultationScript> = {
    greeting: {
      step: 'greeting',
      title: '1단계: 인사 및 신원 확인',
      aiSuggestion: `안녕하세요, 저는 강남구 치매안심센터의 ${sharedCase?.counselor ?? '상담사'} 상담사입니다. 지금 통화 가능하신가요? 본인 확인을 위해 성함과 생년월일을 여쭤봐도 될까요?`,
      tips: [
        '차분하고 따뜻한 어조로 시작하세요',
        '통화 가능 여부를 먼저 확인하세요',
        '신원 확인은 필수입니다',
      ],
    },
    purpose: {
      step: 'purpose',
      title: '2단계: 연락 목적 설명',
      aiSuggestion: `치매안심센터에서는 지역 주민분들의 건강을 돕기 위해 정기적으로 건강 상태를 확인하고 있습니다. 최근 건강검진 결과와 설문 응답을 바탕으로 인지 건강 관리에 도움이 필요하실 수 있어 연락드렸습니다.`,
      tips: [
        '불안감을 주지 않도록 주의하세요',
        '센터의 지원 목적을 명확히 설명하세요',
        '비밀보장을 강조하세요',
      ],
    },
    assessment: {
      step: 'assessment',
      title: '3단계: 현재 상황 파악',
      aiSuggestion: `요즘 일상생활에서 불편함은 없으신가요? 예를 들어 약속이나 날짜를 잊으신 적이 있거나, 물건을 자주 잃어버리시는 등의 경험이 있으신가요? 가족분들과는 자주 연락하고 계신가요?`,
      tips: [
        '개방형 질문으로 대화를 유도하세요',
        '판단하지 말고 경청하세요',
        '특이사항은 메모하세요',
      ],
    },
    scheduling: {
      step: 'scheduling',
      title: '4단계: 센터 방문 안내 및 예약',
      aiSuggestion: `무료로 인지 건강 선별검사를 받으실 수 있습니다. 약 30분 정도 소요되며, 결과에 따라 필요한 지원을 안내해드립니다. 편하신 날짜에 방문 예약을 도와드리겠습니다. 언제 시간이 되실까요?`,
      tips: [
        '검사의 간편함과 무료임을 강조하세요',
        '센터 위치와 교통편을 안내하세요',
        '특이사항(보청기, 층수 등)을 확인하세요',
      ],
    },
  };

  const getRiskBadge = (level: RiskLevel) => {
    const variants = {
      high: { variant: 'destructive' as const, label: '높음', bgColor: 'bg-red-50', textColor: 'text-red-900', borderColor: 'border-red-200' },
      medium: { variant: 'secondary' as const, label: '보통', bgColor: 'bg-orange-50', textColor: 'text-orange-900', borderColor: 'border-orange-200' },
      low: { variant: 'outline' as const, label: '양호', bgColor: 'bg-green-50', textColor: 'text-green-900', borderColor: 'border-green-200' },
    };
    return variants[level];
  };

  const getUrgencyText = (urgency: string) => {
    const urgencyMap = {
      immediate: '즉시',
      within_3_days: '3일 내',
      routine: '정기',
    };
    return urgencyMap[urgency as keyof typeof urgencyMap] || '정기';
  };

  const handleRequestPiiAccess = () => {
    if (!accessReason) {
      alert('열람 사유를 선택해주세요.');
      return;
    }
    
    // Log audit trail
    console.log('[AUDIT] PII Access Request:', {
      action: 'PII_ACCESS',
      caseId: caseId,
      userId: 'USER-001',
      userName: sharedCase?.counselor ?? '상담사',
      reason: accessReason,
      timestamp: new Date().toISOString(),
    });
    
    setPiiData(piiSource);
    alert('개인정보 열람이 승인되었습니다.\n모든 접근 기록이 감사로그에 저장됩니다.');
  };

  const handleClosePii = () => {
    setPiiData(null);
    setPiiDialogOpen(false);
    setAccessReason('');
  };

  const handleStartConsultation = () => {
    console.log('[AUDIT] Consultation Started:', {
      action: 'CONSULTATION_START',
      caseId: caseId,
      userId: 'USER-001',
      userName: sharedCase?.counselor ?? '상담사',
      timestamp: new Date().toISOString(),
    });
    setConsultationOpen(true);
    setCurrentStep('greeting');
    if (onStartConsultation) {
      onStartConsultation(caseId);
    }
  };

  const handleNextStep = () => {
    const steps: ConsultationStep[] = ['greeting', 'purpose', 'assessment', 'scheduling'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handlePreviousStep = () => {
    const steps: ConsultationStep[] = ['greeting', 'purpose', 'assessment', 'scheduling'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleCompleteConsultation = () => {
    if (!consultationResult) {
      alert('상담 결과를 선택해주세요.');
      return;
    }

    if ((consultationResult === 'postponed' || consultationResult === 'refused') && !resultReason.trim()) {
      alert('사유를 입력해주세요.');
      return;
    }

    console.log('[AUDIT] Consultation Completed:', {
      action: 'CONSULTATION_COMPLETE',
      caseId: caseId,
      userId: 'USER-001',
      userName: sharedCase?.counselor ?? '상담사',
      result: consultationResult,
      reason: resultReason,
      memo: consultationMemo,
      notes: consultationNotes,
      timestamp: new Date().toISOString(),
    });

    alert('상담이 완료되었습니다. 케이스 상태가 업데이트되었습니다.');
    setConsultationOpen(false);
    
    // Reset states
    setConsultationResult('');
    setResultReason('');
    setConsultationMemo('');
    setConsultationNotes({
      greeting: '',
      purpose: '',
      assessment: '',
      scheduling: '',
    });
  };

  const handleConfirmAppointment = () => {
    if (!referralType || !appointmentDate || !appointmentTime) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    const smsMessage = `[강남구 치매안심센터] ${appointmentDate} ${appointmentTime}에 센터 방문 예약이 확정되었습니다. 주소: 서울시 강남구 역삼동 123-45 / 문의: 02-1234-5678`;

    console.log('[AUDIT] Appointment Confirmed:', {
      action: 'APPOINTMENT_CREATE',
      caseId: caseId,
      userId: 'USER-001',
      userName: sharedCase?.counselor ?? '상담사',
      referralType,
      appointmentDate,
      appointmentTime,
      preVisitNotes,
      smsMessage,
      timestamp: new Date().toISOString(),
    });

    alert(`예약이 확정되었습니다!\n\n다음 SMS가 발송됩니다:\n${smsMessage}`);
    
    // Reset
    setReferralType('');
    setAppointmentDate('');
    setAppointmentTime('');
    setPreVisitNotes('');
  };

  const handleDropoutConfirm = () => {
    if (!dropoutReason || !dropoutDetails.trim()) {
      alert('이탈 사유와 상세 설명을 입력해주세요.');
      return;
    }

    console.log('[AUDIT] Case Dropout:', {
      action: 'CASE_DROPOUT',
      caseId: caseId,
      userId: 'USER-001',
      userName: sharedCase?.counselor ?? '상담사',
      dropoutReason,
      dropoutDetails,
      recontactPlan,
      timestamp: new Date().toISOString(),
    });

    alert('이탈 처리가 완료되었습니다. 케이스 상태가 업데이트되었습니다.');
    
    // Reset
    setDropoutReason('');
    setDropoutDetails('');
    setRecontactPlan('');
  };

  const riskBadge = getRiskBadge(sharedCase?.riskLevel ?? 'low');
  const currentScriptData = consultationScripts[currentStep];
  const steps: ConsultationStep[] = ['greeting', 'purpose', 'assessment', 'scheduling'];
  const currentStepIndex = steps.indexOf(currentStep);

  // ═══ SMS 전송 핸들러 ═══
  const smsTemplates = [
    { id: 'screening_invite', label: '선별검사 안내', body: '{{name}}님, 치매안심센터에서 무료 인지건강 선별검사를 안내드립니다. 문의: 02-1234-5678' },
    { id: 'visit_remind', label: '방문 예약 리마인드', body: '{{name}}님, 예약된 치매안심센터 방문일이 다가왔습니다. 일정 확인 부탁드립니다.' },
    { id: 'follow_up', label: '사후관리 안부', body: '{{name}}님, 최근 건강상태 확인을 위해 연락드렸습니다. 불편사항이 있으시면 02-1234-5678로 연락주세요.' },
  ];

  const handleSendSms = async () => {
    if (!smsTemplate || !sharedCase) return;
    setSmsSending(true);
    try {
      const tpl = smsTemplates.find(t => t.id === smsTemplate);
      // citizen_sms_service 연동 (포트 4120)
      await fetch('http://localhost:4120/api/outreach/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          template_id: smsTemplate,
          variables: { name: piiSource?.fullName ?? '대상자' },
          to: sharedCase.phone,
          dedupe_key: `${caseId}-${smsTemplate}-${Date.now()}`,
        }),
      });
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const newEntry: SmsHistoryEntry = { date: now, template: tpl?.label ?? smsTemplate, status: 'sent' };
      setLocalSmsHistory(prev => [newEntry, ...prev]);
      setLocalMemoLines(prev => [`[${now}] SMS 발송: ${tpl?.label}`, ...prev]);
      alert('SMS 발송 요청이 완료되었습니다.');
    } catch {
      alert('SMS 발송에 실패했습니다. 네트워크를 확인해주세요.');
    } finally {
      setSmsSending(false);
      setSmsDialogOpen(false);
      setSmsTemplate('');
    }
  };

  // ═══ 수동 메모 추가 ═══
  const handleAddMemo = () => {
    if (!newMemoText.trim()) return;
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    setLocalMemoLines(prev => [`[${now}] ${newMemoText.trim()}`, ...prev]);
    setNewMemoText('');
  };

  // ═══ RAG 가이드 생성 (Mock) ═══
  const handleGenerateRag = () => {
    setRagLoading(true);
    setTimeout(() => {
      const actions: string[] = [];
      const cautions: string[] = [];
      const churnSignals: string[] = [];

      if (sharedCase?.contactStatus === 'UNREACHED') {
        actions.push('SMS 안내 문자 발송 후 3일 내 재연락 시도');
        actions.push('주간보호센터 또는 복지관 경유 접촉 시도');
      }
      if (sharedCase?.secondExamStatus === 'NONE' && sharedCase?.riskLevel === 'high') {
        actions.push('2차 정밀검사 예약 즉시 진행 권장');
      }
      if (sharedCase?.consultStatus === 'NOT_YET') {
        actions.push('초기 상담 일정 수립 필요');
      }

      if (sharedCase?.riskLevel === 'high') {
        cautions.push('고위험군: 인지기능 저하 징후 면밀히 모니터링');
        cautions.push('단독 생활 여부 확인 → 응급연락망 점검');
      }
      if (sharedCase?.age && sharedCase.age >= 80) {
        cautions.push('80세 이상 초고령: 낙상 및 건강 악화 위험 높음');
      }

      if (sharedCase?.contactStatus === 'UNREACHED') {
        churnSignals.push('3회 이상 접촉 실패 시 이탈 위험 급증');
      }
      if (sharedCase?.riskLevel === 'high' && sharedCase?.consultStatus === 'NOT_YET') {
        churnSignals.push('고위험 + 미상담: 조기 이탈 가능성 높음');
      }

      // 최소 보장
      if (actions.length === 0) actions.push('정기 모니터링 유지');
      if (cautions.length === 0) cautions.push('특이사항 없음 — 현 관리 수준 유지');

      setRagResult({ actions: actions.slice(0, 3), cautions: cautions.slice(0, 3), churnSignals });
      setRagLoading(false);
    }, 800);
  };

  if (!sharedCase) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ════════ Sticky Header ════════ */}
      <div className="sticky top-0 z-10 bg-white border-b-2 border-gray-300 shadow-sm">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" onClick={onBack} className="text-gray-600 h-8 px-2">
              ← 뒤로
            </Button>
            <div className="text-xs text-gray-400">
              마지막 업데이트: {aiAnalysis?.lastUpdated ?? '-'}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              {/* 케이스 ID */}
              <div>
                <div className="text-[10px] text-gray-500">케이스 ID</div>
                <div className="text-base font-bold text-gray-900">{caseId}</div>
              </div>
              <div className="h-10 w-px bg-gray-300" />

              {/* 위험도 */}
              <div>
                <div className="text-[10px] text-gray-500">위험도</div>
                <div className="flex items-center gap-1">
                  <span className={`text-base font-bold ${riskBadge.textColor}`}>{riskBadge.label}</span>
                  <span className={`text-xl font-bold ${riskBadge.textColor}`}>{sharedCase.riskScore}</span>
                </div>
              </div>
              <div className="h-10 w-px bg-gray-300" />

              {/* 접촉 상태 */}
              <div>
                <div className="text-[10px] text-gray-500">접촉상태</div>
                <Badge variant="outline" className={`text-xs mt-0.5 ${
                  sharedCase.contactStatus === 'UNREACHED' ? 'border-red-300 text-red-700 bg-red-50' :
                  sharedCase.contactStatus === 'CONTACTED' ? 'border-green-300 text-green-700 bg-green-50' :
                  'border-blue-300 text-blue-700 bg-blue-50'
                }`}>
                  {CONTACT_STATUS_LABELS[sharedCase.contactStatus]}
                </Badge>
              </div>
              <div className="h-10 w-px bg-gray-300" />

              {/* 상담 상태 */}
              <div>
                <div className="text-[10px] text-gray-500">상담</div>
                <span className="text-sm font-medium text-gray-900">
                  {CONSULT_STATUS_LABELS[sharedCase.consultStatus]}
                </span>
              </div>
              <div className="h-10 w-px bg-gray-300" />

              {/* 2차 검사 */}
              <div>
                <div className="text-[10px] text-gray-500">2차 검사</div>
                <Badge variant="outline" className={`text-xs mt-0.5 ${SECOND_EXAM_COLORS[sharedCase.secondExamStatus]}`}>
                  <FlaskConical className="h-3 w-3 mr-1" />
                  {SECOND_EXAM_LABELS[sharedCase.secondExamStatus]}
                  {sharedCase.secondExamType && ` (${EXAM_TYPE_LABELS[sharedCase.secondExamType]})`}
                </Badge>
              </div>
              <div className="h-10 w-px bg-gray-300" />

              {/* 담당자 */}
              <div>
                <div className="text-[10px] text-gray-500">담당자</div>
                <span className="text-sm font-medium text-gray-900">{sharedCase.counselor}</span>
              </div>
            </div>

            {/* 우측 버튼 */}
            <div className="flex gap-2 flex-shrink-0">
              {sharedCase.contactStatus === 'UNREACHED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSmsDialogOpen(true)}
                  className="text-orange-700 border-orange-300 hover:bg-orange-50"
                >
                  <Send className="h-4 w-4 mr-1" /> 문자 보내기
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPiiDialogOpen(true)}
                className="text-gray-700"
              >
                개인정보 보기
              </Button>
              <Button size="sm" onClick={handleStartConsultation} className="bg-blue-600 hover:bg-blue-700">
                상담 시작
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* (1) AI 위험도 요약 */}
        <section>
          <div className={`border-2 ${riskBadge.borderColor} ${riskBadge.bgColor} p-6`}>
            <h2 className="text-sm font-semibold text-gray-600 mb-4">AI 위험도 요약</h2>
            
            <div className="grid grid-cols-4 gap-6">
              <div>
                <div className="text-xs text-gray-600 mb-1">종합 위험 등급</div>
                <div className={`text-3xl font-bold ${riskBadge.textColor}`}>
                  {riskBadge.label}
                </div>
                <div className={`text-lg font-semibold ${riskBadge.textColor} mt-1`}>
                  {sharedCase!.riskScore}점
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-600 mb-1">위험 순위</div>
                <div className="text-xl font-bold text-gray-900">
                  상위 {100 - (aiAnalysis?.riskPercentile ?? 0)}%
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {aiAnalysis!.riskRanking}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-600 mb-1">최근 위험도 변화</div>
                <div className="text-base font-semibold text-gray-900">
                  {aiAnalysis!.recentChange}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  AI 산출일: {aiAnalysis!.lastUpdated}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-600 mb-1">권장 대응 시급도</div>
                <div className={`text-2xl font-bold ${
                  aiAnalysis!.urgency === 'immediate' ? 'text-red-600' :
                  aiAnalysis!.urgency === 'within_3_days' ? 'text-orange-600' :
                  'text-green-600'
                }`}>
                  {getUrgencyText(aiAnalysis!.urgency)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 구분선 */}
        <div className="border-t-2 border-gray-300"></div>

        {/* (2) 주요 위험 요인 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-600 mb-4">주요 위험 요인 (중요도 순)</h2>
          
          <div className="border-2 border-gray-300 bg-white">
            <table className="w-full">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">순위</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">위험 요인명</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">영향도</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">상세 내용</th>
                </tr>
              </thead>
              <tbody>
                {aiAnalysis!.keyFactors.map((factor, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="px-4 py-3 text-gray-900 font-medium">{index + 1}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{factor.name}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${
                        factor.impact >= 70 ? 'text-red-600' :
                        factor.impact >= 50 ? 'text-orange-600' :
                        'text-gray-600'
                      }`}>
                        {factor.impact}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-sm">{factor.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 구분선 */}
        <div className="border-t-2 border-gray-300"></div>

        {/* (3) 운영 판단 가이드 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-600 mb-4">운영 판단 가이드 (AI 분석 + 정책 기준)</h2>
          
          <div className="border-2 border-blue-200 bg-blue-50 p-6 space-y-4">
            {aiAnalysis!.operationalGuidelines.map((guideline, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mt-0.5">
                  {index + 1}
                </div>
                <p className="text-gray-900 leading-relaxed">{guideline}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 구분선 */}
        <div className="border-t-2 border-gray-300"></div>

        {/* (4) 분석 정보 및 책임 표기 */}
        <section>
          <div className="border-2 border-gray-400 bg-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">분석 책임 및 데이터 출처</h2>
            
            <div className="space-y-3 text-sm text-gray-800">
              <p>
                <span className="font-semibold">• AI 분석 모델:</span> {aiAnalysis!.analysisInfo.aiModel}
              </p>
              <p>
                <span className="font-semibold">• 분석 책임자:</span> {aiAnalysis!.analysisInfo.responsible}
              </p>
              <p>
                <span className="font-semibold">• 데이터 출처:</span> {aiAnalysis!.analysisInfo.dataSource}
              </p>
              <p>
                <span className="font-semibold">• 데이터 갱신일:</span> {aiAnalysis!.analysisInfo.updateDate}
              </p>
              <p>
                <span className="font-semibold">• 비식별 처리:</span>{' '}
                {aiAnalysis!.analysisInfo.deidentified ? (
                  <span className="text-green-700 font-semibold">완료 ✓</span>
                ) : (
                  <span className="text-red-700 font-semibold">미완료 ✗</span>
                )}
              </p>
              
              <div className="mt-4 pt-4 border-t border-gray-400">
                <p className="text-xs text-gray-700 leading-relaxed">
                  ※ 이 분석 결과는 공공 AI 기관이 {aiAnalysis!.analysisInfo.dataSource} 기준으로 분석하였으며, 
                  담당자 {aiAnalysis!.analysisInfo.responsible} 책임하에 제공합니다. 
                  모든 데이터는 개인정보보호법에 따라 비식별 처리되었습니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 구분선 */}
        <div className="border-t-2 border-gray-300"></div>

        {/* ═══ (5) 운영 메모 ═══ */}
        <section>
          <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            운영 메모 (자동 + 수동)
          </h2>
          <div className="border-2 border-gray-300 bg-white">
            {/* 메모 입력 */}
            <div className="p-4 border-b border-gray-200 flex gap-2">
              <Input
                value={newMemoText}
                onChange={(e) => setNewMemoText(e.target.value)}
                placeholder="메모를 입력하세요…"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAddMemo()}
              />
              <Button size="sm" onClick={handleAddMemo} disabled={!newMemoText.trim()}>
                <Plus className="h-4 w-4 mr-1" /> 추가
              </Button>
            </div>
            {/* 메모 타임라인 */}
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
              {localMemoLines.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">운영 메모가 없습니다.</div>
              ) : (
                localMemoLines.map((line, i) => (
                  <div key={i} className="px-4 py-2 text-sm text-gray-800 hover:bg-gray-50 flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="leading-relaxed">{line}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 구분선 */}
        <div className="border-t-2 border-gray-300"></div>

        {/* ═══ (6) RAG 가이드 패널 ═══ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              참고 가이드 (AI 기반)
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateRag}
              disabled={ragLoading}
            >
              {ragLoading ? '분석 중…' : '가이드 생성'}
            </Button>
          </div>

          {ragResult ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 권장 액션 */}
              <div className="border-2 border-green-200 bg-green-50 p-4 rounded">
                <h3 className="text-xs font-semibold text-green-800 mb-2">📋 다음 권장 액션</h3>
                <ul className="space-y-1.5">
                  {ragResult.actions.map((a, i) => (
                    <li key={i} className="text-sm text-green-900 flex items-start gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-green-600" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 주의 포인트 */}
              <div className="border-2 border-amber-200 bg-amber-50 p-4 rounded">
                <h3 className="text-xs font-semibold text-amber-800 mb-2">⚠️ 주의 포인트</h3>
                <ul className="space-y-1.5">
                  {ragResult.cautions.map((c, i) => (
                    <li key={i} className="text-sm text-amber-900 flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 이탈 위험 신호 */}
              {ragResult.churnSignals.length > 0 && (
                <div className="border-2 border-red-200 bg-red-50 p-4 rounded">
                  <h3 className="text-xs font-semibold text-red-800 mb-2">🚨 이탈 위험 신호</h3>
                  <ul className="space-y-1.5">
                    {ragResult.churnSignals.map((s, i) => (
                      <li key={i} className="text-sm text-red-900 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-600" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 bg-gray-50 p-8 rounded text-center">
              <Sparkles className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">"가이드 생성" 버튼을 눌러 현재 케이스 상황에 맞는<br />참고 가이드를 확인하세요.</p>
              <p className="text-xs text-gray-400 mt-2">※ AI 가이드는 참고 자료이며, 최종 판단은 담당자가 합니다.</p>
            </div>
          )}
        </section>

        {/* SMS 이력 */}
        {localSmsHistory.length > 0 && (
          <>
            <div className="border-t-2 border-gray-300"></div>
            <section>
              <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                SMS 발송 이력
              </h2>
              <div className="border-2 border-gray-300 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">발송일시</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">템플릿</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localSmsHistory.map((entry, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-4 py-2 text-gray-800">{entry.date}</td>
                        <td className="px-4 py-2 text-gray-800">{entry.template}</td>
                        <td className="px-4 py-2">
                          <Badge variant={entry.status === 'sent' ? 'default' : 'destructive'} className="text-xs">
                            {entry.status === 'sent' ? '발송완료' : '실패'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      {/* ════════ SMS 발송 모달 ════════ */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-orange-600" />
              문자(SMS) 발송
            </DialogTitle>
            <DialogDescription>
              대상자에게 SMS를 발송합니다. 발송 기록은 운영 메모에 자동 기록됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>수신번호</Label>
              <Input value={maskPhone(sharedCase?.phone ?? '')} disabled className="mt-1 bg-gray-50" />
            </div>
            <div>
              <Label>발송 템플릿 선택 *</Label>
              <Select value={smsTemplate} onValueChange={setSmsTemplate}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="템플릿을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {smsTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {smsTemplate && (
              <div className="border border-gray-200 bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500 mb-1">미리보기</p>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {smsTemplates.find(t => t.id === smsTemplate)?.body.replace('{{name}}', piiSource?.fullName ?? '대상자')}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsDialogOpen(false)}>취소</Button>
            <Button onClick={handleSendSms} disabled={!smsTemplate || smsSending} className="bg-orange-600 hover:bg-orange-700">
              {smsSending ? '발송 중…' : 'SMS 발송'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PII Access Dialog */}
      <Dialog open={piiDialogOpen} onOpenChange={setPiiDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              개인정보 열람 요청
            </DialogTitle>
            <DialogDescription>
              개인정보 열람 시 모든 접근 기록이 감사로그에 저장되며, 상급기관에서 추적됩니다.
            </DialogDescription>
          </DialogHeader>

          {!piiData ? (
            <div className="space-y-4 py-4">
              <div className="border-2 border-red-200 bg-red-50 p-4 rounded">
                <p className="text-sm text-red-900 font-medium">
                  ⚠️ 개인정보보호법 준수 안내
                </p>
                <p className="text-xs text-red-800 mt-2 leading-relaxed">
                  개인정보는 업무상 필요한 경우에만 열람할 수 있습니다. 
                  모든 열람 이력은 시스템에 자동 기록되며, 상급기관의 감사 대상입니다.
                  부적절한 접근 시 관련 법규에 따라 처벌받을 수 있습니다.
                </p>
              </div>

              <div>
                <Label htmlFor="access-reason">열람 사유 선택 *</Label>
                <Select value={accessReason} onValueChange={setAccessReason}>
                  <SelectTrigger id="access-reason" className="mt-2">
                    <SelectValue placeholder="사유를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">상담 진행을 위한 연락처 확인</SelectItem>
                    <SelectItem value="appointment">예약 확정 및 SMS 발송</SelectItem>
                    <SelectItem value="emergency">응급 상황 대응</SelectItem>
                    <SelectItem value="family_contact">보호자 연락 필요</SelectItem>
                    <SelectItem value="verification">본인 확인 및 신원 검증</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-gray-100 p-3 rounded text-xs text-gray-700">
                <p className="font-semibold mb-1">열람 이력 기록 내용:</p>
                <p>• 접근 일시: {new Date().toLocaleString('ko-KR')}</p>
                <p>• 접근자: {sharedCase?.counselor ?? '상담사'} (USER-001)</p>
                <p>• 케이스 ID: {caseId}</p>
                <p>• 접근 사유: {accessReason || '(선택 필요)'}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="border-2 border-green-200 bg-green-50 p-4 rounded">
                <p className="text-sm text-green-900 font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  개인정보 열람 승인됨
                </p>
                <p className="text-xs text-green-800 mt-1">
                  열람 시작: {new Date().toLocaleString('ko-KR')}
                </p>
              </div>

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
                  <div className="text-xs text-gray-500 mb-1">전체 주소</div>
                  <div className="font-medium text-gray-900">{piiData.fullAddress}</div>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <div className="text-xs text-gray-500 mb-1">연락처</div>
                  <div className="font-medium text-gray-900">{piiData.detailedPhone}</div>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <div className="text-xs text-gray-500 mb-1">비상연락망</div>
                  <div className="font-medium text-gray-900">
                    {piiData.emergencyContactName}: {piiData.emergencyContact}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <div className="text-xs text-gray-500 mb-1">기존 병력</div>
                  <div className="font-medium text-gray-900">
                    {piiData.medicalHistory.join(', ')}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {!piiData ? (
              <>
                <Button variant="outline" onClick={() => setPiiDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleRequestPiiAccess} disabled={!accessReason}>
                  확인 및 열람
                </Button>
              </>
            ) : (
              <Button onClick={handleClosePii} className="w-full">
                <EyeOff className="h-4 w-4 mr-2" />
                닫기 (비식별 상태로 복귀)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consultation Dialog */}
      <Dialog open={consultationOpen} onOpenChange={setConsultationOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI 지원 상담 진행</DialogTitle>
            <DialogDescription>
              AI가 현재 케이스 상태를 분석하여 적절한 상담 스크립트를 제공합니다
            </DialogDescription>
          </DialogHeader>

          {/* Step Progress */}
          <div className="flex items-center justify-between mb-6">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    index <= currentStepIndex
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  }`}
                >
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-16 h-1 ${
                      index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Current Step Content */}
          <div className="space-y-4">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  {currentScriptData.title}
                </h3>
                <p className="text-blue-800 mb-3 text-sm leading-relaxed">
                  {currentScriptData.aiSuggestion}
                </p>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-blue-900">💡 상담 팁:</p>
                  {currentScriptData.tips.map((tip, index) => (
                    <p key={index} className="text-xs text-blue-700">
                      • {tip}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div>
              <Label htmlFor={`notes-${currentStep}`}>상담 메모</Label>
              <Textarea
                id={`notes-${currentStep}`}
                value={consultationNotes[currentStep]}
                onChange={(e) =>
                  setConsultationNotes((prev) => ({
                    ...prev,
                    [currentStep]: e.target.value,
                  }))
                }
                placeholder="이 단계에서의 대화 내용, 특이사항 등을 기록하세요"
                rows={4}
                className="mt-2"
              />
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handlePreviousStep}
                disabled={currentStepIndex === 0}
              >
                이전 단계
              </Button>
              {currentStepIndex < steps.length - 1 ? (
                <Button onClick={handleNextStep}>
                  다음 단계
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={() => {}} disabled>
                  마지막 단계
                </Button>
              )}
            </div>

            {/* Consultation Completion (Show on last step) */}
            {currentStepIndex === steps.length - 1 && (
              <Card className="border-green-200 bg-green-50 mt-6">
                <CardHeader>
                  <CardTitle className="text-green-900">상담 완료 및 결과 기록</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>상담 결과 *</Label>
                    <RadioGroup
                      value={consultationResult}
                      onValueChange={(value: any) => setConsultationResult(value)}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="completed" id="completed" />
                        <Label htmlFor="completed" className="font-normal">
                          <CheckCircle className="h-4 w-4 inline mr-1 text-green-600" />
                          상담 완료
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="postponed" id="postponed" />
                        <Label htmlFor="postponed" className="font-normal">
                          <AlertCircle className="h-4 w-4 inline mr-1 text-yellow-600" />
                          보류
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="refused" id="refused" />
                        <Label htmlFor="refused" className="font-normal">
                          <XCircle className="h-4 w-4 inline mr-1 text-red-600" />
                          거부
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {(consultationResult === 'postponed' || consultationResult === 'refused') && (
                    <div>
                      <Label htmlFor="result-reason">사유 코드 / 설명 *</Label>
                      <Input
                        id="result-reason"
                        value={resultReason}
                        onChange={(e) => setResultReason(e.target.value)}
                        placeholder="예: 본인 거부 - 건강하다고 생각함"
                        className="mt-2"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="consultation-memo">전체 상담 메모</Label>
                    <Textarea
                      id="consultation-memo"
                      value={consultationMemo}
                      onChange={(e) => setConsultationMemo(e.target.value)}
                      placeholder="전체 상담 내용 요약 및 특이사항"
                      rows={4}
                      className="mt-2"
                    />
                  </div>

                  {/* 연계 및 예약 섹션 */}
                  <div className="border-t-2 border-green-300 pt-4 mt-4">
                    <h4 className="font-semibold text-green-900 mb-3">연계 및 예약 처리</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <Label>연계 유형</Label>
                        <RadioGroup value={referralType} onValueChange={(value: any) => setReferralType(value)} className="mt-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="screening" id="screening" />
                            <Label htmlFor="screening" className="font-normal">센터 선별검사 예약</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="health_center" id="health_center" />
                            <Label htmlFor="health_center" className="font-normal">보건소 안내</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="medical" id="medical" />
                            <Label htmlFor="medical" className="font-normal">의료기관 의뢰</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {referralType && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="appointment-date">예약 날짜</Label>
                              <Input
                                id="appointment-date"
                                type="date"
                                value={appointmentDate}
                                onChange={(e) => setAppointmentDate(e.target.value)}
                                className="mt-2"
                              />
                            </div>
                            <div>
                              <Label htmlFor="appointment-time">예약 시간</Label>
                              <Input
                                id="appointment-time"
                                type="time"
                                value={appointmentTime}
                                onChange={(e) => setAppointmentTime(e.target.value)}
                                className="mt-2"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="pre-visit">방문 전 안내사항</Label>
                            <Textarea
                              id="pre-visit"
                              value={preVisitNotes}
                              onChange={(e) => setPreVisitNotes(e.target.value)}
                              placeholder="예: 신분증 지참, 편한 복장 착용"
                              rows={2}
                              className="mt-2"
                            />
                          </div>

                          <Button onClick={handleConfirmAppointment} variant="outline" className="w-full">
                            예약 확정 및 SMS 발송
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 이탈 처리 섹션 */}
                  <div className="border-t-2 border-orange-300 pt-4 mt-4">
                    <h4 className="font-semibold text-orange-900 mb-3">이탈 처리</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="dropout-reason">이탈 사유</Label>
                        <Select value={dropoutReason} onValueChange={setDropoutReason}>
                          <SelectTrigger id="dropout-reason" className="mt-2">
                            <SelectValue placeholder="사유를 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no_response">연락 두절</SelectItem>
                            <SelectItem value="refused">본인 거부</SelectItem>
                            <SelectItem value="family_refused">가족 거부</SelectItem>
                            <SelectItem value="relocated">전출</SelectItem>
                            <SelectItem value="deceased">사망</SelectItem>
                            <SelectItem value="other">기타</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {dropoutReason && (
                        <>
                          <div>
                            <Label htmlFor="dropout-details">상세 설명</Label>
                            <Textarea
                              id="dropout-details"
                              value={dropoutDetails}
                              onChange={(e) => setDropoutDetails(e.target.value)}
                              placeholder="이탈 경위 및 세부 사항을 기록하세요"
                              rows={3}
                              className="mt-2"
                            />
                          </div>

                          <div>
                            <Label htmlFor="recontact-plan">재접촉 계획</Label>
                            <Textarea
                              id="recontact-plan"
                              value={recontactPlan}
                              onChange={(e) => setRecontactPlan(e.target.value)}
                              placeholder="재접촉 시도 일정 및 방법 (선택사항)"
                              rows={2}
                              className="mt-2"
                            />
                          </div>

                          <Button onClick={handleDropoutConfirm} variant="destructive" className="w-full">
                            이탈 처리 확정
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleCompleteConsultation} className="flex-1">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      상담 완료 및 저장
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
