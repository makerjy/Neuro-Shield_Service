import React, { useState } from 'react';
import {
  UserX,
  Calendar,
  Clock,
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle,
  RotateCcw,
  FileText,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { toast } from 'sonner@2.0.3';

interface ChurnManagementProps {
  caseId: string;
  patientName: string;
  patientPhone: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function ChurnManagement({
  caseId,
  patientName,
  patientPhone,
  onComplete,
  onCancel,
}: ChurnManagementProps) {
  const [action, setAction] = useState<'churn' | 'recontact' | null>(null);
  
  // Churn fields
  const [churnReason, setChurnReason] = useState<string>('');
  const [churnDetails, setChurnDetails] = useState<string>('');
  const [confirmChurnDialog, setConfirmChurnDialog] = useState(false);
  
  // Recontact fields
  const [recontactDate, setRecontactDate] = useState<string>('');
  const [recontactTime, setRecontactTime] = useState<string>('');
  const [recontactMethod, setRecontactMethod] = useState<string>('');
  const [recontactNotes, setRecontactNotes] = useState<string>('');
  const [recontactPriority, setRecontactPriority] = useState<string>('normal');

  const churnReasons = [
    { value: 'deceased', label: '사망', critical: true },
    { value: 'moved', label: '이사 (타 지역 이동)', critical: false },
    { value: 'refuse_service', label: '서비스 거부', critical: false },
    { value: 'already_treated', label: '타 기관에서 관리 중', critical: false },
    { value: 'health_deterioration', label: '건강 악화 (입원/요양)', critical: true },
    { value: 'family_opposition', label: '가족 반대', critical: false },
    { value: 'unreachable', label: '연락 두절', critical: false },
    { value: 'wrong_target', label: '대상자 아님 (오등록)', critical: false },
    { value: 'other', label: '기타', critical: false },
  ];

  const recontactMethods = [
    { value: 'phone', label: '전화', icon: Phone },
    { value: 'sms', label: 'SMS', icon: MessageSquare },
    { value: 'email', label: '이메일', icon: Mail },
    { value: 'visit', label: '방문', icon: UserX },
  ];

  const handleChurnSubmit = () => {
    if (!churnReason) {
      toast.error('이탈 사유를 선택해주세요');
      return;
    }

    if (!churnDetails.trim()) {
      toast.error('상세 설명을 입력해주세요');
      return;
    }

    setConfirmChurnDialog(true);
  };

  const handleConfirmChurn = () => {
    // In a real application, this would save to backend
    console.log('Processing churn:', {
      caseId,
      reason: churnReason,
      details: churnDetails,
      timestamp: new Date().toISOString(),
    });

    toast.success('이탈 처리가 완료되었습니다');
    setConfirmChurnDialog(false);
    onComplete();
  };

  const handleRecontactSubmit = () => {
    if (!recontactDate || !recontactTime || !recontactMethod) {
      toast.error('모든 필수 항목을 입력해주세요');
      return;
    }

    // In a real application, this would save to backend
    console.log('Creating recontact plan:', {
      caseId,
      date: recontactDate,
      time: recontactTime,
      method: recontactMethod,
      notes: recontactNotes,
      priority: recontactPriority,
    });

    toast.success('재접촉 계획이 수립되었습니다');
    onComplete();
  };

  const getReasonBadge = (reasonValue: string) => {
    const reason = churnReasons.find((r) => r.value === reasonValue);
    return reason?.critical ? (
      <Badge variant="destructive">긴급</Badge>
    ) : (
      <Badge variant="secondary">일반</Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">이탈 & 재접촉 관리</h1>
          <p className="text-gray-500 mt-1">
            케이스: {caseId} | 대상자: {patientName}
          </p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>

      {/* Action Selection */}
      <Card>
        <CardHeader>
          <CardTitle>작업 선택</CardTitle>
          <CardDescription>
            이탈 처리 또는 재접촉 계획을 선택하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setAction('churn')}
              className={`p-6 border-2 rounded-lg transition-all ${
                action === 'churn'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <UserX className={`h-8 w-8 mx-auto mb-3 ${
                action === 'churn' ? 'text-red-600' : 'text-gray-400'
              }`} />
              <h3 className="font-semibold text-gray-900 mb-1">이탈 처리</h3>
              <p className="text-sm text-gray-500">
                케이스를 종료하고 이탈 사유를 기록합니다
              </p>
            </button>

            <button
              onClick={() => setAction('recontact')}
              className={`p-6 border-2 rounded-lg transition-all ${
                action === 'recontact'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <RotateCcw className={`h-8 w-8 mx-auto mb-3 ${
                action === 'recontact' ? 'text-blue-600' : 'text-gray-400'
              }`} />
              <h3 className="font-semibold text-gray-900 mb-1">재접촉 계획</h3>
              <p className="text-sm text-gray-500">
                다음 연락 일정과 방법을 계획합니다
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Churn Processing */}
      {action === 'churn' && (
        <div className="space-y-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <AlertDescription className="text-red-900">
              <strong>주의:</strong> 이탈 처리 시 케이스가 종료되며, 모든 기록은 보존됩니다.
              이 작업은 상급기관에 보고되며 감사로그에 기록됩니다.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>이탈 사유 선택</CardTitle>
              <CardDescription>해당하는 이탈 사유를 선택하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={churnReason} onValueChange={setChurnReason}>
                {churnReasons.map((reason) => (
                  <div
                    key={reason.value}
                    className={`flex items-center space-x-3 p-4 border-2 rounded-lg ${
                      churnReason === reason.value
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <RadioGroupItem value={reason.value} id={reason.value} />
                    <Label
                      htmlFor={reason.value}
                      className="flex-1 flex items-center justify-between cursor-pointer"
                    >
                      <span>{reason.label}</span>
                      {reason.critical && <Badge variant="destructive">긴급 보고 필요</Badge>}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>상세 설명</CardTitle>
              <CardDescription>이탈 상황을 구체적으로 기록하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={churnDetails}
                onChange={(e) => setChurnDetails(e.target.value)}
                placeholder="이탈 경위, 최종 접촉 내용, 향후 조치 가능성 등을 상세히 기록하세요"
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-2">
                * 이 정보는 상급기관에 보고되며 향후 정책 개선에 활용됩니다
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAction(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleChurnSubmit}
              disabled={!churnReason || !churnDetails.trim()}
            >
              <UserX className="h-4 w-4 mr-2" />
              이탈 처리 확정
            </Button>
          </div>
        </div>
      )}

      {/* Recontact Planning */}
      {action === 'recontact' && (
        <div className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            <AlertDescription className="text-blue-900">
              재접촉 계획을 수립하면 지정된 날짜에 알림이 전송되며, 오늘 할 일 목록에 표시됩니다.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>재접촉 일정</CardTitle>
              <CardDescription>다음 연락 날짜와 시간을 지정하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recontact-date">재접촉 날짜 *</Label>
                  <Input
                    id="recontact-date"
                    type="date"
                    value={recontactDate}
                    onChange={(e) => setRecontactDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="recontact-time">재접촉 시간 *</Label>
                  <Input
                    id="recontact-time"
                    type="time"
                    value={recontactTime}
                    onChange={(e) => setRecontactTime(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label>우선순위</Label>
                <RadioGroup
                  value={recontactPriority}
                  onValueChange={setRecontactPriority}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="urgent" id="urgent" />
                    <Label htmlFor="urgent" className="cursor-pointer">
                      <Badge variant="destructive">긴급</Badge>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="high" />
                    <Label htmlFor="high" className="cursor-pointer">
                      <Badge variant="secondary">높음</Badge>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="normal" id="normal" />
                    <Label htmlFor="normal" className="cursor-pointer">
                      <Badge variant="outline">보통</Badge>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>재접촉 방법</CardTitle>
              <CardDescription>선호하는 연락 방법을 선택하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {recontactMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.value}
                      onClick={() => setRecontactMethod(method.value)}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        recontactMethod === method.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon
                        className={`h-6 w-6 mx-auto mb-2 ${
                          recontactMethod === method.value ? 'text-blue-600' : 'text-gray-400'
                        }`}
                      />
                      <p className="text-sm font-medium">{method.label}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>재접촉 메모</CardTitle>
              <CardDescription>연락 시 참고할 사항을 기록하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={recontactNotes}
                onChange={(e) => setRecontactNotes(e.target.value)}
                placeholder="예: 오전 시간대 선호, 가족과 함께 통화 필요, 특정 주제 논의 등"
                rows={4}
              />
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 mb-1">자동 알림</p>
                  <p className="text-sm text-green-700">
                    재접촉 예정일에 담당자에게 알림이 전송되며,
                    오늘 할 일 목록에 자동으로 추가됩니다
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAction(null)}>
              취소
            </Button>
            <Button
              className="flex-1"
              onClick={handleRecontactSubmit}
              disabled={!recontactDate || !recontactTime || !recontactMethod}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              재접촉 계획 수립
            </Button>
          </div>
        </div>
      )}

      {/* Churn Confirmation Dialog */}
      <Dialog open={confirmChurnDialog} onOpenChange={setConfirmChurnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              이탈 처리 확인
            </DialogTitle>
            <DialogDescription>
              이 케이스를 이탈 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">케이스 ID:</span>
                <span className="text-sm font-medium">{caseId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">대상자:</span>
                <span className="text-sm font-medium">{patientName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">이탈 사유:</span>
                <div>
                  {churnReason && getReasonBadge(churnReason)}
                  <span className="text-sm font-medium ml-2">
                    {churnReasons.find((r) => r.value === churnReason)?.label}
                  </span>
                </div>
              </div>
            </div>

            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm text-red-900">
                이탈 처리 시:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>케이스가 즉시 종료됩니다</li>
                  <li>모든 기록은 보존되어 조회 가능합니다</li>
                  <li>상급기관에 자동으로 보고됩니다</li>
                  <li>감사로그에 영구 기록됩니다</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmChurnDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleConfirmChurn}>
              <UserX className="h-4 w-4 mr-2" />
              이탈 처리 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
