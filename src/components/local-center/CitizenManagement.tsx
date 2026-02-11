import React, { useState } from 'react';
import { Search, Filter, User, Phone, Mail, Calendar, MapPin, FileText, Clock, TrendingUp, AlertCircle } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui/tabs';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

type RiskLevel = 'low' | 'medium' | 'high';
type CitizenStatus = 'active' | 'inactive' | 'completed';

interface Citizen {
  id: string;
  name: string;
  phone: string;
  email: string;
  registeredDate: string;
  lastContact: string;
  status: CitizenStatus;
  riskLevel: RiskLevel;
  totalConsultations: number;
  address: string;
  age: number;
  gender: string;
  emergencyContact?: string;
}

interface ConsultationHistory {
  id: string;
  date: string;
  type: string;
  counselor: string;
  summary: string;
  riskLevel: RiskLevel;
}

interface Appointment {
  id: string;
  date: string;
  time: string;
  status: string;
  type: string;
}

export function CitizenManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Mock data
  const citizens: Citizen[] = [
    {
      id: 'CIT-001',
      name: '김민수',
      phone: '010-1234-5678',
      email: 'kim.minsoo@example.com',
      registeredDate: '2026-01-15',
      lastContact: '2026-02-01',
      status: 'active',
      riskLevel: 'medium',
      totalConsultations: 3,
      address: '서울시 강남구',
      age: 32,
      gender: '남성',
      emergencyContact: '010-9876-5432',
    },
    {
      id: 'CIT-002',
      name: '이영희',
      phone: '010-2345-6789',
      email: 'lee.younghee@example.com',
      registeredDate: '2026-01-20',
      lastContact: '2026-01-25',
      status: 'active',
      riskLevel: 'low',
      totalConsultations: 1,
      address: '서울시 서초구',
      age: 28,
      gender: '여성',
    },
    {
      id: 'CIT-003',
      name: '박철수',
      phone: '010-3456-7890',
      email: 'park.chulsoo@example.com',
      registeredDate: '2025-12-10',
      lastContact: '2026-02-03',
      status: 'completed',
      riskLevel: 'low',
      totalConsultations: 5,
      address: '서울시 송파구',
      age: 45,
      gender: '남성',
      emergencyContact: '010-1111-2222',
    },
    {
      id: 'CIT-004',
      name: '정수진',
      phone: '010-4567-8901',
      email: 'jung.soojin@example.com',
      registeredDate: '2026-01-28',
      lastContact: '2026-01-30',
      status: 'active',
      riskLevel: 'medium',
      totalConsultations: 2,
      address: '서울시 마포구',
      age: 35,
      gender: '여성',
    },
    {
      id: 'CIT-005',
      name: '최지우',
      phone: '010-5678-9012',
      email: 'choi.jiwoo@example.com',
      registeredDate: '2026-01-10',
      lastContact: '2026-01-18',
      status: 'inactive',
      riskLevel: 'low',
      totalConsultations: 1,
      address: '서울시 강동구',
      age: 29,
      gender: '여성',
    },
  ];

  const consultationHistory: ConsultationHistory[] = [
    {
      id: 'REC-001',
      date: '2026-02-01',
      type: '초기 상담',
      counselor: '이상담',
      summary: '업무 스트레스로 인한 불안 증상 상담',
      riskLevel: 'medium',
    },
    {
      id: 'REC-002',
      date: '2026-01-25',
      type: '재상담',
      counselor: '이상담',
      summary: '스트레스 관리 기법 교육 및 후속 상담',
      riskLevel: 'medium',
    },
    {
      id: 'REC-003',
      date: '2026-01-18',
      type: '초기 상담',
      counselor: '김상담',
      summary: '수면 장애 및 집중력 저하 상담',
      riskLevel: 'low',
    },
  ];

  const upcomingAppointments: Appointment[] = [
    {
      id: 'APT-010',
      date: '2026-02-10',
      time: '14:00',
      status: 'confirmed',
      type: '재상담',
    },
    {
      id: 'APT-015',
      date: '2026-02-15',
      time: '10:00',
      status: 'pending',
      type: '후속 상담',
    },
  ];

  const getRiskBadge = (level: RiskLevel) => {
    const variants = {
      low: { variant: 'outline' as const, label: '낮음' },
      medium: { variant: 'secondary' as const, label: '보통' },
      high: { variant: 'destructive' as const, label: '높음' },
    };
    const { variant, label } = variants[level];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getStatusBadge = (status: CitizenStatus) => {
    const variants = {
      active: { variant: 'default' as const, label: '활성' },
      inactive: { variant: 'secondary' as const, label: '비활성' },
      completed: { variant: 'outline' as const, label: '종결' },
    };
    const { variant, label } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const filteredCitizens = citizens.filter((citizen) => {
    const matchesSearch =
      citizen.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      citizen.phone.includes(searchTerm) ||
      citizen.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      citizen.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || citizen.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenDetails = (citizen: Citizen) => {
    setSelectedCitizen(citizen);
    setDetailsOpen(true);
  };

  const getStatusCounts = () => {
    return {
      all: citizens.length,
      active: citizens.filter((c) => c.status === 'active').length,
      inactive: citizens.filter((c) => c.status === 'inactive').length,
      completed: citizens.filter((c) => c.status === 'completed').length,
    };
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">시민 관리</h1>
        <p className="text-gray-500 mt-1">등록된 시민의 정보와 상담 이력을 관리합니다</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">총 시민</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{citizens.length}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <User className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">활성 시민</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statusCounts.active}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">이번 주 신규</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">8</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <User className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">고위험군</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {citizens.filter((c) => c.riskLevel === 'high').length}
                </p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
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
                  placeholder="이름, 전화번호, 이메일, 시민ID로 검색..."
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
                <SelectItem value="active">활성 ({statusCounts.active})</SelectItem>
                <SelectItem value="inactive">비활성 ({statusCounts.inactive})</SelectItem>
                <SelectItem value="completed">종결 ({statusCounts.completed})</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              고급 필터
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Citizens Table */}
      <Card>
        <CardHeader>
          <CardTitle>시민 목록</CardTitle>
          <CardDescription>{filteredCitizens.length}명의 시민</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>시민 정보</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead>마지막 상담</TableHead>
                <TableHead>상담 횟수</TableHead>
                <TableHead>우선도</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCitizens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    검색 결과가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                filteredCitizens.map((citizen) => (
                  <TableRow
                    key={citizen.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleOpenDetails(citizen)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {citizen.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{citizen.name}</div>
                          <div className="text-sm text-gray-500">{citizen.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-gray-400" />
                          {citizen.phone}
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <Mail className="h-3 w-3" />
                          {citizen.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(citizen.registeredDate).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      {new Date(citizen.lastContact).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{citizen.totalConsultations}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getRiskBadge(citizen.riskLevel)}</TableCell>
                    <TableCell>{getStatusBadge(citizen.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetails(citizen);
                        }}
                      >
                        상세보기
                      </Button>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>시민 상세 정보</DialogTitle>
            <DialogDescription>시민ID: {selectedCitizen?.id}</DialogDescription>
          </DialogHeader>
          {selectedCitizen && (
            <Tabs defaultValue="info" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">기본 정보</TabsTrigger>
                <TabsTrigger value="history">상담 이력</TabsTrigger>
                <TabsTrigger value="appointments">예약 현황</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="info" className="space-y-6 mt-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl">
                      {selectedCitizen.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold mb-2">{selectedCitizen.name}</h3>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedCitizen.status)}
                      {getRiskBadge(selectedCitizen.riskLevel)}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-500">전화번호</Label>
                    <p className="mt-1 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {selectedCitizen.phone}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">이메일</Label>
                    <p className="mt-1 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {selectedCitizen.email}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">나이</Label>
                    <p className="mt-1">{selectedCitizen.age}세</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">성별</Label>
                    <p className="mt-1">{selectedCitizen.gender}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">주소</Label>
                    <p className="mt-1 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {selectedCitizen.address}
                    </p>
                  </div>
                  {selectedCitizen.emergencyContact && (
                    <div>
                      <Label className="text-gray-500">비상 연락처</Label>
                      <p className="mt-1 flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        {selectedCitizen.emergencyContact}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-gray-500">등록일</Label>
                    <p className="mt-1 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {new Date(selectedCitizen.registeredDate).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">마지막 상담</Label>
                    <p className="mt-1 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {new Date(selectedCitizen.lastContact).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-gray-500">총 상담 횟수</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {selectedCitizen.totalConsultations}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-gray-500">예정된 상담</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">2</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-gray-500">총 상담 시간</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">180분</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="mt-6 space-y-4">
                {consultationHistory.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{record.type}</h4>
                            {getRiskBadge(record.riskLevel)}
                          </div>
                          <p className="text-sm text-gray-500">
                            {new Date(record.date).toLocaleDateString('ko-KR')} • {record.counselor}
                          </p>
                        </div>
                        <Badge variant="outline">{record.id}</Badge>
                      </div>
                      <p className="text-sm text-gray-700">{record.summary}</p>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Appointments Tab */}
              <TabsContent value="appointments" className="mt-6 space-y-4">
                {upcomingAppointments.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{appointment.type}</h4>
                            <Badge variant={appointment.status === 'confirmed' ? 'default' : 'secondary'}>
                              {appointment.status === 'confirmed' ? '확정' : '대기'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(appointment.date).toLocaleDateString('ko-KR')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {appointment.time}
                            </span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          상세보기
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
