import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  FlaskConical,
  MapPin,
  MessageSquare,
  Phone,
  ShieldAlert,
  User,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Alert, AlertDescription } from '../ui/alert';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  CONTACT_STATUS_LABELS,
  CONSULT_STATUS_LABELS,
  RESERVATION_TYPE_LABELS,
  SECOND_EXAM_LABELS,
  generateAppointments,
  generateCases,
  maskPhone,
  type Appointment,
  type AppointmentStatus,
  type ReservationType,
  type RiskLevel,
} from './caseData';

type FormMode = 'create' | 'edit';

type AppointmentFormState = {
  title: string;
  caseId: string;
  patientName: string;
  patientAge: string;
  counselor: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  riskLevel: RiskLevel;
  reservationType: ReservationType | '';
  phone: string;
  reminderSent: boolean;
  reasonText: string;
  notes: string;
};

function buildEmptyForm(baseDate: string): AppointmentFormState {
  return {
    title: '',
    caseId: '',
    patientName: '',
    patientAge: '',
    counselor: '',
    date: baseDate,
    time: '09:00',
    status: 'pending',
    riskLevel: 'medium',
    reservationType: '',
    phone: '',
    reminderSent: false,
    reasonText: '',
    notes: '',
  };
}

function mapAppointmentToForm(appointment: Appointment): AppointmentFormState {
  return {
    title: appointment.type,
    caseId: appointment.caseId,
    patientName: appointment.patientName,
    patientAge: appointment.patientAge > 0 ? String(appointment.patientAge) : '',
    counselor: appointment.counselor,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    riskLevel: appointment.riskLevel,
    reservationType: appointment.reservationType ?? '',
    phone: appointment.phone,
    reminderSent: Boolean(appointment.reminderSent),
    reasonText: appointment.reasonText ?? '',
    notes: appointment.notes ?? '',
  };
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStatusMeta(status: AppointmentStatus) {
  if (status === 'confirmed') return { variant: 'default' as const, label: '예약 확정', color: 'bg-blue-500' };
  if (status === 'pending') return { variant: 'secondary' as const, label: '승인 대기', color: 'bg-gray-400' };
  if (status === 'reminder_sent') return { variant: 'outline' as const, label: '리마인더 전송', color: 'bg-green-500' };
  if (status === 'completed') return { variant: 'outline' as const, label: '완료', color: 'bg-gray-300' };
  return { variant: 'destructive' as const, label: '취소', color: 'bg-red-500' };
}

function getRiskMeta(risk: RiskLevel) {
  if (risk === 'high') return { variant: 'destructive' as const, label: '고위험' };
  if (risk === 'medium') return { variant: 'secondary' as const, label: '중위험' };
  return { variant: 'outline' as const, label: '저위험' };
}

export function Calendar() {
  const [now, setNow] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [formState, setFormState] = useState<AppointmentFormState>(() => buildEmptyForm(formatDateInput(new Date())));

  const allCases = useMemo(() => generateCases(), []);
  const sharedAppointments = useMemo(() => generateAppointments(allCases), [allCases]);
  const [appointments, setAppointments] = useState<Appointment[]>(sharedAppointments);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const getDaysArray = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days: (number | null)[] = [];

    for (let i = 0; i < firstDay; i += 1) days.push(null);
    for (let i = 1; i <= daysInMonth; i += 1) days.push(i);
    return days;
  };

  const getAppointmentsForDate = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return appointments.filter((appointment) => appointment.date === dateStr);
  };

  const getUpcomingReminders = () => {
    const today = now;
    return appointments.filter((appointment) => {
      const date = new Date(appointment.date);
      const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 3 && daysUntil >= 0 && appointment.status === 'confirmed' && !appointment.reminderSent;
    });
  };

  const openCreateForm = () => {
    const baseDate = selectedDate ?? now;
    setFormMode('create');
    setEditingAppointmentId(null);
    setFormState(buildEmptyForm(formatDateInput(baseDate)));
    setFormOpen(true);
  };

  const openEditForm = () => {
    if (!selectedAppointment) return;
    setFormMode('edit');
    setEditingAppointmentId(selectedAppointment.id);
    setFormState(mapAppointmentToForm(selectedAppointment));
    setDetailsOpen(false);
    setFormOpen(true);
  };

  const handleFormChange = <K extends keyof AppointmentFormState>(field: K, value: AppointmentFormState[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitAppointment = () => {
    if (
      !formState.title.trim() ||
      !formState.caseId.trim() ||
      !formState.patientName.trim() ||
      !formState.counselor.trim() ||
      !formState.date ||
      !formState.time
    ) {
      window.alert('필수 항목(일정명, 케이스 ID, 대상자명, 담당자, 날짜, 시간)을 입력해주세요.');
      return;
    }

    const patientAge = Number(formState.patientAge);
    const nextAppointment: Appointment = {
      id: formMode === 'edit' && editingAppointmentId ? editingAppointmentId : `APT-${Date.now()}`,
      caseId: formState.caseId.trim(),
      patientName: formState.patientName.trim(),
      patientAge: Number.isFinite(patientAge) && patientAge > 0 ? Math.round(patientAge) : 0,
      date: formState.date,
      time: formState.time,
      type: formState.title.trim(),
      reservationType: formState.reservationType || undefined,
      reasonText: formState.reasonText.trim() || undefined,
      status: formState.status,
      riskLevel: formState.riskLevel,
      counselor: formState.counselor.trim(),
      phone: formState.phone.trim(),
      reminderSent: formState.reminderSent,
      notes: formState.notes.trim() || undefined,
    };

    if (formMode === 'edit' && editingAppointmentId) {
      setAppointments((prev) => prev.map((appointment) => (appointment.id === editingAppointmentId ? nextAppointment : appointment)));
      setSelectedAppointment(nextAppointment);
      setDetailsOpen(true);
    } else {
      setAppointments((prev) => [nextAppointment, ...prev]);
    }

    setFormOpen(false);
    setEditingAppointmentId(null);

    const [year, month, day] = nextAppointment.date.split('-').map(Number);
    if (year && month && day) {
      const focusedDate = new Date(year, month - 1, day);
      setCurrentDate(new Date(year, month - 1, 1));
      setSelectedDate(focusedDate);
    }
  };

  const handleDeleteAppointment = () => {
    if (!selectedAppointment) return;
    const confirmed = window.confirm('선택한 일정을 삭제하시겠습니까?');
    if (!confirmed) return;
    setAppointments((prev) => prev.filter((appointment) => appointment.id !== selectedAppointment.id));
    setSelectedAppointment(null);
    setDetailsOpen(false);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setDetailsOpen(true);
  };

  const upcomingReminders = getUpcomingReminders();
  const todayStr = formatDateInput(now);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">일정 관리</h1>
        <p className="mt-1 text-gray-500">예약 현황과 일정을 확인하고 관리합니다</p>
      </div>

      {upcomingReminders.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-orange-900">리마인더 전송 대기 중</strong>
                <p className="mt-1 text-sm text-orange-700">
                  {upcomingReminders.length}건의 예약이 3일 이내입니다. 자동 리마인더 SMS가 곧 전송됩니다.
                </p>
              </div>
              <Button size="sm" variant="outline" className="border-orange-300">
                확인
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={openCreateForm}>
                  일정 등록
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <span>{now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>{now.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <div key={day} className="py-2 text-center text-sm font-semibold text-gray-600">
                  {day}
                </div>
              ))}

              {getDaysArray().map((day, index) => {
                const dayAppointments = getAppointmentsForDate(day);
                const isToday =
                  Boolean(day) &&
                  day === now.getDate() &&
                  currentDate.getMonth() === now.getMonth() &&
                  currentDate.getFullYear() === now.getFullYear();

                return (
                  <div
                    key={index}
                    className={`min-h-24 rounded-lg border p-2 transition-colors ${
                      day ? 'cursor-pointer bg-white hover:border-blue-300' : 'bg-gray-50'
                    } ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    onClick={() => day && handleDateClick(day)}
                  >
                    {day && (
                      <>
                        <div className={`mb-1 text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>{day}</div>
                        {dayAppointments.length > 0 && (
                          <div className="space-y-1">
                            {dayAppointments.slice(0, 2).map((appointment) => {
                              const status = getStatusMeta(appointment.status);
                              return (
                                <div
                                  key={appointment.id}
                                  className="cursor-pointer truncate rounded bg-gray-100 p-1 text-xs hover:bg-gray-200"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleAppointmentClick(appointment);
                                  }}
                                >
                                  <div className={`mr-1 inline-block h-2 w-2 rounded-full ${status.color}`} />
                                  {appointment.time} {appointment.patientName}
                                </div>
                              );
                            })}
                            {dayAppointments.length > 2 && (
                              <div className="text-center text-xs text-gray-500">+{dayAppointments.length - 2}</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex gap-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-sm text-gray-600">예약 확정</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600">리마인더 전송</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-400" />
                <span className="text-sm text-gray-600">승인 대기</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>오늘의 일정</CardTitle>
            <CardDescription>{now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {appointments
                .filter((appointment) => appointment.date === todayStr)
                .map((appointment) => {
                  const status = getStatusMeta(appointment.status);
                  const risk = getRiskMeta(appointment.riskLevel);
                  return (
                    <div
                      key={appointment.id}
                      className="cursor-pointer rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-300"
                      onClick={() => handleAppointmentClick(appointment)}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">{appointment.time}</span>
                        </div>
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                      </div>
                      <p className="font-medium text-gray-900">{appointment.patientName}</p>
                      <p className="text-sm text-gray-500">{appointment.type}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant={risk.variant}>{risk.label}</Badge>
                        <span className="text-xs text-gray-500">담당: {appointment.counselor}</span>
                      </div>
                    </div>
                  );
                })}
              {appointments.filter((appointment) => appointment.date === todayStr).length === 0 && (
                <div className="py-8 text-center text-gray-500">
                  <CalendarIcon className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                  <p className="text-sm">오늘 예정된 일정이 없습니다</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? '일정 등록' : '일정 수정'}</DialogTitle>
            <DialogDescription>
              캘린더 엔진 v1의 운영 필드를 포함해 일정을 등록/수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>일정 제목 *</Label>
                <Input value={formState.title} onChange={(event) => handleFormChange('title', event.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>케이스 ID *</Label>
                <Input value={formState.caseId} onChange={(event) => handleFormChange('caseId', event.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>대상자명 *</Label>
                <Input value={formState.patientName} onChange={(event) => handleFormChange('patientName', event.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>연령</Label>
                <Input type="number" min={0} value={formState.patientAge} onChange={(event) => handleFormChange('patientAge', event.target.value)} className="mt-2" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label>담당 상담사 *</Label>
                <Input value={formState.counselor} onChange={(event) => handleFormChange('counselor', event.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>일정 날짜 *</Label>
                <Input type="date" value={formState.date} onChange={(event) => handleFormChange('date', event.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>일정 시간 *</Label>
                <Input type="time" value={formState.time} onChange={(event) => handleFormChange('time', event.target.value)} className="mt-2" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label>상태</Label>
                <select
                  value={formState.status}
                  onChange={(event) => handleFormChange('status', event.target.value as AppointmentStatus)}
                  className="mt-2 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="pending">승인 대기</option>
                  <option value="confirmed">예약 확정</option>
                  <option value="reminder_sent">리마인더 전송</option>
                  <option value="completed">완료</option>
                  <option value="cancelled">취소</option>
                </select>
              </div>
              <div>
                <Label>위험도</Label>
                <select
                  value={formState.riskLevel}
                  onChange={(event) => handleFormChange('riskLevel', event.target.value as RiskLevel)}
                  className="mt-2 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="high">고위험</option>
                  <option value="medium">중위험</option>
                  <option value="low">저위험</option>
                </select>
              </div>
              <div>
                <Label>예약 구분</Label>
                <select
                  value={formState.reservationType}
                  onChange={(event) => handleFormChange('reservationType', event.target.value as ReservationType | '')}
                  className="mt-2 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">선택 안함</option>
                  {(Object.keys(RESERVATION_TYPE_LABELS) as ReservationType[]).map((reservationType) => (
                    <option key={reservationType} value={reservationType}>
                      {RESERVATION_TYPE_LABELS[reservationType]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>연락처</Label>
                <Input value={formState.phone} onChange={(event) => handleFormChange('phone', event.target.value)} className="mt-2" placeholder="010-1234-5678" />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formState.reminderSent}
                    onChange={(event) => handleFormChange('reminderSent', event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  리마인더 전송 완료
                </label>
              </div>
            </div>

            <div>
              <Label>예약/업무 사유</Label>
              <Textarea value={formState.reasonText} onChange={(event) => handleFormChange('reasonText', event.target.value)} className="mt-2" rows={2} />
            </div>
            <div>
              <Label>운영 메모</Label>
              <Textarea value={formState.notes} onChange={(event) => handleFormChange('notes', event.target.value)} className="mt-2" rows={3} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleSubmitAppointment}>
              {formMode === 'create' ? '등록' : '수정 저장'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>일정 상세</DialogTitle>
            <DialogDescription>예약번호: {selectedAppointment?.id}</DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-5 py-3">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16 border border-white shadow-sm">
                    <AvatarFallback className="bg-blue-100 text-xl text-blue-700">
                      {selectedAppointment.patientName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{selectedAppointment.patientName}</h3>
                      <span className="text-sm text-gray-500">
                        {selectedAppointment.patientAge > 0 ? `${selectedAppointment.patientAge}세` : '연령 정보 없음'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{selectedAppointment.caseId}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={getRiskMeta(selectedAppointment.riskLevel).variant}>
                        {getRiskMeta(selectedAppointment.riskLevel).label}
                      </Badge>
                      <Badge variant={getStatusMeta(selectedAppointment.status).variant}>
                        {getStatusMeta(selectedAppointment.status).label}
                      </Badge>
                      {selectedAppointment.reservationType && (
                        <Badge variant="outline">{RESERVATION_TYPE_LABELS[selectedAppointment.reservationType]}</Badge>
                      )}
                      {selectedAppointment.reminderSent && (
                        <Badge variant="outline" className="border-green-200 text-green-700">
                          리마인더 전송됨
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">예약 일시</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {new Date(selectedAppointment.date).toLocaleDateString('ko-KR')} {selectedAppointment.time}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">예약 유형</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{selectedAppointment.type}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">담당 상담사</p>
                  <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-gray-900">
                    <User className="h-4 w-4 text-gray-400" />
                    {selectedAppointment.counselor}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">연락처</p>
                  <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-gray-900">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {selectedAppointment.phone ? maskPhone(selectedAppointment.phone) : '-'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">리마인더 상태</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {selectedAppointment.reminderSent ? '전송 완료' : '미전송'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">운영 추적</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    추적 가능
                  </p>
                </div>
              </div>

              {(selectedAppointment.caseContactStatus || selectedAppointment.caseConsultStatus || selectedAppointment.caseSecondExamStatus) && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    케이스 상태 요약(v1 엔진)
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {selectedAppointment.caseContactStatus && (
                      <span className="text-gray-700">
                        접촉: <strong>{CONTACT_STATUS_LABELS[selectedAppointment.caseContactStatus]}</strong>
                      </span>
                    )}
                    {selectedAppointment.caseConsultStatus && (
                      <span className="text-gray-700">
                        상담: <strong>{CONSULT_STATUS_LABELS[selectedAppointment.caseConsultStatus]}</strong>
                      </span>
                    )}
                    {selectedAppointment.caseSecondExamStatus && (
                      <span className="flex items-center gap-1 text-gray-700">
                        <FlaskConical className="h-3.5 w-3.5" />
                        2차: <strong>{SECOND_EXAM_LABELS[selectedAppointment.caseSecondExamStatus]}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {selectedAppointment.reasonText && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
                  <p className="text-xs font-semibold text-violet-700">예약/업무 사유</p>
                  <p className="mt-1 text-sm text-violet-900">{selectedAppointment.reasonText}</p>
                </div>
              )}

              {selectedAppointment.notes && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-semibold text-blue-700">특이사항 / 메모</p>
                  <p className="mt-1 text-sm text-blue-900">{selectedAppointment.notes}</p>
                </div>
              )}

              {selectedAppointment.autoMemoRecent && selectedAppointment.autoMemoRecent.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-gray-700">
                    <MessageSquare className="h-3.5 w-3.5" />
                    최근 운영 메모
                  </p>
                  <ul className="space-y-1">
                    {selectedAppointment.autoMemoRecent.map((memo, index) => (
                      <li key={`${memo}-${index}`} className="flex items-start gap-1.5 text-xs text-gray-700">
                        <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400" />
                        {memo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedAppointment.reminderSent && (
                <Alert className="border-green-200 bg-green-50">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-900">
                    리마인더 SMS가 전송되었습니다.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="flex-1 min-w-[120px]" onClick={openEditForm}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  수정
                </Button>
                <Button variant="outline" className="flex-1 min-w-[120px]">
                  <Phone className="mr-2 h-4 w-4" />
                  전화 연결
                </Button>
                <Button variant="outline" className="flex-1 min-w-[120px]">
                  <MapPin className="mr-2 h-4 w-4" />
                  위치 안내
                </Button>
                <Button variant="destructive" className="flex-1 min-w-[120px]" onClick={handleDeleteAppointment}>
                  삭제
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
