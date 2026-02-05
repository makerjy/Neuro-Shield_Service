import React, { useState } from 'react';
import { Search, Filter, Star, AlertCircle, Clock, CheckCircle, Phone, ChevronRight, Bell } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

type RiskLevel = 'high' | 'medium' | 'low';
type CaseStatus = 'not_contacted' | 'contacted' | 'consultation_complete' | 'appointment_scheduled';
type TaskPriority = 'urgent' | 'today' | 'normal';

interface Case {
  id: string;
  patientName: string;
  age: number;
  riskLevel: RiskLevel;
  lastContact: string | null;
  status: CaseStatus;
  counselor: string;
  isFavorite: boolean;
  phone: string;
}

interface Task {
  id: string;
  caseId: string;
  patientName: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  type: string;
}

export function CaseDashboard({ onCaseSelect }: { onCaseSelect: (caseId: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [counselorFilter, setCounselorFilter] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['CASE-2026-001', 'CASE-2026-003']));

  // Mock data
  const cases: Case[] = [
    {
      id: 'CASE-2026-001',
      patientName: '김민수',
      age: 72,
      riskLevel: 'high',
      lastContact: '2026-01-28',
      status: 'contacted',
      counselor: '이상담',
      isFavorite: true,
      phone: '010-1234-5678',
    },
    {
      id: 'CASE-2026-002',
      patientName: '박영희',
      age: 68,
      riskLevel: 'medium',
      lastContact: '2026-01-30',
      status: 'consultation_complete',
      counselor: '김상담',
      isFavorite: false,
      phone: '010-2345-6789',
    },
    {
      id: 'CASE-2026-003',
      patientName: '정철수',
      age: 75,
      riskLevel: 'high',
      lastContact: null,
      status: 'not_contacted',
      counselor: '이상담',
      isFavorite: true,
      phone: '010-3456-7890',
    },
    {
      id: 'CASE-2026-004',
      patientName: '최수진',
      age: 70,
      riskLevel: 'low',
      lastContact: '2026-02-01',
      status: 'appointment_scheduled',
      counselor: '김상담',
      isFavorite: false,
      phone: '010-4567-8901',
    },
    {
      id: 'CASE-2026-005',
      patientName: '이순자',
      age: 73,
      riskLevel: 'medium',
      lastContact: null,
      status: 'not_contacted',
      counselor: '이상담',
      isFavorite: false,
      phone: '010-5678-9012',
    },
    {
      id: 'CASE-2026-006',
      patientName: '장동건',
      age: 69,
      riskLevel: 'high',
      lastContact: '2026-01-25',
      status: 'contacted',
      counselor: '김상담',
      isFavorite: false,
      phone: '010-6789-0123',
    },
  ];

  const tasks: Task[] = [
    {
      id: 'TASK-001',
      caseId: 'CASE-2026-003',
      patientName: '정철수',
      title: '초기 접촉 필요',
      description: '고위험군 케이스, 빠른 시일 내 초기 접촉 및 상담 예약 필요',
      priority: 'urgent',
      dueDate: '2026-02-02',
      type: '초기 접촉',
    },
    {
      id: 'TASK-002',
      caseId: 'CASE-2026-001',
      patientName: '김민수',
      title: '예약 확인 전화',
      description: '2월 5일 예약에 대한 확인 전화 필요',
      priority: 'today',
      dueDate: '2026-02-02',
      type: '예약 확인',
    },
    {
      id: 'TASK-003',
      caseId: 'CASE-2026-005',
      patientName: '이순자',
      title: '초기 접촉 시도',
      description: '미접촉 케이스, 전화 상담 시도',
      priority: 'today',
      dueDate: '2026-02-02',
      type: '초기 접촉',
    },
    {
      id: 'TASK-004',
      caseId: 'CASE-2026-002',
      patientName: '박영희',
      title: '후속 상담 일정 조율',
      description: '상담 완료 후 재검사 일정 조율 필요',
      priority: 'normal',
      dueDate: '2026-02-05',
      type: '후속 조치',
    },
  ];

  const getRiskBadge = (level: RiskLevel) => {
    const variants = {
      high: { variant: 'destructive' as const, label: '높음', tooltip: '즉시 조치 필요' },
      medium: { variant: 'secondary' as const, label: '보통', tooltip: '정기 모니터링' },
      low: { variant: 'outline' as const, label: '양호', tooltip: '예방 관리' },
    };
    const badge = variants[level];
    return (
      <div className="group relative inline-block">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {badge.tooltip}
        </div>
      </div>
    );
  };

  const getStatusBadge = (status: CaseStatus) => {
    const variants = {
      not_contacted: { variant: 'destructive' as const, label: '미접촉', icon: AlertCircle },
      contacted: { variant: 'secondary' as const, label: '접촉완료', icon: Phone },
      consultation_complete: { variant: 'default' as const, label: '상담완료', icon: CheckCircle },
      appointment_scheduled: { variant: 'outline' as const, label: '예약완료', icon: Clock },
    };
    const status_info = variants[status];
    const Icon = status_info.icon;
    return (
      <Badge variant={status_info.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status_info.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    const variants = {
      urgent: { color: 'border-red-500 bg-red-50 text-red-700', label: '긴급', icon: '🚨' },
      today: { color: 'border-orange-500 bg-orange-50 text-orange-700', label: '오늘', icon: '⏰' },
      normal: { color: 'border-blue-500 bg-blue-50 text-blue-700', label: '일반', icon: '📋' },
    };
    const p = variants[priority];
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-sm font-medium ${p.color}`}>
        <span>{p.icon}</span>
        {p.label}
      </div>
    );
  };

  const toggleFavorite = (caseId: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(caseId)) {
        newFavorites.delete(caseId);
      } else {
        newFavorites.add(caseId);
      }
      return newFavorites;
    });
  };

  const getAgeRangeLabel = (age: number) => {
    if (age >= 80) return '80세 이상';
    if (age >= 75) return '75~79세';
    if (age >= 70) return '70~74세';
    if (age >= 65) return '65~69세';
    if (age >= 60) return '60~64세';
    return '60세 미만';
  };

  const filteredCases = cases
    .filter((c) => {
      const ageRangeLabel = getAgeRangeLabel(c.age);
      const matchesSearch =
        c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ageRangeLabel.includes(searchTerm);
      const matchesRisk = riskFilter === 'all' || c.riskLevel === riskFilter;
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesCounselor = counselorFilter === 'all' || c.counselor === counselorFilter;
      const matchesFavorite = !showFavoritesOnly || favorites.has(c.id);
      return matchesSearch && matchesRisk && matchesStatus && matchesCounselor && matchesFavorite;
    })
    .map((c) => ({ ...c, isFavorite: favorites.has(c.id), ageRangeLabel: getAgeRangeLabel(c.age) }));

  const urgentTasks = tasks.filter((t) => t.priority === 'urgent');
  const todayTasks = tasks.filter((t) => t.priority === 'today');
  const normalTasks = tasks.filter((t) => t.priority === 'normal');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">케이스 관리 대시보드</h1>
        <p className="text-gray-500 mt-1">대상자들의 케이스를 관리하고 일정을 조율합니다</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">전체 케이스</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{cases.length}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">고위험군</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {cases.filter((c) => c.riskLevel === 'high').length}
                </p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">미접촉</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {cases.filter((c) => c.status === 'not_contacted').length}
                </p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <Phone className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">오늘 할 일</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {urgentTasks.length + todayTasks.length}
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Case List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="케이스 ID 또는 연령대 범위로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="위험도" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="high">높음</SelectItem>
                      <SelectItem value="medium">보통</SelectItem>
                      <SelectItem value="low">양호</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="상태" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="not_contacted">미접촉</SelectItem>
                      <SelectItem value="contacted">접촉완료</SelectItem>
                      <SelectItem value="consultation_complete">상담완료</SelectItem>
                      <SelectItem value="appointment_scheduled">예약완료</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => setFilterDialogOpen(true)}>
                    <Filter className="h-4 w-4 mr-2" />
                    필터
                  </Button>
                  <Button
                    variant={showFavoritesOnly ? 'default' : 'outline'}
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  >
                    <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Case Table */}
          <Card>
            <CardHeader>
              <CardTitle>케이스 목록</CardTitle>
              <CardDescription>{filteredCases.length}개의 케이스</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>케이스 ID</TableHead>
                    <TableHead>연령대</TableHead>
                    <TableHead>위험도</TableHead>
                    <TableHead>최근 접촉</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>담당자</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => onCaseSelect(c.id)}
                    >
                      <TableCell>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(c.id);
                          }}
                          className="hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`h-5 w-5 ${
                              c.isFavorite
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">{c.id}</TableCell>
                      <TableCell>{c.ageRangeLabel}</TableCell>
                      <TableCell>{getRiskBadge(c.riskLevel)}</TableCell>
                      <TableCell>
                        {c.lastContact ? new Date(c.lastContact).toLocaleDateString('ko-KR') : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(c.status)}</TableCell>
                      <TableCell>{c.counselor}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Today's Tasks */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  오늘 할 일
                </CardTitle>
                <Badge variant="destructive">{urgentTasks.length + todayTasks.length}</Badge>
              </div>
              <CardDescription>우선순위별 작업 목록</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="urgent">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="urgent" className="text-xs">
                    긴급 {urgentTasks.length}
                  </TabsTrigger>
                  <TabsTrigger value="today" className="text-xs">
                    오늘 {todayTasks.length}
                  </TabsTrigger>
                  <TabsTrigger value="normal" className="text-xs">
                    일반 {normalTasks.length}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="urgent" className="space-y-3 mt-4">
                  {urgentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 border-2 border-red-200 bg-red-50 rounded-lg cursor-pointer hover:border-red-300"
                      onClick={() => onCaseSelect(task.caseId)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        {getPriorityBadge(task.priority)}
                        <span className="text-xs text-gray-500">{task.type}</span>
                      </div>
                      <h4 className="font-semibold text-sm mb-1">케이스 ID: {task.caseId}</h4>
                      <p className="text-sm text-gray-700 mb-2">{task.title}</p>
                      <p className="text-xs text-gray-600">{task.description}</p>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="today" className="space-y-3 mt-4">
                  {todayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 border border-orange-200 bg-orange-50 rounded-lg cursor-pointer hover:border-orange-300"
                      onClick={() => onCaseSelect(task.caseId)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        {getPriorityBadge(task.priority)}
                        <span className="text-xs text-gray-500">{task.type}</span>
                      </div>
                      <h4 className="font-semibold text-sm mb-1">케이스 ID: {task.caseId}</h4>
                      <p className="text-sm text-gray-700 mb-2">{task.title}</p>
                      <p className="text-xs text-gray-600">{task.description}</p>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="normal" className="space-y-3 mt-4">
                  {normalTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 border border-blue-200 bg-blue-50 rounded-lg cursor-pointer hover:border-blue-300"
                      onClick={() => onCaseSelect(task.caseId)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        {getPriorityBadge(task.priority)}
                        <span className="text-xs text-gray-500">{task.type}</span>
                      </div>
                      <h4 className="font-semibold text-sm mb-1">케이스 ID: {task.caseId}</h4>
                      <p className="text-sm text-gray-700 mb-2">{task.title}</p>
                      <p className="text-xs text-gray-600">{task.description}</p>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Advanced Filter Dialog */}
      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>고급 필터</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div>
              <Label>담당자</Label>
              <Select value={counselorFilter} onValueChange={setCounselorFilter}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="이상담">이상담</SelectItem>
                  <SelectItem value="김상담">김상담</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>날짜 범위</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" placeholder="시작일" />
                <Input type="date" placeholder="종료일" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>기타 옵션</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="favorite" checked={showFavoritesOnly} onCheckedChange={(checked) => setShowFavoritesOnly(checked as boolean)} />
                  <label htmlFor="favorite" className="text-sm">즐겨찾기만 표시</label>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => {
              setRiskFilter('all');
              setStatusFilter('all');
              setCounselorFilter('all');
              setShowFavoritesOnly(false);
            }}>
              초기화
            </Button>
            <Button className="flex-1" onClick={() => setFilterDialogOpen(false)}>
              적용
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
