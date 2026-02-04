import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Clock,
  Brain,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  Send,
  Calendar,
  Building2,
  Hospital,
  Stethoscope,
  UserX,
  RefreshCw,
  Copy,
  FileText,
  ArrowLeft,
  AlertTriangle,
  Mail,
  MapPin,
  History,
  Link,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
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
import { Separator } from '../ui/separator';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface ConsultationPageProps {
  caseId: string;
  patientName?: string;
  onComplete?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
}

type CaseStatus = 'new' | 'contacted' | 'reconsultation' | 'dropout_recontact';
type ConsultationStep = 'greeting' | 'purpose' | 'assessment' | 'scheduling';
type MainTab = 'consultation' | 'referral' | 'dropout' | 'history';

interface ConsultationScript {
  step: ConsultationStep;
  title: string;
  content: string;
  tips: string[];
  checkpoints: string[];
}

interface ConsultationHistory {
  id: string;
  date: string;
  time: string;
  counselor: string;
  duration: number;
  result: 'completed' | 'postponed' | 'refused';
  summary: string;
  actions: string[];
}

export function ConsultationPage({ caseId, patientName, onComplete, onCancel, onBack }: ConsultationPageProps) {
  // Tab Management
  const [activeTab, setActiveTab] = useState<MainTab>('consultation');
  
  // Case Data
  const [caseStatus, setCaseStatus] = useState<CaseStatus>('new');
  const [consultationStartTime, setConsultationStartTime] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  
  // Consultation Recording
  const [currentStep, setCurrentStep] = useState<ConsultationStep>('greeting');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [consultationResult, setConsultationResult] = useState<'completed' | 'postponed' | 'refused' | ''>('');
  const [resultReason, setResultReason] = useState('');
  const [resultReasonCode, setResultReasonCode] = useState('');
  
  // Referral & Appointment
  const [referralType, setReferralType] = useState<'screening' | 'health_center' | 'medical' | ''>('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [preVisitNotes, setPreVisitNotes] = useState('');
  const [smsPreview, setSmsPreview] = useState('');
  
  // Dropout & Recontact
  const [dropoutReason, setDropoutReason] = useState('');
  const [dropoutDetails, setDropoutDetails] = useState('');
  const [recontactDate, setRecontactDate] = useState('');
  const [recontactPlan, setRecontactPlan] = useState('');
  
  // Mock Case Data
  const caseData = {
    id: caseId,
    patientId: 'CASE-2026-0215',
    ageGroup: '70대 초반',
    gender: '남성',
    phone: '010-1234-5678',
    address: '서울시 강남구 **동',
    riskLevel: 'high' as const,
    riskScore: 78,
    status: 'contacted',
    counselor: '이상담',
    registeredDate: '2026-01-15',
    lastContact: '2026-02-01',
  };

  // Mock Consultation History
  const [consultationHistory] = useState<ConsultationHistory[]>([
    {
      id: 'CONS-001',
      date: '2026-02-01',
      time: '10:30',
      counselor: '이상담',
      duration: 15,
      result: 'completed',
      summary: '초기 상담 완료. 센터 방문 예약 확정.',
      actions: ['초기 선별검사 예약 (2026-02-10)'],
    },
  ]);

  // Consultation Scripts
  const consultationScripts: Record<CaseStatus, Record<ConsultationStep, ConsultationScript>> = {
    new: {
      greeting: {
        step: 'greeting',
        title: '1단계: 인사 및 신원 확인',
        content: `안녕하세요, 저는 강남구 치매안심센터의 ${caseData.counselor} 상담사입니다. 지금 통화 가능하신가요?\n\n본인 확인을 위해 성함과 생년월일 앞자리를 여쭤봐도 될까요?`,
        tips: [
          '차분하고 따뜻한 어조로 시작하세요',
          '통화 가능 여부를 먼저 확인하세요',
          '신원 확인은 개인정보보호를 위해 필수입니다',
        ],
        checkpoints: ['통화 가능 확인', '신원 확인 완료', '대화 분위기 조성'],
      },
      purpose: {
        step: 'purpose',
        title: '2단계: 연락 목적 설명',
        content: `치매안심센터에서는 지역 주민분들의 건강을 돕기 위해 정기적으로 건강 상태를 확인하고 있습니다.\n\n최근 건강검진 결과와 설문 응답을 바탕으로 인지 건강 관리에 도움이 필요하실 수 있어 연락드렸습니다. 모든 내용은 비밀이 보장되며, 무료로 지원해드리고 있습니다.`,
        tips: [
          '불안감을 주지 않도록 주의하세요',
          '센터의 지원 목적을 명확히 설명하세요',
          '비밀보장과 무료 지원을 강조하세요',
        ],
        checkpoints: ['목적 이해 확인', '불안감 해소', '협조 의사 파악'],
      },
      assessment: {
        step: 'assessment',
        title: '3단계: 현재 상황 파악',
        content: `요즘 일상생활에서 불편함은 없으신가요?\n\n예를 들어:\n- 약속이나 날짜를 잊으신 적이 있나요?\n- 물건을 자주 잃어버리시나요?\n- 같은 말을 반복하신다는 얘기를 들으신 적 있나요?\n- 가족분들과는 자주 연락하고 계신가요?`,
        tips: [
          '개방형 질문으로 대화를 유도하세요',
          '판단하지 말고 경청하세요',
          '특이사항은 반드시 메모하세요',
        ],
        checkpoints: ['인지 상태 파악', '일상생활 능력 확인', '사회적 지지 체계 파악'],
      },
      scheduling: {
        step: 'scheduling',
        title: '4단계: 센터 방문 안내 및 예약',
        content: `무료로 인지 건강 선별검사를 받으실 수 있습니다. 약 30분 정도 소요되며, 결과에 따라 필요한 지원을 안내해드립니다.\n\n센터 위치는 ${caseData.address} 근처이며, 대중교통으로 쉽게 오실 수 있습니다.\n\n편하신 날짜에 방문 예약을 도와드리겠습니다. 언제 시간이 되실까요?`,
        tips: [
          '검사의 간편함과 무료임을 강조하세요',
          '센터 위치와 교통편을 안내하세요',
          '특이사항(보청기, 층수 등)을 확인하세요',
        ],
        checkpoints: ['검사 동의 획득', '예약 날짜 확정', '특이사항 확인'],
      },
    },
    contacted: {
      greeting: {
        step: 'greeting',
        title: '1단계: 재상담 인사',
        content: `안녕하세요, 강남구 치매안심센터 ${caseData.counselor} 상담사입니다. 지난번 통화 이후 잘 지내셨나요?`,
        tips: ['친근하게 인사하세요', '이전 상담 내용을 언급하세요'],
        checkpoints: ['본인 확인', '건강 상태 간단 확인'],
      },
      purpose: {
        step: 'purpose',
        title: '2단계: 재상담 목적',
        content: `지난번 말씀드린 검사 일정 확인차 연락드렸습니다. 혹시 추가로 궁금하신 사항이 있으신가요?`,
        tips: ['이전 약속 상기시키기', '추가 질문 기회 제공'],
        checkpoints: ['예약 기억 확인', '추가 질문 응대'],
      },
      assessment: {
        step: 'assessment',
        title: '3단계: 상태 변화 확인',
        content: `지난번 이후로 건강 상태에 변화가 있으셨나요? 불편한 점이 있으시면 말씀해주세요.`,
        tips: ['변화 사항 파악', '새로운 증상 확인'],
        checkpoints: ['상태 변화 파악', '새로운 우려사항 확인'],
      },
      scheduling: {
        step: 'scheduling',
        title: '4단계: 예약 재확인',
        content: `그럼 예약 날짜를 다시 한번 확인해드리겠습니다. 방문 전 준비하실 것은 신분증만 지참하시면 됩니다.`,
        tips: ['예약 정보 재확인', '준비사항 안내'],
        checkpoints: ['예약 확정', 'SMS 발송 동의'],
      },
    },
    reconsultation: {
      greeting: {
        step: 'greeting',
        title: '1단계: 후속 상담 인사',
        content: `안녕하세요, ${caseData.counselor} 상담사입니다. 지난 검사 이후 결과 안내차 연락드렸습니다.`,
        tips: ['검사 결과 안내 준비', '긍정적 분위기 유지'],
        checkpoints: ['본인 확인', '통화 가능 시간 확인'],
      },
      purpose: {
        step: 'purpose',
        title: '2단계: 결과 안내',
        content: `검사 결과를 안내드리고, 필요한 후속 조치에 대해 말씀드리려고 합니다.`,
        tips: ['결과를 명확히 전달', '걱정을 덜어주기'],
        checkpoints: ['결과 이해도 확인', '질문 응대'],
      },
      assessment: {
        step: 'assessment',
        title: '3단계: 후속 조치 필요성 설명',
        content: `검사 결과에 따라 추가 검사 또는 정기 관리가 필요할 수 있습니다. 자세히 설명드리겠습니다.`,
        tips: ['후속 조치 명확히 설명', '동의 구하기'],
        checkpoints: ['후속 조치 이해', '동의 획득'],
      },
      scheduling: {
        step: 'scheduling',
        title: '4단계: 후속 조치 예약',
        content: `그럼 다음 검사 일정을 잡아드리겠습니다. 언제가 편하실까요?`,
        tips: ['일정 조율', '지속 관리 중요성 강조'],
        checkpoints: ['예약 확정', '지속 관리 동의'],
      },
    },
    dropout_recontact: {
      greeting: {
        step: 'greeting',
        title: '1단계: 재접촉 인사',
        content: `안녕하세요, 강남구 치매안심센터입니다. 오랜만에 연락드립니다. 그동안 잘 지내셨나요?`,
        tips: ['부담스럽지 않게 인사', '지난 이유 언급하지 않기'],
        checkpoints: ['본인 확인', '통화 분위기 파악'],
      },
      purpose: {
        step: 'purpose',
        title: '2단계: 재접촉 목적',
        content: `새로운 무료 지원 프로그램이 생겨서 안내드리고자 연락드렸습니다.`,
        tips: ['새로운 기회 제시', '부담 없이 제안'],
        checkpoints: ['관심도 파악', '거부감 확인'],
      },
      assessment: {
        step: 'assessment',
        title: '3단계: 현재 상태 재확인',
        content: `요즘 건강은 어떠신가요? 필요하신 지원이 있으시면 말씀해주세요.`,
        tips: ['현재 상태 파악', '필요 지원 확인'],
        checkpoints: ['건강 상태 파악', '지원 필요성 확인'],
      },
      scheduling: {
        step: 'scheduling',
        title: '4단계: 재참여 유도',
        content: `혹시 시간 되시면 센터에 한번 방문해보시겠어요? 부담 없이 상담만 받아보실 수 있습니다.`,
        tips: ['부담 없는 제안', '유연한 일정 제시'],
        checkpoints: ['재참여 의사 확인', '예약 가능성 파악'],
      },
    },
  };

  useEffect(() => {
    // Auto-save every 30 seconds
    if (autoSaveEnabled && consultationNotes.trim()) {
      const interval = setInterval(() => {
        handleAutoSave();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [consultationNotes, autoSaveEnabled]);

  useEffect(() => {
    // Update SMS preview when appointment details change
    if (referralType && appointmentDate && appointmentTime) {
      const dateObj = new Date(appointmentDate);
      const dateStr = dateObj.toLocaleDateString('ko-KR', { 
        month: 'long', 
        day: 'numeric',
        weekday: 'short'
      });
      
      const referralTypeText = 
        referralType === 'screening' ? '선별검사' :
        referralType === 'health_center' ? '보건소 안내' :
        '의료기관 의뢰';
      
      const message = `[강남구 치매안심센터] ${dateStr} ${appointmentTime} ${referralTypeText} 예약이 확정되었습니다.\n\n주소: 서울시 강남구 역삼동 123-45\n문의: 02-1234-5678\n\n${preVisitNotes ? '안내사항: ' + preVisitNotes : ''}`;
      
      setSmsPreview(message);
    } else {
      setSmsPreview('');
    }
  }, [referralType, appointmentDate, appointmentTime, preVisitNotes]);

  const handleStartConsultation = () => {
    setConsultationStartTime(new Date());
    console.log('[AUDIT] Consultation Started:', {
      action: 'CONSULTATION_START',
      caseId: caseData.id,
      counselor: caseData.counselor,
      timestamp: new Date().toISOString(),
    });
  };

  const handleAutoSave = () => {
    console.log('[AUTO-SAVE] Consultation Draft Saved:', {
      caseId: caseData.id,
      notes: consultationNotes,
      timestamp: new Date().toISOString(),
    });
  };

  const handleInsertScript = (script: string) => {
    const newNotes = consultationNotes + (consultationNotes ? '\n\n' : '') + `[${currentScriptData.title}]\n${script}`;
    setConsultationNotes(newNotes);
  };

  const handleTemporarySave = () => {
    console.log('[AUDIT] Temporary Save:', {
      action: 'CONSULTATION_TEMP_SAVE',
      caseId: caseData.id,
      notes: consultationNotes,
      result: consultationResult,
      timestamp: new Date().toISOString(),
    });
    alert('임시 저장되었습니다.');
  };

  const handleCompleteConsultation = () => {
    if (!consultationResult) {
      alert('상담 결과를 선택해주세요.');
      return;
    }

    if ((consultationResult === 'postponed' || consultationResult === 'refused') && !resultReasonCode) {
      alert('사유 코드를 선택해주세요.');
      return;
    }

    const duration = consultationStartTime 
      ? Math.floor((new Date().getTime() - consultationStartTime.getTime()) / 60000)
      : 0;

    console.log('[AUDIT] Consultation Completed:', {
      action: 'CONSULTATION_COMPLETE',
      caseId: caseData.id,
      counselor: caseData.counselor,
      result: consultationResult,
      reasonCode: resultReasonCode,
      reason: resultReason,
      notes: consultationNotes,
      duration,
      referral: referralType ? { type: referralType, date: appointmentDate, time: appointmentTime } : null,
      dropout: dropoutReason ? { reason: dropoutReason, details: dropoutDetails } : null,
      timestamp: new Date().toISOString(),
    });

    alert(`상담이 완료되었습니다!\n\n상담 시간: ${duration}분\n결과: ${consultationResult === 'completed' ? '상담완료' : consultationResult === 'postponed' ? '보류' : '거부'}\n\n대시보드 상태가 업데이트되었습니다.`);
    
    if (onComplete) {
      onComplete();
    }
  };

  const handleConfirmAppointment = () => {
    if (!referralType || !appointmentDate || !appointmentTime) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    console.log('[AUDIT] Appointment Confirmed & SMS Sent:', {
      action: 'APPOINTMENT_CREATE',
      caseId: caseData.id,
      counselor: caseData.counselor,
      referralType,
      appointmentDate,
      appointmentTime,
      preVisitNotes,
      smsContent: smsPreview,
      recipientPhone: caseData.phone,
      timestamp: new Date().toISOString(),
    });

    alert(`✅ 예약이 확정되었습니다!\n\nSMS가 ${caseData.phone}로 발송되었습니다.\n\n발송 내용:\n${smsPreview}`);
    
    // Auto-tag to consultation notes
    const appointmentTag = `\n\n[연계/예약 완료]\n종류: ${referralType === 'screening' ? '센터 선별검사' : referralType === 'health_center' ? '보건소 안내' : '의료기관 의뢰'}\n날짜: ${appointmentDate} ${appointmentTime}\nSMS 발송: 완료`;
    setConsultationNotes(consultationNotes + appointmentTag);
    
    // Return to consultation tab
    setActiveTab('consultation');
  };

  const handleDropoutConfirm = () => {
    if (!dropoutReason || !dropoutDetails.trim()) {
      alert('이탈 사유와 상세 설명을 모두 입력해주세요.');
      return;
    }

    console.log('[AUDIT] Case Dropout:', {
      action: 'CASE_DROPOUT',
      caseId: caseData.id,
      counselor: caseData.counselor,
      dropoutReason,
      dropoutDetails,
      recontactDate,
      recontactPlan,
      timestamp: new Date().toISOString(),
    });

    alert(`⚠️ 이탈 처리가 완료되었습니다.\n\n대시보드 상태가 '이탈'로 변경되었습니다.${recontactDate ? `\n\n재접촉 알림: ${recontactDate}` : ''}`);
    
    // Auto-tag to consultation notes
    const dropoutTag = `\n\n[이탈 처리 완료]\n사유: ${dropoutReason}\n상세: ${dropoutDetails}\n${recontactDate ? '재접촉 예정: ' + recontactDate : ''}`;
    setConsultationNotes(consultationNotes + dropoutTag);
    
    // Return to consultation tab
    setActiveTab('consultation');
  };

  const currentScriptSet = consultationScripts[caseStatus];
  const currentScriptData = currentScriptSet[currentStep];

  const getElapsedTime = () => {
    if (!consultationStartTime) return '00:00';
    const elapsed = Math.floor((new Date().getTime() - consultationStartTime.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header - Fixed (Always Visible) */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack || onCancel} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">상담 관리</h1>
              <p className="text-sm text-gray-500">케이스 ID: {caseData.patientId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {consultationStartTime ? (
              <Badge variant="destructive" className="text-base px-4 py-2">
                <Clock className="h-4 w-4 mr-2" />
                상담 진행중 {getElapsedTime()}
              </Badge>
            ) : (
              <Button onClick={handleStartConsultation} variant="default">
                <MessageSquare className="h-4 w-4 mr-2" />
                상담 시작
              </Button>
            )}
          </div>
        </div>

        {/* Case Info Summary (Sticky) */}
        <div className="mt-4 grid grid-cols-6 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div>
            <p className="text-xs text-gray-500 mb-1">연령대 / 성별</p>
            <p className="font-semibold text-sm">{caseData.ageGroup} / {caseData.gender}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">연락처</p>
            <p className="font-semibold text-sm flex items-center gap-1">
              <Phone className="h-3 w-3 text-gray-400" />
              {caseData.phone}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">주소</p>
            <p className="font-semibold text-sm flex items-center gap-1">
              <MapPin className="h-3 w-3 text-gray-400" />
              {caseData.address}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">위험도</p>
            <Badge variant="destructive" className="text-xs">
              높음 ({caseData.riskScore})
            </Badge>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">상태</p>
            <Badge variant="outline" className="text-xs">
              {caseData.status === 'contacted' ? '접촉완료' : '미접촉'}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">담당 상담사</p>
            <p className="font-semibold text-sm flex items-center gap-1">
              <User className="h-3 w-3 text-gray-400" />
              {caseData.counselor}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MainTab)} className="h-full flex flex-col">
          <div className="bg-white border-b border-gray-200 px-6">
            <TabsList className="w-full justify-start bg-transparent">
              <TabsTrigger value="consultation" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900">
                <MessageSquare className="h-4 w-4 mr-2" />
                상담 진행
              </TabsTrigger>
              <TabsTrigger value="referral" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-900">
                <Link className="h-4 w-4 mr-2" />
                연계/예약
              </TabsTrigger>
              <TabsTrigger value="dropout" className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-900">
                <UserX className="h-4 w-4 mr-2" />
                이탈 관리
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-gray-50">
                <History className="h-4 w-4 mr-2" />
                상담 이력
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto">
            {/* Tab 1: Consultation (Main) */}
            <TabsContent value="consultation" className="h-full m-0 p-6">
              <div className="max-w-[1400px] mx-auto">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left: AI Script */}
                  <Card className="h-fit">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                      <CardTitle className="flex items-center gap-2 text-blue-900">
                        <Brain className="h-5 w-5" />
                        AI 추천 상담 스크립트
                      </CardTitle>
                      <CardDescription>
                        케이스 상태: <Badge variant="outline" className="ml-2">{caseStatus === 'new' ? '신규' : caseStatus === 'contacted' ? '접촉완료' : caseStatus === 'reconsultation' ? '재상담' : '이탈 후 재접촉'}</Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {/* Step Selector */}
                      <div className="grid grid-cols-4 gap-2">
                        {(['greeting', 'purpose', 'assessment', 'scheduling'] as ConsultationStep[]).map((step, idx) => (
                          <Button
                            key={step}
                            variant={currentStep === step ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentStep(step)}
                          >
                            {idx + 1}단계
                          </Button>
                        ))}
                      </div>

                      <Separator />

                      {/* Script Content */}
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">
                          {currentScriptData.title}
                        </h3>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <p className="text-sm text-blue-900 whitespace-pre-line leading-relaxed">
                            {currentScriptData.content}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                            onClick={() => handleInsertScript(currentScriptData.content)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            메모에 추가
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                              상담 팁
                            </h4>
                            <ul className="space-y-1">
                              {currentScriptData.tips.map((tip, idx) => (
                                <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                                  <span className="text-orange-500 font-bold">•</span>
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              체크포인트
                            </h4>
                            <div className="space-y-1">
                              {currentScriptData.checkpoints.map((checkpoint, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input type="checkbox" className="rounded" />
                                  <span className="text-xs text-gray-600">{checkpoint}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Right: Consultation Recording */}
                  <Card className="h-fit">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b">
                      <CardTitle className="flex items-center gap-2 text-green-900">
                        <FileText className="h-5 w-5" />
                        상담 기록 및 결과 입력
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        {consultationStartTime && (
                          <>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              시작: {consultationStartTime.toLocaleTimeString('ko-KR')}
                            </span>
                            <span className="flex items-center gap-1">
                              상담 시간: {getElapsedTime()}
                            </span>
                          </>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {/* Consultation Notes */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="consultation-notes">상담 메모</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="auto-save"
                              checked={autoSaveEnabled}
                              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                              className="rounded"
                            />
                            <label htmlFor="auto-save" className="text-xs text-gray-500">
                              30초마다 자동저장
                            </label>
                          </div>
                        </div>
                        <Textarea
                          id="consultation-notes"
                          value={consultationNotes}
                          onChange={(e) => setConsultationNotes(e.target.value)}
                          placeholder="상담 내용, 환자 반응, 특이사항 등을 자유롭게 기록하세요..."
                          rows={12}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {consultationNotes.length} 자 / 자동저장: {autoSaveEnabled ? '활성화' : '비활성화'}
                        </p>
                      </div>

                      <Separator />

                      {/* Consultation Result */}
                      <div>
                        <Label>상담 결과 *</Label>
                        <RadioGroup
                          value={consultationResult}
                          onValueChange={(value: any) => setConsultationResult(value)}
                          className="mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="completed" id="completed" />
                            <Label htmlFor="completed" className="font-normal flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              상담 완료
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="postponed" id="postponed" />
                            <Label htmlFor="postponed" className="font-normal flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-yellow-600" />
                              보류
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="refused" id="refused" />
                            <Label htmlFor="refused" className="font-normal flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-red-600" />
                              거부
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Result Reason (if postponed or refused) */}
                      {(consultationResult === 'postponed' || consultationResult === 'refused') && (
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="result-reason-code">사유 코드 *</Label>
                            <Select value={resultReasonCode} onValueChange={setResultReasonCode}>
                              <SelectTrigger id="result-reason-code" className="mt-2">
                                <SelectValue placeholder="사유 코드를 선택하세요" />
                              </SelectTrigger>
                              <SelectContent>
                                {consultationResult === 'postponed' ? (
                                  <>
                                    <SelectItem value="P001">P001 - 일정 불가</SelectItem>
                                    <SelectItem value="P002">P002 - 가족 상의 필요</SelectItem>
                                    <SelectItem value="P003">P003 - 건강 상태 불량</SelectItem>
                                    <SelectItem value="P999">P999 - 기타</SelectItem>
                                  </>
                                ) : (
                                  <>
                                    <SelectItem value="R001">R001 - 본인 거부 (필요성 부정)</SelectItem>
                                    <SelectItem value="R002">R002 - 가족 거부</SelectItem>
                                    <SelectItem value="R003">R003 - 시간 부족</SelectItem>
                                    <SelectItem value="R004">R004 - 센터 불신</SelectItem>
                                    <SelectItem value="R999">R999 - 기타</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="result-reason">상세 사유</Label>
                            <Input
                              id="result-reason"
                              value={resultReason}
                              onChange={(e) => setResultReason(e.target.value)}
                              placeholder="구체적인 사유를 입력하세요"
                              className="mt-2"
                            />
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* Quick Actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setActiveTab('referral')}
                          className="w-full"
                        >
                          <Link className="h-4 w-4 mr-2" />
                          연계/예약
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setActiveTab('dropout')}
                          className="w-full"
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          이탈 관리
                        </Button>
                      </div>

                      <Separator />

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={handleTemporarySave} className="flex-1">
                          <Save className="h-4 w-4 mr-2" />
                          임시 저장
                        </Button>
                        <Button 
                          onClick={handleCompleteConsultation} 
                          className="flex-1"
                          disabled={!consultationResult}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          상담 완료
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Referral & Appointment */}
            <TabsContent value="referral" className="h-full m-0 p-6">
              <div className="max-w-[1200px] mx-auto">
                <Card>
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-purple-900">
                      <Calendar className="h-5 w-5" />
                      연계 및 예약
                    </CardTitle>
                    <CardDescription>
                      센터 검사 예약, 보건소 안내, 의료기관 의뢰 등 - 저장 시 상담 기록에 자동 반영됩니다
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left: Appointment Details */}
                      <div className="space-y-4">
                        <div>
                          <Label>연계 유형 *</Label>
                          <RadioGroup 
                            value={referralType} 
                            onValueChange={(value: any) => setReferralType(value)}
                            className="mt-2 space-y-2"
                          >
                            <div className="flex items-center space-x-2 border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                              <RadioGroupItem value="screening" id="screening" />
                              <Label htmlFor="screening" className="font-normal flex items-center gap-2 cursor-pointer flex-1">
                                <Brain className="h-4 w-4 text-purple-600" />
                                센터 선별검사 예약
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                              <RadioGroupItem value="health_center" id="health_center" />
                              <Label htmlFor="health_center" className="font-normal flex items-center gap-2 cursor-pointer flex-1">
                                <Building2 className="h-4 w-4 text-blue-600" />
                                보건소 안내
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                              <RadioGroupItem value="medical" id="medical" />
                              <Label htmlFor="medical" className="font-normal flex items-center gap-2 cursor-pointer flex-1">
                                <Hospital className="h-4 w-4 text-red-600" />
                                의료기관 의뢰
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="appointment-date">예약 날짜 *</Label>
                            <Input
                              id="appointment-date"
                              type="date"
                              value={appointmentDate}
                              onChange={(e) => setAppointmentDate(e.target.value)}
                              className="mt-2"
                              min={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                          <div>
                            <Label htmlFor="appointment-time">예약 시간 *</Label>
                            <Select value={appointmentTime} onValueChange={setAppointmentTime}>
                              <SelectTrigger id="appointment-time" className="mt-2">
                                <SelectValue placeholder="시간 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="09:00">오전 09:00</SelectItem>
                                <SelectItem value="10:00">오전 10:00</SelectItem>
                                <SelectItem value="11:00">오전 11:00</SelectItem>
                                <SelectItem value="14:00">오후 02:00</SelectItem>
                                <SelectItem value="15:00">오후 03:00</SelectItem>
                                <SelectItem value="16:00">오후 04:00</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="pre-visit">방문 전 안내사항</Label>
                          <Textarea
                            id="pre-visit"
                            value={preVisitNotes}
                            onChange={(e) => setPreVisitNotes(e.target.value)}
                            placeholder="예: 신분증 지참, 편한 복장 착용, 공복 불필요"
                            rows={3}
                            className="mt-2"
                          />
                        </div>
                      </div>

                      {/* Right: SMS Preview */}
                      <div className="space-y-4">
                        <div>
                          <Label>SMS 발송 미리보기</Label>
                          <div className="mt-2 bg-gray-900 text-white p-4 rounded-lg min-h-[200px] font-mono text-sm whitespace-pre-line">
                            {smsPreview || '← 좌측에서 예약 정보를 입력하면 자동으로 SMS가 생성됩니다'}
                          </div>
                        </div>

                        <Alert>
                          <Send className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            <strong>수신번호:</strong> {caseData.phone}<br />
                            예약 확정 시 자동으로 SMS가 발송되며, 상담 기록에 자동 반영됩니다.
                          </AlertDescription>
                        </Alert>

                        <div className="flex gap-2">
                          <Button 
                            variant="outline"
                            onClick={() => setActiveTab('consultation')} 
                            className="flex-1"
                          >
                            상담으로 돌아가기
                          </Button>
                          <Button 
                            onClick={handleConfirmAppointment} 
                            className="flex-1"
                            disabled={!referralType || !appointmentDate || !appointmentTime}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            예약 확정
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab 3: Dropout Management */}
            <TabsContent value="dropout" className="h-full m-0 p-6">
              <div className="max-w-[1200px] mx-auto">
                <Card className="border-orange-200">
                  <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-200">
                    <CardTitle className="flex items-center gap-2 text-orange-900">
                      <UserX className="h-5 w-5" />
                      이탈 및 재접촉 관리
                    </CardTitle>
                    <CardDescription>
                      이탈 사유 기록 및 재접촉 계획 수립 - 저장 시 상담 기록에 자동 반영됩니다
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left: Dropout */}
                      <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          이탈 처리
                        </h3>
                        
                        <div>
                          <Label htmlFor="dropout-reason">이탈 사유 *</Label>
                          <Select value={dropoutReason} onValueChange={setDropoutReason}>
                            <SelectTrigger id="dropout-reason" className="mt-2">
                              <SelectValue placeholder="사유를 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no_response">D001 - 연락 두절 (3회 이상 시도)</SelectItem>
                              <SelectItem value="refused">D002 - 본인 명시적 거부</SelectItem>
                              <SelectItem value="family_refused">D003 - 가족 거부</SelectItem>
                              <SelectItem value="relocated">D004 - 전출 / 이사</SelectItem>
                              <SelectItem value="deceased">D005 - 사망</SelectItem>
                              <SelectItem value="other_service">D006 - 타 기관 이용</SelectItem>
                              <SelectItem value="other">D999 - 기타</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="dropout-details">상세 설명 *</Label>
                          <Textarea
                            id="dropout-details"
                            value={dropoutDetails}
                            onChange={(e) => setDropoutDetails(e.target.value)}
                            placeholder="이탈 경위, 최종 연락 일자, 특이사항 등을 구체적으로 기록하세요"
                            rows={6}
                            className="mt-2"
                          />
                        </div>
                      </div>

                      {/* Right: Recontact Plan */}
                      <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-blue-600" />
                          재접촉 계획
                        </h3>

                        <div>
                          <Label htmlFor="recontact-date">재접촉 예정일</Label>
                          <Input
                            id="recontact-date"
                            type="date"
                            value={recontactDate}
                            onChange={(e) => setRecontactDate(e.target.value)}
                            className="mt-2"
                            min={new Date().toISOString().split('T')[0]}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {recontactDate && '📅 1일 전 자동 알림이 발송됩니다'}
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="recontact-plan">재접촉 전략 및 메모</Label>
                          <Textarea
                            id="recontact-plan"
                            value={recontactPlan}
                            onChange={(e) => setRecontactPlan(e.target.value)}
                            placeholder="예: 1개월 후 가족 통해 재접촉 시도, 새로운 프로그램 안내 예정"
                            rows={6}
                            className="mt-2"
                          />
                        </div>

                        <Alert className="border-blue-200 bg-blue-50">
                          <RefreshCw className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-sm text-blue-900">
                            재접촉 계획을 등록하면 지정된 날짜에 자동으로 알림이 발송되며,
                            담당자에게 케이스가 재할당됩니다.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>

                    <Separator className="my-6" />

                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => setActiveTab('consultation')} 
                        className="flex-1"
                      >
                        상담으로 돌아가기
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleDropoutConfirm}
                        disabled={!dropoutReason || !dropoutDetails.trim()}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        이탈 처리 확정
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab 4: History */}
            <TabsContent value="history" className="h-full m-0 p-6">
              <div className="max-w-[1200px] mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      상담 이력 타임라인
                    </CardTitle>
                    <CardDescription>
                      과거 상담 내역을 한눈에 확인할 수 있습니다
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {consultationHistory.map((history, idx) => (
                        <div key={history.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-600 flex items-center justify-center">
                              <MessageSquare className="h-4 w-4 text-blue-600" />
                            </div>
                            {idx < consultationHistory.length - 1 && (
                              <div className="w-0.5 h-full bg-gray-300 mt-2"></div>
                            )}
                          </div>
                          <div className="flex-1 pb-6">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-900">
                                  상담 #{consultationHistory.length - idx}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {history.date} {history.time} · {history.counselor} · {history.duration}분
                                </p>
                              </div>
                              <Badge 
                                variant={
                                  history.result === 'completed' ? 'default' :
                                  history.result === 'postponed' ? 'secondary' : 'destructive'
                                }
                              >
                                {history.result === 'completed' ? '완료' :
                                 history.result === 'postponed' ? '보류' : '거부'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{history.summary}</p>
                            {history.actions.length > 0 && (
                              <div className="space-y-1">
                                {history.actions.map((action, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                    {action}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
