import React, { useState } from 'react';
import {
  Phone,
  MessageSquare,
  Save,
  Clock,
  CheckCircle,
  XCircle,
  Lightbulb,
  Bot,
  AlertCircle,
  FileText,
  Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner@2.0.3';

interface ConsultationSessionProps {
  caseId: string;
  patientName: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function ConsultationSession({
  caseId,
  patientName,
  onComplete,
  onCancel,
}: ConsultationSessionProps) {
  const [startTime] = useState(new Date());
  const [consultationResult, setConsultationResult] = useState<string>('');
  const [deferReason, setDeferReason] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [consultationNotes, setConsultationNotes] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);

  // AI-generated consultation script
  const consultationScript = {
    caseId: caseId,
    patientName: patientName,
    riskLevel: 'high',
    steps: [
      {
        title: '1. 인사 및 신원 확인',
        content: `안녕하세요? 저는 [센터명] 치매안심센터의 ${patientName.split('')[0]}상담사입니다.\n\n혹시 ${patientName}님 맞으신가요?\n\n(신원 확인 후) ${patientName}님, 통화 가능하신 시간이신가요?`,
        tips: [
          '부드럽고 친절한 어조로 시작',
          '상대방의 답변을 충분히 기다리기',
          '통화가 어려운 경우 적절한 시간 문의',
        ],
      },
      {
        title: '2. 연락 목적 설명',
        content: `${patientName}님, 저희 센터에서는 지역 주민들의 치매 예방과 조기 발견을 위해\n무료 인지기능 선별검사를 제공하고 있습니다.\n\n최근 국가건강검진 결과와 생활습관 설문조사를 토대로\n${patientName}님께서 검사 대상자로 선정되셨습니다.`,
        tips: [
          '목적을 명확하고 간단하게 설명',
          '"치매"라는 단어 사용 시 주의',
          '무료 서비스임을 강조',
        ],
      },
      {
        title: '3. 현재 상황 파악',
        content: `${patientName}님, 최근 일상생활에서 불편하신 점은 없으신가요?\n\n예를 들어:\n- 깜빡하는 일이 예전보다 잦아지셨나요?\n- 약속이나 중요한 일을 잊으신 적이 있나요?\n- 물건을 어디 두었는지 찾기 어려우신가요?`,
        tips: [
          '열린 질문으로 시작',
          '구체적인 예시 제공',
          '대답을 강요하지 않기',
          '답변 내용을 메모에 기록',
        ],
      },
      {
        title: '4. 센터 방문 안내 및 예약',
        content: `${patientName}님, 저희 센터에서 간단한 선별검사를 받아보시면 좋을 것 같습니다.\n\n검사는 약 30분 정도 소요되며, 완전히 무료입니다.\n센터 위치는 [주소]이며, 주차도 가능합니다.\n\n언제 방문하시기 편하신가요?`,
        tips: [
          '검사의 간단함과 무료임을 재강조',
          '교통편과 주차 정보 제공',
          '여러 시간대 옵션 제시',
          '거부 시 압박하지 않기',
        ],
      },
    ],
    alternativeResponses: {
      refusal: `이해합니다. 지금 당장은 어려우시군요.\n\n${patientName}님께서 편하실 때 언제든지 연락 주시면\n도움을 드리도록 하겠습니다.\n\n저희 센터 연락처는 [전화번호]입니다.\n건강하시기를 바랍니다.`,
      deferral: `네, 알겠습니다.\n\n그럼 ${patientName}님께서 말씀하신 [날짜/시간]에\n다시 연락드리도록 하겠습니다.\n\n그때 뵙도록 하겠습니다. 감사합니다.`,
    },
  };

  const handleConsultationComplete = () => {
    if (!consultationResult) {
      toast.error('상담 결과를 선택해주세요');
      return;
    }

    if ((consultationResult === 'deferred' || consultationResult === 'rejected') && 
        (!deferReason && !rejectReason)) {
      toast.error('사유를 입력해주세요');
      return;
    }

    if (!consultationNotes.trim()) {
      toast.error('상담 메모를 입력해주세요');
      return;
    }

    const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 60000);

    // In a real app, this would save to the backend
    console.log('Consultation completed:', {
      caseId,
      startTime,
      endTime: new Date(),
      duration,
      result: consultationResult,
      deferReason,
      rejectReason,
      notes: consultationNotes,
    });

    toast.success('상담 기록이 저장되었습니다');
    onComplete();
  };

  const handleTempSave = () => {
    toast.success('임시 저장되었습니다');
  };

  const getElapsedTime = () => {
    const elapsed = Math.floor((new Date().getTime() - startTime.getTime()) / 60000);
    return `${elapsed}분`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">상담 진행</h1>
          <p className="text-gray-500 mt-1">
            케이스: {caseId} | 대상자: {patientName}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>경과 시간: {getElapsedTime()}</span>
          </div>
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - AI Script */}
        <div className="space-y-6">
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-900">
                <Bot className="h-5 w-5" />
                AI 추천 상담 스크립트
              </CardTitle>
              <CardDescription className="text-purple-700">
                현재 케이스의 상태를 분석하여 적절한 스크립트를 추천합니다
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Script Steps */}
          <Card>
            <CardContent className="p-6">
              <Tabs value={currentStep.toString()} onValueChange={(v) => setCurrentStep(parseInt(v))}>
                <TabsList className="grid w-full grid-cols-4">
                  {consultationScript.steps.map((_, index) => (
                    <TabsTrigger key={index} value={index.toString()} className="text-xs">
                      {index + 1}단계
                    </TabsTrigger>
                  ))}
                </TabsList>

                {consultationScript.steps.map((step, index) => (
                  <TabsContent key={index} value={index.toString()} className="mt-6 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{step.title}</h3>
                      <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                        {step.content}
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="h-4 w-4 text-blue-600" />
                        <h4 className="font-semibold text-blue-900 text-sm">상담 팁</h4>
                      </div>
                      <ul className="space-y-1">
                        {step.tips.map((tip, tipIndex) => (
                          <li key={tipIndex} className="text-sm text-blue-800 flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-2">
                      {index > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => setCurrentStep(index - 1)}
                          className="flex-1"
                        >
                          이전 단계
                        </Button>
                      )}
                      {index < consultationScript.steps.length - 1 && (
                        <Button
                          onClick={() => setCurrentStep(index + 1)}
                          className="flex-1"
                        >
                          다음 단계
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Alternative Responses */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-yellow-900 text-base">대안 응답 스크립트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-yellow-900 text-sm mb-2">거절 시</h4>
                <p className="text-sm text-yellow-800 bg-white p-3 rounded border border-yellow-200 whitespace-pre-wrap">
                  {consultationScript.alternativeResponses.refusal}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-yellow-900 text-sm mb-2">보류 요청 시</h4>
                <p className="text-sm text-yellow-800 bg-white p-3 rounded border border-yellow-200 whitespace-pre-wrap">
                  {consultationScript.alternativeResponses.deferral}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Recording */}
        <div className="space-y-6">
          {/* Consultation Result */}
          <Card>
            <CardHeader>
              <CardTitle>상담 기록</CardTitle>
              <CardDescription>상담 내용을 기록합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Start Time */}
              <div>
                <Label>상담 시작 시간</Label>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium">
                    {startTime.toLocaleString('ko-KR')}
                  </span>
                </div>
              </div>

              {/* Consultation Result */}
              <div>
                <Label htmlFor="result">상담 결과 *</Label>
                <Select value={consultationResult} onValueChange={setConsultationResult}>
                  <SelectTrigger id="result" className="mt-2">
                    <SelectValue placeholder="결과 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment_scheduled">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>예약 완료</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="deferred">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-600" />
                        <span>보류 (나중에 연락)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="rejected">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>거부</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="wrong_number">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-600" />
                        <span>잘못된 번호</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="no_answer">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-600" />
                        <span>응답 없음</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Defer Reason */}
              {consultationResult === 'deferred' && (
                <div>
                  <Label htmlFor="defer-reason">보류 사유 코드 *</Label>
                  <Select value={deferReason} onValueChange={setDeferReason}>
                    <SelectTrigger id="defer-reason" className="mt-2">
                      <SelectValue placeholder="사유 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="busy">바쁨 (다른 일정)</SelectItem>
                      <SelectItem value="health">건강 상태 (현재 컨디션 불량)</SelectItem>
                      <SelectItem value="travel">여행 중</SelectItem>
                      <SelectItem value="family">가족과 상의 필요</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Reject Reason */}
              {consultationResult === 'rejected' && (
                <div>
                  <Label htmlFor="reject-reason">거부 사유 코드 *</Label>
                  <Select value={rejectReason} onValueChange={setRejectReason}>
                    <SelectTrigger id="reject-reason" className="mt-2">
                      <SelectValue placeholder="사유 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_interested">관심 없음</SelectItem>
                      <SelectItem value="already_treated">이미 다른 곳에서 관리 중</SelectItem>
                      <SelectItem value="privacy_concern">개인정보 우려</SelectItem>
                      <SelectItem value="physical_difficulty">신체적 어려움 (이동 불가)</SelectItem>
                      <SelectItem value="family_opposition">가족 반대</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Consultation Notes */}
              <div>
                <Label htmlFor="notes">상담 메모 *</Label>
                <Textarea
                  id="notes"
                  value={consultationNotes}
                  onChange={(e) => setConsultationNotes(e.target.value)}
                  placeholder="상담 내용, 대상자 반응, 특이사항 등을 기록하세요"
                  rows={10}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-2">
                  * 구체적이고 객관적으로 작성해주세요
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleTempSave}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  임시 저장
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConsultationComplete}
                  disabled={!consultationResult || !consultationNotes.trim()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  상담 완료
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-900 text-base">빠른 작업</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Phone className="h-4 w-4 mr-2" />
                전화 걸기
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Send className="h-4 w-4 mr-2" />
                SMS 전송
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                가족에게 연락
              </Button>
            </CardContent>
          </Card>

          {/* Compliance Notice */}
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              상담 중 의료 진단이나 처방을 하지 마세요. 전문 의료 서비스가 필요한 경우
              적절한 의료기관을 안내해 주세요.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
