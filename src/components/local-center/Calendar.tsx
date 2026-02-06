import React, { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, AlertCircle, Phone, MapPin, FlaskConical, ClipboardList, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Alert, AlertDescription } from '../ui/alert';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  generateCases, generateAppointments,
  CONTACT_STATUS_LABELS, CONSULT_STATUS_LABELS, SECOND_EXAM_LABELS, RESERVATION_TYPE_LABELS,
  maskPhone,
  type Appointment, type RiskLevel, type AppointmentStatus,
} from './caseData';

export function Calendar() {
  const [now, setNow] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCaseId, setNewCaseId] = useState('');
  const [newCounselor, setNewCounselor] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // ═══ 공유 데이터에서 예약 생성 ═══
  const allCases = useMemo(() => generateCases(), []);
  const sharedAppointments = useMemo(() => generateAppointments(allCases), [allCases]);
  const [appointments, setAppointments] = useState<Appointment[]>(sharedAppointments);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
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

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getAppointmentsForDate = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return appointments.filter(apt => apt.date === dateStr);
  };

  const getUpcomingReminders = () => {
    const today = now;
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);

    return appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      const daysUntil = Math.ceil((aptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 3 && daysUntil >= 0 && apt.status === 'confirmed' && !apt.reminderSent;
    });
  };

  const getRiskBadge = (level: RiskLevel) => {
    const variants = {
      high: { variant: 'destructive' as const, label: '높음' },
      medium: { variant: 'secondary' as const, label: '보통' },
      low: { variant: 'outline' as const, label: '양호' },
    };
    return <Badge variant={variants[level].variant}>{variants[level].label}</Badge>;
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    const variants = {
      confirmed: { variant: 'default' as const, label: '예약 확정', color: 'bg-blue-500' },
      pending: { variant: 'secondary' as const, label: '승인 대기', color: 'bg-gray-400' },
      reminder_sent: { variant: 'outline' as const, label: '리마인더 전송', color: 'bg-green-500' },
      completed: { variant: 'outline' as const, label: '완료', color: 'bg-gray-300' },
      cancelled: { variant: 'destructive' as const, label: '취소', color: 'bg-red-500' },
    };
    return variants[status];
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

  const handleOpenCreate = () => {
    const baseDate = selectedDate ?? now;
    setNewTitle('');
    setNewCaseId('');
    setNewCounselor('');
    setNewDate(formatDateInput(baseDate));
    setNewTime('09:00');
    setNewNotes('');
    setCreateOpen(true);
  };

  const handleCreateAppointment = () => {
    if (!newTitle || !newCaseId || !newCounselor || !newDate || !newTime) {
      alert('필수 항목을 입력해주세요.');
      return;
    }
    const newAppointment: Appointment = {
      id: `APT-${Date.now()}`,
      caseId: newCaseId,
      patientName: newCaseId,
      patientAge: 0,
      date: newDate,
      time: newTime,
      type: newTitle,
      status: 'pending',
      riskLevel: 'medium',
      counselor: newCounselor,
      phone: '',
      notes: newNotes,
    };
    setAppointments((prev) => [newAppointment, ...prev]);
    setCreateOpen(false);
  };

  const handleDeleteAppointment = () => {
    if (!selectedAppointment) return;
    const confirmed = window.confirm('선택한 일정을 삭제하시겠습니까?');
    if (!confirmed) return;
    setAppointments((prev) => prev.filter((apt) => apt.id !== selectedAppointment.id));
    setSelectedAppointment(null);
    setDetailsOpen(false);
  };

  const upcomingReminders = getUpcomingReminders();
  const todayStr = formatDateInput(now);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">일정 관리</h1>
        <p className="text-gray-500 mt-1">예약 현황과 일정을 확인하고 관리합니다</p>
      </div>

      {/* Upcoming Reminders Alert */}
      {upcomingReminders.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-orange-900">리마인더 전송 대기 중</strong>
                <p className="text-sm text-orange-700 mt-1">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleOpenCreate}>
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
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-gray-600 py-2">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {getDaysArray().map((day, index) => {
                const dayAppointments = getAppointmentsForDate(day);
                const isToday =
                  !!day &&
                  day === now.getDate() &&
                  currentDate.getMonth() === now.getMonth() &&
                  currentDate.getFullYear() === now.getFullYear();
                const hasAppointments = dayAppointments.length > 0;

                return (
                  <div
                    key={index}
                    className={`min-h-24 p-2 border rounded-lg transition-colors ${
                      day
                        ? 'cursor-pointer hover:border-blue-300 bg-white'
                        : 'bg-gray-50'
                    } ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    onClick={() => day && handleDateClick(day)}
                  >
                    {day && (
                      <>
                        <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                          {day}
                        </div>
                        {hasAppointments && (
                          <div className="space-y-1">
                            {dayAppointments.slice(0, 2).map((apt) => {
                              const status = getStatusBadge(apt.status);
                              return (
                                <div
                                  key={apt.id}
                                  className="text-xs p-1 rounded bg-gray-100 hover:bg-gray-200 truncate cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAppointmentClick(apt);
                                  }}
                                >
                                  <div className={`w-2 h-2 rounded-full ${status.color} inline-block mr-1`}></div>
                                  {apt.time} {apt.patientName}
                                </div>
                              );
                            })}
                            {dayAppointments.length > 2 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayAppointments.length - 2}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm text-gray-600">예약 확정</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-600">리마인더 전송</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-sm text-gray-600">승인 대기</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>오늘의 일정</CardTitle>
            <CardDescription>{now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {appointments
                .filter((apt) => apt.date === todayStr)
                .map((apt) => {
                  const status = getStatusBadge(apt.status);
                  return (
                    <div
                      key={apt.id}
                      className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors"
                      onClick={() => handleAppointmentClick(apt)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-sm">{apt.time}</span>
                        </div>
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                      </div>
                      <p className="font-medium text-gray-900">{apt.patientName}</p>
                      <p className="text-sm text-gray-500">{apt.type}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {getRiskBadge(apt.riskLevel)}
                        <span className="text-xs text-gray-500">담당: {apt.counselor}</span>
                      </div>
                    </div>
                  );
                })}
              {appointments.filter((apt) => apt.date === todayStr).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">오늘 예정된 일정이 없습니다</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointment Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>일정 등록</DialogTitle>
            <DialogDescription>필수 항목을 입력해 일정을 등록합니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>일정 제목</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-2" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>케이스 ID</Label>
                <Input value={newCaseId} onChange={(e) => setNewCaseId(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>담당 상담사</Label>
                <Input value={newCounselor} onChange={(e) => setNewCounselor(e.target.value)} className="mt-2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>일정 날짜</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>일정 시간</Label>
                <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="mt-2" />
              </div>
            </div>
            <div>
              <Label>메모</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="mt-2" rows={3} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleCreateAppointment}>
              등록
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>예약 상세 정보</DialogTitle>
            <DialogDescription>예약번호: {selectedAppointment?.id}</DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-6 py-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-xl">
                    {selectedAppointment.patientName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-1">{selectedAppointment.patientName}</h3>
                  {selectedAppointment.patientAge > 0 ? (
                    <p className="text-sm text-gray-500 mb-2">{selectedAppointment.patientAge}세</p>
                  ) : (
                    <p className="text-sm text-gray-400 mb-2">연령 정보 없음</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {getRiskBadge(selectedAppointment.riskLevel)}
                    <Badge variant={getStatusBadge(selectedAppointment.status).variant}>
                      {getStatusBadge(selectedAppointment.status).label}
                    </Badge>
                    {selectedAppointment.reservationType && (
                      <Badge variant="outline" className="text-xs">
                        {RESERVATION_TYPE_LABELS[selectedAppointment.reservationType]}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">예약 일시</p>
                  <p className="font-medium mt-1">
                    {new Date(selectedAppointment.date).toLocaleDateString('ko-KR')} {selectedAppointment.time}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">예약 유형</p>
                  <p className="font-medium mt-1">{selectedAppointment.type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">담당 상담사</p>
                  <p className="font-medium mt-1 flex items-center gap-1">
                    <User className="h-4 w-4 text-gray-400" />
                    {selectedAppointment.counselor}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">연락처</p>
                  <p className="font-medium mt-1 flex items-center gap-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {maskPhone(selectedAppointment.phone)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">케이스 ID</p>
                  <p className="font-medium mt-1">{selectedAppointment.caseId}</p>
                </div>
              </div>

              {/* ═══ 확장: 케이스 상태 요약 ═══ */}
              {(selectedAppointment.caseContactStatus || selectedAppointment.caseConsultStatus || selectedAppointment.caseSecondExamStatus) && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                    <ClipboardList className="h-3.5 w-3.5" /> 케이스 상태 요약
                  </p>
                  <div className="flex items-center gap-3 flex-wrap text-sm">
                    {selectedAppointment.caseContactStatus && (
                      <span className="text-gray-700">접촉: <strong>{CONTACT_STATUS_LABELS[selectedAppointment.caseContactStatus]}</strong></span>
                    )}
                    {selectedAppointment.caseConsultStatus && (
                      <span className="text-gray-700">상담: <strong>{CONSULT_STATUS_LABELS[selectedAppointment.caseConsultStatus]}</strong></span>
                    )}
                    {selectedAppointment.caseSecondExamStatus && (
                      <span className="text-gray-700 flex items-center gap-1">
                        <FlaskConical className="h-3.5 w-3.5" />
                        2차: <strong>{SECOND_EXAM_LABELS[selectedAppointment.caseSecondExamStatus]}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ 확장: 예약 사유 ═══ */}
              {selectedAppointment.reasonText && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs font-semibold text-purple-700 mb-1">예약 사유</p>
                  <p className="text-sm text-purple-900">{selectedAppointment.reasonText}</p>
                </div>
              )}

              {selectedAppointment.notes && !selectedAppointment.reasonText && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900 mb-1">특이사항</p>
                  <p className="text-sm text-blue-700">{selectedAppointment.notes}</p>
                </div>
              )}

              {/* ═══ 확장: 최근 운영 메모 ═══ */}
              {selectedAppointment.autoMemoRecent && selectedAppointment.autoMemoRecent.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> 최근 운영 메모
                  </p>
                  <ul className="space-y-1">
                    {selectedAppointment.autoMemoRecent.map((memo, i) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
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
                    리마인더 SMS가 전송되었습니다
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <Phone className="h-4 w-4 mr-2" />
                  전화 연결
                </Button>
                <Button variant="outline" className="flex-1">
                  <MapPin className="h-4 w-4 mr-2" />
                  위치 안내
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleDeleteAppointment}>
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
