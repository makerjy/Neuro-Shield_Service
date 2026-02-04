import React, { useState } from 'react';
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

type RiskLevel = 'high' | 'medium' | 'low';

interface CaseDetailData {
  id: string;
  age: number;
  gender: string;
  registeredDate: string;
  riskLevel: RiskLevel;
  riskScore: number;
  riskPercentile: number;
  status: string;
  counselor: string;
  lastContact?: string;
  
  // AI Analysis
  aiAnalysis: {
    riskLevel: RiskLevel;
    riskScore: number;
    riskPercentile: number;
    riskRanking: string;
    lastUpdated: string;
    recentChange: string;
    urgency: 'immediate' | 'within_3_days' | 'routine';
    keyFactors: {
      name: string;
      impact: number;
      description: string;
    }[];
    operationalGuidelines: string[];
    analysisInfo: {
      aiModel: string;
      responsible: string;
      dataSource: string;
      updateDate: string;
      deidentified: boolean;
    };
  };
  
  // PII (Protected)
  pii: {
    fullName: string;
    fullAddress: string;
    detailedPhone: string;
    emergencyContact: string;
    emergencyContactName: string;
    residentNumber: string;
    medicalHistory: string[];
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

  // Mock data
  const caseData: CaseDetailData = {
    id: caseId,
    age: 72,
    gender: '남성',
    registeredDate: '2026-01-15',
    riskLevel: 'high',
    riskScore: 78,
    riskPercentile: 92,
    status: 'contacted',
    counselor: '이상담',
    lastContact: '2026-02-01',
    
    aiAnalysis: {
      riskLevel: 'high',
      riskScore: 78,
      riskPercentile: 92,
      riskRanking: '전체 케이스 중 상위 8%',
      lastUpdated: '2026-02-01',
      recentChange: '2주 전 대비 +5점 상승',
      urgency: 'immediate',
      keyFactors: [
        {
          name: '최근 기억력 검사 점수',
          impact: 85,
          description: '18/30 (2개월 전 대비 -4점 하락)',
        },
        {
          name: '고위험 연령대',
          impact: 72,
          description: '72세, 치매 고위험군',
        },
        {
          name: '사회적 고립도',
          impact: 68,
          description: '단독가구, 최근 3개월 사회활동 없음',
        },
        {
          name: '건강검진 미실시',
          impact: 55,
          description: '최근 12개월 건강검진 기록 없음',
        },
        {
          name: '생활습관 리스크',
          impact: 48,
          description: '운동부족, 식사 불규칙',
        },
      ],
      operationalGuidelines: [
        '최근 2회 전화 미응답 지속. 우선 SMS로 예약 권고 발송 후, 3일 내 재연락 시도 필요.',
        '단독가구이며 인지기능 저하 징후 확인됨. 즉시 초기 선별검사 예약 진행 권장.',
        '이상 징후 재발생 시 관할 보건소 및 응급연락망 가동 고려 필요.',
      ],
      analysisInfo: {
        aiModel: '치매특화판정모듈 v3.2',
        responsible: '김행정 (중앙관리자)',
        dataSource: '건강보험공단 검진데이터, 지역센터 상담이력',
        updateDate: '2026-02-01 14:30',
        deidentified: true,
      },
    },
    
    pii: {
      fullName: '김민수',
      fullAddress: '서울시 강남구 테헤란로 123, 아파트 101동 1001호',
      detailedPhone: '010-1234-5678',
      emergencyContact: '010-9876-5432',
      emergencyContactName: '김영희 (배우자)',
      residentNumber: '540215-1******',
      medicalHistory: ['고혈압', '당뇨병', '고지혈증'],
    },
  };

  // Consultation Scripts (AI Generated)
  const consultationScripts: Record<ConsultationStep, ConsultationScript> = {
    greeting: {
      step: 'greeting',
      title: '1단계: 인사 및 신원 확인',
      aiSuggestion: `안녕하세요, 저는 강남구 치매안심센터의 ${caseData.counselor} 상담사입니다. 지금 통화 가능하신가요? 본인 확인을 위해 성함과 생년월일을 여쭤봐도 될까요?`,
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
      caseId: caseData.id,
      userId: 'USER-001',
      userName: caseData.counselor,
      reason: accessReason,
      timestamp: new Date().toISOString(),
    });
    
    setPiiData(caseData.pii);
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
      caseId: caseData.id,
      userId: 'USER-001',
      userName: caseData.counselor,
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
      caseId: caseData.id,
      userId: 'USER-001',
      userName: caseData.counselor,
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
      caseId: caseData.id,
      userId: 'USER-001',
      userName: caseData.counselor,
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
      caseId: caseData.id,
      userId: 'USER-001',
      userName: caseData.counselor,
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

  const riskBadge = getRiskBadge(caseData.riskLevel);
  const currentScriptData = consultationScripts[currentStep];
  const steps: ConsultationStep[] = ['greeting', 'purpose', 'assessment', 'scheduling'];
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b-2 border-gray-300 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" onClick={onBack} className="text-gray-600">
              ← 뒤로
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* 케이스 ID */}
              <div>
                <div className="text-xs text-gray-500 mb-1">케이스 ID</div>
                <div className="text-lg font-bold text-gray-900">{caseData.id}</div>
              </div>
              
              {/* 구분선 */}
              <div className="h-12 w-px bg-gray-300"></div>
              
              {/* 위험도 */}
              <div>
                <div className="text-xs text-gray-500 mb-1">위험도</div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${riskBadge.textColor}`}>{riskBadge.label}</span>
                  <span className={`text-2xl font-bold ${riskBadge.textColor}`}>{caseData.riskScore}</span>
                </div>
              </div>
              
              {/* 구분선 */}
              <div className="h-12 w-px bg-gray-300"></div>
              
              {/* 현재 상태 */}
              <div>
                <div className="text-xs text-gray-500 mb-1">현재 케이스 상태</div>
                <div className="text-lg font-medium text-gray-900">
                  {caseData.status === 'contacted' ? '접촉완료' : 
                   caseData.status === 'consultation_complete' ? '상담완료' : 
                   caseData.status === 'not_contacted' ? '미접촉' : '이탈'}
                </div>
              </div>
              
              {/* 구분선 */}
              <div className="h-12 w-px bg-gray-300"></div>
              
              {/* 최근 접촉일 */}
              <div>
                <div className="text-xs text-gray-500 mb-1">최근 접촉일</div>
                <div className="text-lg font-medium text-gray-900">{caseData.lastContact || '-'}</div>
              </div>
              
              {/* 구분선 */}
              <div className="h-12 w-px bg-gray-300"></div>
              
              {/* 담당자 */}
              <div>
                <div className="text-xs text-gray-500 mb-1">담당자</div>
                <div className="text-lg font-medium text-gray-900">{caseData.counselor}</div>
              </div>
            </div>
            
            {/* 우측 버튼 */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setPiiDialogOpen(true)}
                className="text-gray-700"
              >
                개인정보 보기
              </Button>
              <Button onClick={handleStartConsultation} className="bg-blue-600 hover:bg-blue-700">
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
                  {caseData.riskScore}점
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-600 mb-1">위험 순위</div>
                <div className="text-xl font-bold text-gray-900">
                  상위 {100 - caseData.riskPercentile}%
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {caseData.aiAnalysis.riskRanking}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-600 mb-1">최근 위험도 변화</div>
                <div className="text-base font-semibold text-gray-900">
                  {caseData.aiAnalysis.recentChange}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  AI 산출일: {caseData.aiAnalysis.lastUpdated}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-600 mb-1">권장 대응 시급도</div>
                <div className={`text-2xl font-bold ${
                  caseData.aiAnalysis.urgency === 'immediate' ? 'text-red-600' :
                  caseData.aiAnalysis.urgency === 'within_3_days' ? 'text-orange-600' :
                  'text-green-600'
                }`}>
                  {getUrgencyText(caseData.aiAnalysis.urgency)}
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
                {caseData.aiAnalysis.keyFactors.map((factor, index) => (
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
            {caseData.aiAnalysis.operationalGuidelines.map((guideline, index) => (
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
                <span className="font-semibold">• AI 분석 모델:</span> {caseData.aiAnalysis.analysisInfo.aiModel}
              </p>
              <p>
                <span className="font-semibold">• 분석 책임자:</span> {caseData.aiAnalysis.analysisInfo.responsible}
              </p>
              <p>
                <span className="font-semibold">• 데이터 출처:</span> {caseData.aiAnalysis.analysisInfo.dataSource}
              </p>
              <p>
                <span className="font-semibold">• 데이터 갱신일:</span> {caseData.aiAnalysis.analysisInfo.updateDate}
              </p>
              <p>
                <span className="font-semibold">• 비식별 처리:</span>{' '}
                {caseData.aiAnalysis.analysisInfo.deidentified ? (
                  <span className="text-green-700 font-semibold">완료 ✓</span>
                ) : (
                  <span className="text-red-700 font-semibold">미완료 ✗</span>
                )}
              </p>
              
              <div className="mt-4 pt-4 border-t border-gray-400">
                <p className="text-xs text-gray-700 leading-relaxed">
                  ※ 이 분석 결과는 공공 AI 기관이 {caseData.aiAnalysis.analysisInfo.dataSource} 기준으로 분석하였으며, 
                  담당자 {caseData.aiAnalysis.analysisInfo.responsible} 책임하에 제공합니다. 
                  모든 데이터는 개인정보보호법에 따라 비식별 처리되었습니다.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

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
                <p>• 접근자: {caseData.counselor} (USER-001)</p>
                <p>• 케이스 ID: {caseData.id}</p>
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
