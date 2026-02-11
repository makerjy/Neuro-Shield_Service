import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  ChevronRight,
  ArrowLeft,
  Building2,
  X,
  Bot,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner@2.0.3';
import { ChatbotDialog } from './ChatbotDialog';

type PageMode = 'home' | 'booking' | 'consent' | 'center-select' | 'datetime' | 'confirm' | 'complete' | 'faq' | 'contact';

export function CitizenMobileApp() {
  const [mode, setMode] = useState<PageMode>('home');
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentOptional, setConsentOptional] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [showGuardianField, setShowGuardianField] = useState(false);
  const [stopContactDialog, setStopContactDialog] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);

  const centers = [
    { id: 'health', name: '강남구 보건소', address: '서울시 강남구 학동로 426' },
    { id: 'dementia', name: '강남구 치매안심센터', address: '서울시 강남구 봉은사로 524' },
    { id: 'hospital', name: '삼성서울병원 정신건강의학과', address: '서울시 강남구 일원로 81' },
  ];

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  ];

  const faqs = [
    {
      question: '왜 연락을 받았나요?',
      answer: '국가건강검진 결과 및 생활습관 설문조사를 바탕으로 치매 예방을 위한 무료 선별검사 대상자로 선정되셨습니다. 조기 발견과 예방을 위해 무료로 제공되는 서비스입니다.',
    },
    {
      question: '비용이 드나요?',
      answer: '아니요. 모든 선별검사와 상담 서비스는 정부 지원으로 완전히 무료입니다. 추가 비용이 전혀 발생하지 않습니다.',
    },
    {
      question: '어떤 서비스들을 이용할 수 있나요?',
      answer: '인지기능 선별검사, 전문 상담사와의 1:1 상담, 생활습관 개선 프로그램, 필요시 전문 의료기관 연계 등의 서비스를 받으실 수 있습니다.',
    },
    {
      question: '개인정보는 어떻게 관리되나요?',
      answer: '모든 개인정보는 개인정보보호법에 따라 엄격하게 관리되며, 동의하신 목적 외에는 절대 사용되지 않습니다. 원하시면 언제든 삭제를 요청하실 수 있습니다.',
    },
  ];

  const handleStartBooking = () => {
    setMode('consent');
  };

  const handleConsentNext = () => {
    if (!consentRequired) {
      toast.error('필수 동의 항목에 동의해주세요');
      return;
    }
    setMode('center-select');
  };

  const handleCenterSelect = (centerId: string) => {
    setSelectedCenter(centerId);
    setMode('datetime');
  };

  const handleDateTimeNext = () => {
    if (!selectedDate || !selectedTime) {
      toast.error('날짜와 시간을 선택해주세요');
      return;
    }
    setMode('confirm');
  };

  const phoneRegex = /^01[016789]-?\d{3,4}-?\d{4}$/;

  const handleConfirmBooking = () => {
    if (!name || !phone || !birthdate) {
      toast.error('모든 필수 정보를 입력해주세요');
      return;
    }
    if (!phoneRegex.test(phone.replace(/-/g, ''))) {
      toast.error('연락처 형식이 올바르지 않습니다');
      return;
    }
    // 보호자 연락처: 값이 있을 때만 형식 검증
    if (guardianPhone && !phoneRegex.test(guardianPhone.replace(/-/g, ''))) {
      toast.error('보호자 연락처 형식이 올바르지 않습니다');
      return;
    }

    // Log appointment
    console.log('New Appointment:', {
      center: selectedCenter,
      date: selectedDate,
      time: selectedTime,
      name,
      phone,
      birthdate,
      guardianPhone: guardianPhone || undefined,
      consentOptional,
      notes: additionalNotes,
      timestamp: new Date().toISOString(),
    });

    setMode('complete');
  };

  const handleRemindLater = () => {
    console.log('Remind Later Request:', {
      timestamp: new Date().toISOString(),
      remindDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
    toast.success('2주 후 다시 안내드리겠습니다');
  };

  const handleStopContact = () => {
    console.log('Stop Contact Request:', {
      timestamp: new Date().toISOString(),
    });
    toast.success('연락 중단 요청이 접수되었습니다');
    setStopContactDialog(false);
  };

  const renderHome = () => (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="border-2 border-primary bg-gradient-to-br from-blue-50 to-white">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-primary p-3 rounded">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                치매 예방 무료 검사 안내
              </h2>
              <p className="text-gray-700 mb-4">
                귀하께서는 무료 인지기능 선별검사 대상자로 선정되셨습니다.
                조기 발견과 예방을 위해 검사를 받아보세요.
              </p>
              <div className="flex gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">완전 무료</span>
              </div>
              <div className="flex gap-2 mt-1">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">약 30분 소요</span>
              </div>
              <div className="flex gap-2 mt-1">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">전문 상담 제공</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          className="w-full h-14 text-lg"
          onClick={handleStartBooking}
        >
          상담 예약하기
          <ChevronRight className="h-5 w-5 ml-2" />
        </Button>

        <Button
          variant="outline"
          className="w-full h-14 text-lg"
          onClick={handleRemindLater}
        >
          나중에 다시 안내 받기
          <Clock className="h-5 w-5 ml-2" />
        </Button>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode('faq')}
          className="p-4 border-2 border-gray-300 rounded hover:border-primary transition-colors"
        >
          <MessageSquare className="h-6 w-6 text-primary mx-auto mb-2" />
          <span className="text-sm font-medium text-gray-900">자주 묻는 질문</span>
        </button>

        <button
          onClick={() => setMode('contact')}
          className="p-4 border-2 border-gray-300 rounded hover:border-primary transition-colors"
        >
          <Phone className="h-6 w-6 text-primary mx-auto mb-2" />
          <span className="text-sm font-medium text-gray-900">문의 및 지원</span>
        </button>
      </div>
    </div>
  );

  const renderConsent = () => (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => setMode('home')} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        뒤로
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">동의 항목</h2>
        <p className="text-gray-600">서비스 제공을 위해 다음 항목에 동의해주세요</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-start gap-3 p-4 border-2 border-primary rounded">
            <Checkbox
              id="required"
              checked={consentRequired}
              onCheckedChange={(checked) => setConsentRequired(checked as boolean)}
            />
            <div className="flex-1">
              <Label htmlFor="required" className="cursor-pointer">
                <span className="font-bold text-primary">필수</span> 상담 및 연계 서비스 제공
              </Label>
              <p className="text-sm text-gray-600 mt-2">
                개인정보 수집 및 이용, 검사 결과 관리, 센터 연계에 동의합니다.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border-2 border-gray-300 rounded">
            <Checkbox
              id="optional"
              checked={consentOptional}
              onCheckedChange={(checked) => setConsentOptional(checked as boolean)}
            />
            <div className="flex-1">
              <Label htmlFor="optional" className="cursor-pointer">
                <span className="text-gray-600">선택</span> 정밀 검사 데이터 활용
              </Label>
              <p className="text-sm text-gray-600 mt-2">
                2차 검사 시 데이터 활용 및 연구 목적 익명화 데이터 활용에 동의합니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          동의 철회는 언제든 가능하며, 수집된 정보는 법률에 따라 안전하게 관리됩니다.
        </AlertDescription>
      </Alert>

      <Button className="w-full" onClick={handleConsentNext}>
        다음
      </Button>
    </div>
  );

  const renderCenterSelect = () => (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => setMode('consent')} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        뒤로
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">센터 선택</h2>
        <p className="text-gray-600">방문하실 센터를 선택해주세요</p>
      </div>

      <div className="space-y-3">
        {centers.map((center) => (
          <button
            key={center.id}
            onClick={() => handleCenterSelect(center.id)}
            className="w-full p-4 border-2 border-gray-300 hover:border-primary rounded transition-colors text-left"
          >
            <div className="flex items-start gap-3">
              <Building2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{center.name}</h3>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {center.address}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 ml-auto" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderDateTime = () => (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => setMode('center-select')} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        뒤로
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">날짜 및 시간 선택</h2>
        <p className="text-gray-600">방문하실 날짜와 시간을 선택해주세요</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div>
            <Label htmlFor="date">날짜 선택 *</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="mt-2"
            />
          </div>

          <div>
            <Label>시간 선택 *</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {timeSlots.map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`p-3 border-2 rounded transition-colors ${
                    selectedTime === time
                      ? 'border-primary bg-blue-50 text-primary font-semibold'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        onClick={handleDateTimeNext}
        disabled={!selectedDate || !selectedTime}
      >
        다음
      </Button>
    </div>
  );

  const renderConfirm = () => (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => setMode('datetime')} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        뒤로
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">개인정보 입력</h2>
        <p className="text-gray-600">예약 확정을 위한 정보를 입력해주세요</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="name">이름 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="phone">연락처 *</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="birthdate">생년월일 *</Label>
            <Input
              id="birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* 보호자 연락처 (선택) */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="guardianToggle"
                checked={showGuardianField}
                onCheckedChange={(checked) => {
                  setShowGuardianField(checked as boolean);
                  if (!checked) setGuardianPhone('');
                }}
              />
              <Label htmlFor="guardianToggle" className="text-sm font-medium text-gray-700 cursor-pointer">
                보호자에게도 연락을 원합니다
              </Label>
            </div>
            {showGuardianField && (
              <div className="mt-2">
                <Label htmlFor="guardianPhone">보호자 연락처 (선택)</Label>
                <Input
                  id="guardianPhone"
                  type="tel"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="mt-2"
                />
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              예약 변경이나 안내가 필요할 경우 보호자에게도 연락드릴 수 있습니다.<br />
              입력하지 않아도 예약에는 영향이 없습니다.
            </p>
          </div>

          <div>
            <Label htmlFor="notes">요청사항 (선택)</Label>
            <Textarea
              id="notes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="방문 시 특별히 고려해야 할 사항이 있으시면 작성해주세요"
              rows={3}
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-blue-300 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">예약 정보 확인</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">센터:</span>
            <span className="font-medium text-blue-900">
              {centers.find((c) => c.id === selectedCenter)?.name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">날짜:</span>
            <span className="font-medium text-blue-900">
              {selectedDate && new Date(selectedDate).toLocaleDateString('ko-KR')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">시간:</span>
            <span className="font-medium text-blue-900">{selectedTime}</span>
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        onClick={handleConfirmBooking}
        disabled={!name || !phone || !birthdate}
      >
        예약 확정하기
      </Button>
    </div>
  );

  const renderComplete = () => (
    <div className="space-y-6 text-center py-8">
      <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="h-12 w-12 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">예약이 완료되었습니다</h2>
        <p className="text-gray-600">
          예약 확인 문자가 발송되었습니다
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">센터:</span>
            <span className="font-medium">
              {centers.find((c) => c.id === selectedCenter)?.name}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">날짜:</span>
            <span className="font-medium">
              {selectedDate && new Date(selectedDate).toLocaleDateString('ko-KR')}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">시간:</span>
            <span className="font-medium">{selectedTime}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">이름:</span>
            <span className="font-medium">{name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">연락처:</span>
            <span className="font-medium">{phone}</span>
          </div>
          {guardianPhone && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">보호자 연락처:</span>
              <span className="font-medium">{guardianPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1-****-$2')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          방문 3일 전에 리마인더 문자를 보내드립니다.
          문의사항은 센터로 연락 주세요.
        </AlertDescription>
      </Alert>

      <Button variant="outline" className="w-full" onClick={() => setMode('home')}>
        처음으로
      </Button>
    </div>
  );

  const renderFAQ = () => (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => setMode('home')} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        뒤로
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">자주 묻는 질문</h2>
        <p className="text-gray-600">궁금하신 내용을 확인해보세요</p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-base">{faq.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed">{faq.answer}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderContact = () => (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => setMode('home')} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        뒤로
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">문의 및 지원</h2>
        <p className="text-gray-600">센터 연락처 및 지원 요청</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>강남구 치매안심센터</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-gray-600">전화</p>
              <p className="font-medium">02-1234-5678</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-gray-600">이메일</p>
              <p className="font-medium">support@gangnam.go.kr</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-gray-600">주소</p>
              <p className="font-medium">서울시 강남구 봉은사로 524</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Button variant="outline" className="w-full">
          정보 수정 요청
        </Button>

        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setStopContactDialog(true)}
        >
          연락 중단 요청
        </Button>
      </div>

      {/* Stop Contact Dialog */}
      <Dialog open={stopContactDialog} onOpenChange={setStopContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">연락 중단 확인</DialogTitle>
            <DialogDescription>
              정말로 연락을 중단하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-red-300 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900 text-sm">
              연락 중단 시 후속 안내를 받으실 수 없습니다. 기존 예약은 유지됩니다.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStopContactDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleStopContact}>
              연락 중단
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center mb-2">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">치매안심센터</h1>
          <p className="text-sm text-gray-600">서울시 강남구</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {mode === 'home' && renderHome()}
          {mode === 'consent' && renderConsent()}
          {mode === 'center-select' && renderCenterSelect()}
          {mode === 'datetime' && renderDateTime()}
          {mode === 'confirm' && renderConfirm()}
          {mode === 'complete' && renderComplete()}
          {mode === 'faq' && renderFAQ()}
          {mode === 'contact' && renderContact()}
        </div>

        {/* Floating Chatbot Button */}
        <button
          onClick={() => setChatbotOpen(true)}
          className="fixed bottom-6 right-6 bg-primary hover:bg-primary-hover text-white rounded-full p-4 shadow-lg transition-transform hover:scale-110"
        >
          <Bot className="h-6 w-6" />
        </button>

        {/* Chatbot Dialog */}
        <ChatbotDialog open={chatbotOpen} onOpenChange={setChatbotOpen} />
      </div>
    </div>
  );
}