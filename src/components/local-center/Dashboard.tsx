import React from 'react';
import { Calendar, Clock, Users, CheckCircle, AlertCircle, TrendingUp, Phone, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Progress } from '../ui/progress';

interface DashboardProps {
  userRole: 'counselor' | 'center_manager';
}

export function Dashboard({ userRole }: DashboardProps) {
  // Mock data
  const stats = [
    {
      title: '오늘 예약',
      value: '8',
      change: '+2',
      changeType: 'increase' as const,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: '대기 중',
      value: '12',
      change: '+5',
      changeType: 'increase' as const,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: '이번 주 상담',
      value: '34',
      change: '+8',
      changeType: 'increase' as const,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: '총 시민',
      value: '156',
      change: '+12',
      changeType: 'increase' as const,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  const todayAppointments = [
    {
      id: 'APT-001',
      citizenName: '김민수',
      time: '10:00',
      status: 'confirmed' as const,
      type: '초기 상담',
      duration: '60분',
    },
    {
      id: 'APT-002',
      citizenName: '이영희',
      time: '11:30',
      status: 'confirmed' as const,
      type: '재상담',
      duration: '45분',
    },
    {
      id: 'APT-003',
      citizenName: '박철수',
      time: '14:00',
      status: 'pending' as const,
      type: '초기 상담',
      duration: '60분',
    },
    {
      id: 'APT-004',
      citizenName: '정수진',
      time: '15:30',
      status: 'confirmed' as const,
      type: '후속 상담',
      duration: '30분',
    },
  ];

  const pendingApprovals = [
    {
      id: 'REQ-101',
      citizenName: '최지우',
      requestDate: '2026-02-02',
      preferredDate: '2026-02-05',
      preferredTime: '14:00',
      status: 'pending' as const,
    },
    {
      id: 'REQ-102',
      citizenName: '강동원',
      requestDate: '2026-02-02',
      preferredDate: '2026-02-04',
      preferredTime: '10:00',
      status: 'pending' as const,
    },
    {
      id: 'REQ-103',
      citizenName: '한소희',
      requestDate: '2026-02-01',
      preferredDate: '2026-02-06',
      preferredTime: '16:00',
      status: 'pending' as const,
    },
  ];

  const getStatusBadge = (status: 'confirmed' | 'pending' | 'completed' | 'cancelled') => {
    const variants = {
      confirmed: { variant: 'default' as const, label: '확정' },
      pending: { variant: 'secondary' as const, label: '대기' },
      completed: { variant: 'outline' as const, label: '완료' },
      cancelled: { variant: 'destructive' as const, label: '취소' },
    };
    const { variant, label } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">오늘의 일정과 대기 중인 작업을 확인하세요</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">{stat.change}</span>
                      <span className="text-xs text-gray-500">지난주 대비</span>
                    </div>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-lg`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Compliance Notice */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">의료 상담 제한 안내</p>
            <p className="text-xs text-blue-700 mt-1">
              본 센터는 정신건강 예방 및 지원 서비스를 제공하며, 의료 진단 및 치료는 제공하지 않습니다. 
              응급 상황 시 정신건강위기상담전화 ☎1577-0199 또는 응급실 방문을 안내해 주세요.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>오늘의 상담 일정</CardTitle>
                <CardDescription className="mt-1">2026년 2월 2일 (월)</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                전체 보기
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todayAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {appointment.citizenName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">{appointment.citizenName}</p>
                      {getStatusBadge(appointment.status)}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {appointment.time}
                      </span>
                      <span>•</span>
                      <span>{appointment.type}</span>
                      <span>•</span>
                      <span>{appointment.duration}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>승인 대기 중인 예약</CardTitle>
                <CardDescription className="mt-1">{pendingApprovals.length}건의 예약 요청</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                전체 보기
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingApprovals.map((request) => (
                <div
                  key={request.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{request.citizenName}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        요청일: {new Date(request.requestDate).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <Badge variant="secondary">대기</Badge>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg mb-3">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">희망 일시:</span>{' '}
                      {new Date(request.preferredDate).toLocaleDateString('ko-KR')}{' '}
                      {request.preferredTime}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1">
                      승인
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      거절
                    </Button>
                    <Button size="sm" variant="outline">
                      상세
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      {userRole === 'center_manager' && (
        <Card>
          <CardHeader>
            <CardTitle>이번 주 성과</CardTitle>
            <CardDescription>2026년 1월 27일 - 2월 2일</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">상담 완료율</span>
                  <span className="text-sm font-medium text-gray-900">85%</span>
                </div>
                <Progress value={85} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">예약 승인율</span>
                  <span className="text-sm font-medium text-gray-900">92%</span>
                </div>
                <Progress value={92} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">평균 응답 시간</span>
                  <span className="text-sm font-medium text-gray-900">2.3시간</span>
                </div>
                <Progress value={70} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
