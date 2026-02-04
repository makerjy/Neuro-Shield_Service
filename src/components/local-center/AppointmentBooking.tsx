import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Send,
  CheckCircle,
  AlertCircle,
  Building2,
  Stethoscope,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
import { toast } from 'sonner@2.0.3';

interface AppointmentBookingProps {
  caseId: string;
  patientName: string;
  patientPhone: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function AppointmentBooking({
  caseId,
  patientName,
  patientPhone,
  onComplete,
  onCancel,
}: AppointmentBookingProps) {
  const [appointmentType, setAppointmentType] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [preVisitNotes, setPreVisitNotes] = useState<string>('');
  const [referralType, setReferralType] = useState<string>('');
  const [referralInstitution, setReferralInstitution] = useState<string>('');
  const [referralNotes, setReferralNotes] = useState<string>('');
  const [smsPreview, setSmsPreview] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState(false);

  // Available time slots
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00'
  ];

  // Center information
  const centerInfo = {
    name: '서울시 강남구 치매안심센터',
    address: '서울시 강남구 테헤란로 123',
    phone: '02-1234-5678',
  };

  // Generate SMS preview
  const generateSmsPreview = () => {
    if (!appointmentType || !selectedDate || !selectedTime) return '';

    const dateObj = new Date(selectedDate);
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
    const formattedDate = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayOfWeek})`;
    
    const timeDisplay = selectedTime.split(':')[0] >= '12' 
      ? `오후 ${selectedTime}` 
      : `오전 ${selectedTime}`;

    let appointmentTypeName = '';
    switch(appointmentType) {
      case 'screening':
        appointmentTypeName = '인지기능 선별검사';
        break;
      case 'recheck':
        appointmentTypeName = '재검사';
        break;
      case 'consultation':
        appointmentTypeName = '상담';
        break;
      case 'followup':
        appointmentTypeName = '후속 관리';
        break;
    }

    return `[${centerInfo.name}] ${patientName}님, ${formattedDate} ${timeDisplay}에 ${appointmentTypeName} 예약이 확정되었습니다. 주소: ${centerInfo.address} / 문의: ${centerInfo.phone}${preVisitNotes ? `\n\n방문 전 안내: ${preVisitNotes}` : ''}`;
  };

  React.useEffect(() => {
    setSmsPreview(generateSmsPreview());
  }, [appointmentType, selectedDate, selectedTime, preVisitNotes]);

  const handleConfirmBooking = () => {
    if (!appointmentType || !selectedDate || !selectedTime) {
      toast.error('모든 필수 항목을 입력해주세요');
      return;
    }

    setConfirmDialog(true);
  };

  const handleSendSms = () => {
    // In a real application, this would send SMS via API
    console.log('Sending SMS:', {
      to: patientPhone,
      message: smsPreview,
    });

    toast.success('SMS가 전송되었습니다');
    setConfirmDialog(false);
    
    // Save appointment
    console.log('Saving appointment:', {
      caseId,
      type: appointmentType,
      date: selectedDate,
      time: selectedTime,
      notes: preVisitNotes,
    });

    onComplete();
  };

  const handleReferral = () => {
    if (!referralType || !referralInstitution) {
      toast.error('의뢰 유형과 기관을 선택해주세요');
      return;
    }

    // In a real application, this would save referral
    console.log('Creating referral:', {
      caseId,
      type: referralType,
      institution: referralInstitution,
      notes: referralNotes,
    });

    toast.success('의뢰가 접수되었습니다');
    onComplete();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">연계 및 예약</h1>
          <p className="text-gray-500 mt-1">
            케이스: {caseId} | 대상자: {patientName}
          </p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Center Appointment */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                센터 선별검사 예약
              </CardTitle>
              <CardDescription>
                치매안심센터에서 진행하는 선별검사 예약을 생성합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Appointment Type */}
              <div>
                <Label htmlFor="appointment-type">예약 유형 *</Label>
                <Select value={appointmentType} onValueChange={setAppointmentType}>
                  <SelectTrigger id="appointment-type" className="mt-2">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="screening">인지기능 선별검사</SelectItem>
                    <SelectItem value="recheck">재검사</SelectItem>
                    <SelectItem value="consultation">상담</SelectItem>
                    <SelectItem value="followup">후속 관리</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Selection */}
              <div>
                <Label htmlFor="date">예약 날짜 *</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-2"
                />
              </div>

              {/* Time Selection */}
              <div>
                <Label htmlFor="time">예약 시간 *</Label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger id="time" className="mt-2">
                    <SelectValue placeholder="시간 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pre-visit Notes */}
              <div>
                <Label htmlFor="pre-visit">방문 전 안내사항 (선택)</Label>
                <Textarea
                  id="pre-visit"
                  value={preVisitNotes}
                  onChange={(e) => setPreVisitNotes(e.target.value)}
                  placeholder="예: 신분증 지참, 공복 불필요, 편한 복장"
                  rows={3}
                  className="mt-2"
                />
              </div>

              {/* Center Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  센터 정보
                </h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <p><strong>센터명:</strong> {centerInfo.name}</p>
                  <p><strong>주소:</strong> {centerInfo.address}</p>
                  <p><strong>연락처:</strong> {centerInfo.phone}</p>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleConfirmBooking}
                disabled={!appointmentType || !selectedDate || !selectedTime}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                예약 확정 및 SMS 전송
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Referral & SMS Preview */}
        <div className="space-y-6">
          {/* SMS Preview */}
          {smsPreview && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-900 flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  SMS 미리보기
                </CardTitle>
                <CardDescription className="text-green-700">
                  예약 확정 시 자동으로 전송됩니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white border border-green-300 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-green-200">
                    <Phone className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">
                      수신: {patientName} ({patientPhone})
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {smsPreview}
                  </p>
                  <div className="mt-3 pt-3 border-t border-green-200 text-xs text-green-700">
                    예상 길이: {smsPreview.length}자
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Medical Referral */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                의료기관 의뢰
              </CardTitle>
              <CardDescription>
                전문 의료기관으로 의뢰가 필요한 경우 사용합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Referral Type */}
              <div>
                <Label htmlFor="referral-type">의뢰 유형</Label>
                <Select value={referralType} onValueChange={setReferralType}>
                  <SelectTrigger id="referral-type" className="mt-2">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="health_center">보건소</SelectItem>
                    <SelectItem value="hospital">병원 (신경과)</SelectItem>
                    <SelectItem value="psychiatric">정신건강의학과</SelectItem>
                    <SelectItem value="geriatric">노인전문병원</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Institution Selection */}
              <div>
                <Label htmlFor="institution">의뢰 기관</Label>
                <Select value={referralInstitution} onValueChange={setReferralInstitution}>
                  <SelectTrigger id="institution" className="mt-2">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gangnam_health">강남구 보건소</SelectItem>
                    <SelectItem value="seoul_hospital">서울대학교병원</SelectItem>
                    <SelectItem value="samsung_hospital">삼성서울병원</SelectItem>
                    <SelectItem value="asan_hospital">서울아산병원</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Referral Notes */}
              <div>
                <Label htmlFor="referral-notes">의뢰 소견</Label>
                <Textarea
                  id="referral-notes"
                  value={referralNotes}
                  onChange={(e) => setReferralNotes(e.target.value)}
                  placeholder="의뢰 사유, 현재 상태, 특이사항 등을 기록하세요"
                  rows={4}
                  className="mt-2"
                />
              </div>

              <Alert className="border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-900">
                  의료기관 의뢰는 본인 및 보호자의 동의가 필요합니다
                </AlertDescription>
              </Alert>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleReferral}
                disabled={!referralType || !referralInstitution}
              >
                <FileText className="h-4 w-4 mr-2" />
                의뢰서 작성
              </Button>
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900 text-base">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                안내사항
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>예약 확정 시 자동으로 SMS가 전송됩니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>예약 3일 전에 리마인더 SMS가 자동 전송됩니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>의뢰서는 담당자 승인 후 발송됩니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>모든 예약 및 의뢰 기록은 케이스 이력에 저장됩니다</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>예약 확정 및 SMS 전송</DialogTitle>
            <DialogDescription>
              다음 내용으로 예약을 확정하고 SMS를 전송하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">대상자:</span>
                <span className="text-sm font-medium">{patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">연락처:</span>
                <span className="text-sm font-medium">{patientPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">예약 일시:</span>
                <span className="text-sm font-medium">
                  {selectedDate && new Date(selectedDate).toLocaleDateString('ko-KR')} {selectedTime}
                </span>
              </div>
            </div>

            <div className="border border-green-300 bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2 font-medium">전송될 SMS:</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap bg-white p-3 rounded border border-green-200">
                {smsPreview}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(false)}>
              취소
            </Button>
            <Button onClick={handleSendSms}>
              <Send className="h-4 w-4 mr-2" />
              확정 및 전송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
