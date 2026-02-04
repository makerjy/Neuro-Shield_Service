import React, { useState } from 'react';
import { Search, Filter, Calendar, Clock, Phone, Mail, MapPin, FileText, CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Avatar, AvatarFallback } from '../ui/avatar';

type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

interface Appointment {
  id: string;
  citizenName: string;
  citizenPhone: string;
  citizenEmail: string;
  requestDate: string;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  type: string;
  notes: string;
  counselor?: string;
}

export function AppointmentManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'approve' | 'reject' | 'cancel' | null;
    appointment: Appointment | null;
  }>({ open: false, type: null, appointment: null });
  const [actionNote, setActionNote] = useState('');

  // Mock data
  const appointments: Appointment[] = [
    {
      id: 'APT-001',
      citizenName: '김민수',
      citizenPhone: '010-1234-5678',
      citizenEmail: 'kim.minsoo@example.com',
      requestDate: '2026-01-28',
      appointmentDate: '2026-02-05',
      appointmentTime: '10:00',
      status: 'confirmed',
      type: '초기 상담',
      notes: '업무 스트레스로 인한 불안 증상 호소',
      counselor: '이상담',
    },
    {
      id: 'APT-002',
      citizenName: '이영희',
      citizenPhone: '010-2345-6789',
      citizenEmail: 'lee.younghee@example.com',
      requestDate: '2026-02-01',
      appointmentDate: '2026-02-06',
      appointmentTime: '14:00',
      status: 'pending',
      type: '초기 상담',
      notes: '최근 수면 장애 문제',
    },
    {
      id: 'APT-003',
      citizenName: '박철수',
      citizenPhone: '010-3456-7890',
      citizenEmail: 'park.chulsoo@example.com',
      requestDate: '2026-01-30',
      appointmentDate: '2026-02-03',
      appointmentTime: '11:00',
      status: 'completed',
      type: '재상담',
      notes: '이전 상담 후속',
      counselor: '김상담',
    },
    {
      id: 'APT-004',
      citizenName: '정수진',
      citizenPhone: '010-4567-8901',
      citizenEmail: 'jung.soojin@example.com',
      requestDate: '2026-02-02',
      appointmentDate: '2026-02-07',
      appointmentTime: '15:30',
      status: 'pending',
      type: '초기 상담',
      notes: '가족 관계 스트레스',
    },
    {
      id: 'APT-005',
      citizenName: '최지우',
      citizenPhone: '010-5678-9012',
      citizenEmail: 'choi.jiwoo@example.com',
      requestDate: '2026-01-25',
      appointmentDate: '2026-02-01',
      appointmentTime: '09:00',
      status: 'no_show',
      type: '초기 상담',
      notes: '직장 내 대인관계 어려움',
      counselor: '이상담',
    },
  ];

  const getStatusBadge = (status: AppointmentStatus) => {
    const variants = {
      pending: { variant: 'secondary' as const, label: '승인 대기' },
      confirmed: { variant: 'default' as const, label: '예약 확정' },
      completed: { variant: 'outline' as const, label: '상담 완료' },
      cancelled: { variant: 'destructive' as const, label: '취소됨' },
      no_show: { variant: 'destructive' as const, label: '노쇼' },
    };
    const { variant, label } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch =
      apt.citizenName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.citizenPhone.includes(searchTerm) ||
      apt.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenDetails = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setDetailsOpen(true);
  };

  const handleAction = (type: 'approve' | 'reject' | 'cancel', appointment: Appointment) => {
    setActionDialog({ open: true, type, appointment });
    setActionNote('');
  };

  const handleConfirmAction = () => {
    // Here you would call the API to update the appointment status
    console.log('Action:', actionDialog.type, 'Note:', actionNote);
    setActionDialog({ open: false, type: null, appointment: null });
    setActionNote('');
  };

  const getStatusCounts = () => {
    return {
      all: appointments.length,
      pending: appointments.filter((a) => a.status === 'pending').length,
      confirmed: appointments.filter((a) => a.status === 'confirmed').length,
      completed: appointments.filter((a) => a.status === 'completed').length,
    };
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">예약 관리</h1>
        <p className="text-gray-500 mt-1">시민 상담 예약을 관리하고 승인합니다</p>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="이름, 전화번호, 예약번호로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="상태 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 ({statusCounts.all})</SelectItem>
                <SelectItem value="pending">승인 대기 ({statusCounts.pending})</SelectItem>
                <SelectItem value="confirmed">예약 확정 ({statusCounts.confirmed})</SelectItem>
                <SelectItem value="completed">상담 완료 ({statusCounts.completed})</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              고급 필터
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>예약 목록</CardTitle>
          <CardDescription>{filteredAppointments.length}건의 예약</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>예약번호</TableHead>
                <TableHead>시민 정보</TableHead>
                <TableHead>예약 일시</TableHead>
                <TableHead>상담 유형</TableHead>
                <TableHead>담당 상담사</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    검색 결과가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                filteredAppointments.map((appointment) => (
                  <TableRow key={appointment.id} className="cursor-pointer hover:bg-gray-50">
                    <TableCell className="font-medium">{appointment.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {appointment.citizenName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{appointment.citizenName}</div>
                          <div className="text-sm text-gray-500">{appointment.citizenPhone}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          {new Date(appointment.appointmentDate).toLocaleDateString('ko-KR')}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock className="h-3 w-3" />
                          {appointment.appointmentTime}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{appointment.type}</TableCell>
                    <TableCell>{appointment.counselor || '-'}</TableCell>
                    <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDetails(appointment)}>
                            <FileText className="h-4 w-4 mr-2" />
                            상세보기
                          </DropdownMenuItem>
                          {appointment.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => handleAction('approve', appointment)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                승인
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('reject', appointment)}>
                                <XCircle className="h-4 w-4 mr-2" />
                                거절
                              </DropdownMenuItem>
                            </>
                          )}
                          {appointment.status === 'confirmed' && (
                            <DropdownMenuItem onClick={() => handleAction('cancel', appointment)}>
                              <XCircle className="h-4 w-4 mr-2" />
                              취소
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>예약 상세 정보</DialogTitle>
            <DialogDescription>예약번호: {selectedAppointment?.id}</DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">기본 정보</TabsTrigger>
                <TabsTrigger value="history">이력</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">시민 이름</Label>
                    <p className="mt-1 font-medium">{selectedAppointment.citizenName}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">상태</Label>
                    <div className="mt-1">{getStatusBadge(selectedAppointment.status)}</div>
                  </div>
                  <div>
                    <Label className="text-gray-500">전화번호</Label>
                    <p className="mt-1 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {selectedAppointment.citizenPhone}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">이메일</Label>
                    <p className="mt-1 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {selectedAppointment.citizenEmail}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">예약 일시</Label>
                    <p className="mt-1">
                      {new Date(selectedAppointment.appointmentDate).toLocaleDateString('ko-KR')}{' '}
                      {selectedAppointment.appointmentTime}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">상담 유형</Label>
                    <p className="mt-1">{selectedAppointment.type}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-gray-500">상담 요청 사항</Label>
                    <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                      {selectedAppointment.notes}
                    </p>
                  </div>
                  {selectedAppointment.counselor && (
                    <div>
                      <Label className="text-gray-500">담당 상담사</Label>
                      <p className="mt-1">{selectedAppointment.counselor}</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                <div className="space-y-3">
                  <div className="border-l-2 border-blue-200 pl-4 py-2">
                    <p className="text-sm font-medium text-gray-900">예약 요청</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(selectedAppointment.requestDate).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  {selectedAppointment.status === 'confirmed' && (
                    <div className="border-l-2 border-green-200 pl-4 py-2">
                      <p className="text-sm font-medium text-gray-900">예약 승인</p>
                      <p className="text-xs text-gray-500 mt-1">2026-01-29 14:30</p>
                    </div>
                  )}
                  {selectedAppointment.status === 'completed' && (
                    <div className="border-l-2 border-gray-200 pl-4 py-2">
                      <p className="text-sm font-medium text-gray-900">상담 완료</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(selectedAppointment.appointmentDate).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              닫기
            </Button>
            {selectedAppointment?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailsOpen(false);
                    handleAction('reject', selectedAppointment);
                  }}
                >
                  거절
                </Button>
                <Button
                  onClick={() => {
                    setDetailsOpen(false);
                    handleAction('approve', selectedAppointment);
                  }}
                >
                  승인
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, type: null, appointment: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'approve' && '예약 승인'}
              {actionDialog.type === 'reject' && '예약 거절'}
              {actionDialog.type === 'cancel' && '예약 취소'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.appointment?.citizenName}님의 예약을 {actionDialog.type === 'approve' ? '승인' : actionDialog.type === 'reject' ? '거절' : '취소'}하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="action-note">
                {actionDialog.type === 'approve' ? '안내 사항 (선택)' : '사유'}
              </Label>
              <Textarea
                id="action-note"
                placeholder={
                  actionDialog.type === 'approve'
                    ? '시민에게 전달할 안내 사항을 입력하세요'
                    : '거절/취소 사유를 입력하세요'
                }
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null, appointment: null })}>
              취소
            </Button>
            <Button
              variant={actionDialog.type === 'approve' ? 'default' : 'destructive'}
              onClick={handleConfirmAction}
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
