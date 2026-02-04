import React, { useState } from 'react';
import { Shield, Eye, FileText, User, Clock, Filter, Search, Download } from 'lucide-react';
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

type AuditActionType =
  | 'pii_access'
  | 'case_view'
  | 'case_edit'
  | 'consultation_create'
  | 'consultation_update'
  | 'appointment_create'
  | 'appointment_cancel'
  | 'report_generate';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditActionType;
  resourceType: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  reason?: string;
}

export function AuditLog({ caseId }: { caseId?: string }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7days');

  // Mock audit log data
  const auditLogs: AuditLogEntry[] = [
    {
      id: 'AUDIT-001',
      timestamp: '2026-02-02T10:30:00',
      userId: 'USER-001',
      userName: '이상담',
      userRole: '상담사',
      action: 'pii_access',
      resourceType: 'case',
      resourceId: 'CASE-2026-001',
      details: '개인정보 열람',
      ipAddress: '192.168.1.100',
      reason: '상담 예약을 위한 연락처 확인',
    },
    {
      id: 'AUDIT-002',
      timestamp: '2026-02-02T09:15:00',
      userId: 'USER-001',
      userName: '이상담',
      userRole: '상담사',
      action: 'consultation_create',
      resourceType: 'consultation',
      resourceId: 'CONS-001',
      details: '상담 기록 작성 (CASE-2026-001)',
      ipAddress: '192.168.1.100',
    },
    {
      id: 'AUDIT-003',
      timestamp: '2026-02-01T16:45:00',
      userId: 'USER-002',
      userName: '김상담',
      userRole: '상담사',
      action: 'pii_access',
      resourceType: 'case',
      resourceId: 'CASE-2026-002',
      details: '개인정보 열람',
      ipAddress: '192.168.1.101',
      reason: '비상 연락처 확인을 위한 열람',
    },
    {
      id: 'AUDIT-004',
      timestamp: '2026-02-01T14:20:00',
      userId: 'USER-001',
      userName: '이상담',
      userRole: '상담사',
      action: 'appointment_create',
      resourceType: 'appointment',
      resourceId: 'APT-001',
      details: '예약 생성 (CASE-2026-001)',
      ipAddress: '192.168.1.100',
    },
    {
      id: 'AUDIT-005',
      timestamp: '2026-02-01T11:00:00',
      userId: 'USER-003',
      userName: '박센터장',
      userRole: '센터장',
      action: 'report_generate',
      resourceType: 'report',
      resourceId: 'REPORT-2026-01',
      details: '월간 보고서 생성',
      ipAddress: '192.168.1.102',
    },
    {
      id: 'AUDIT-006',
      timestamp: '2026-01-31T15:30:00',
      userId: 'USER-002',
      userName: '김상담',
      userRole: '상담사',
      action: 'case_edit',
      resourceType: 'case',
      resourceId: 'CASE-2026-003',
      details: '케이스 정보 수정',
      ipAddress: '192.168.1.101',
    },
  ];

  const getActionInfo = (action: AuditActionType) => {
    const actions = {
      pii_access: { label: 'PII 열람', color: 'bg-red-100 text-red-800', icon: Eye },
      case_view: { label: '케이스 조회', color: 'bg-blue-100 text-blue-800', icon: FileText },
      case_edit: { label: '케이스 수정', color: 'bg-orange-100 text-orange-800', icon: FileText },
      consultation_create: { label: '상담 기록 작성', color: 'bg-green-100 text-green-800', icon: FileText },
      consultation_update: { label: '상담 기록 수정', color: 'bg-yellow-100 text-yellow-800', icon: FileText },
      appointment_create: { label: '예약 생성', color: 'bg-purple-100 text-purple-800', icon: Clock },
      appointment_cancel: { label: '예약 취소', color: 'bg-red-100 text-red-800', icon: Clock },
      report_generate: { label: '보고서 생성', color: 'bg-indigo-100 text-indigo-800', icon: FileText },
    };
    return actions[action];
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resourceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesCase = !caseId || log.resourceId === caseId;
    return matchesSearch && matchesAction && matchesCase;
  });

  const handleExportLogs = () => {
    // In a real application, this would export the logs to a file
    console.log('Exporting audit logs...');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6" />
            감사 로그
          </h1>
          <p className="text-gray-500 mt-1">
            모든 시스템 활동이 기록되며 상급기관에서 검토합니다
          </p>
        </div>
        <Button variant="outline" onClick={handleExportLogs}>
          <Download className="h-4 w-4 mr-2" />
          로그 내보내기
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">총 활동</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{auditLogs.length}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">PII 접근</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {auditLogs.filter((l) => l.action === 'pii_access').length}
                </p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <Eye className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">상담 기록</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {auditLogs.filter((l) => l.action === 'consultation_create').length}
                </p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">예약 생성</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {auditLogs.filter((l) => l.action === 'appointment_create').length}
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="사용자, 케이스 ID, 활동 내용 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="활동 유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 활동</SelectItem>
                <SelectItem value="pii_access">PII 열람</SelectItem>
                <SelectItem value="consultation_create">상담 기록</SelectItem>
                <SelectItem value="appointment_create">예약 생성</SelectItem>
                <SelectItem value="report_generate">보고서 생성</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="7days">7일</SelectItem>
                <SelectItem value="30days">30일</SelectItem>
                <SelectItem value="all">전체</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>활동 기록</CardTitle>
          <CardDescription>{filteredLogs.length}건의 기록</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>시간</TableHead>
                <TableHead>사용자</TableHead>
                <TableHead>활동</TableHead>
                <TableHead>대상</TableHead>
                <TableHead>상세 내용</TableHead>
                <TableHead>IP 주소</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    검색 결과가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => {
                  const actionInfo = getActionInfo(log.action);
                  const Icon = actionInfo.icon;
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {new Date(log.timestamp).toLocaleDateString('ko-KR')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString('ko-KR')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-sm">{log.userName}</div>
                            <div className="text-xs text-gray-500">{log.userRole}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${actionInfo.color} flex items-center gap-1 w-fit`}>
                          <Icon className="h-3 w-3" />
                          {actionInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.resourceId}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{log.details}</p>
                          {log.reason && (
                            <p className="text-xs text-gray-500 mt-1 italic">
                              사유: {log.reason}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">
                        {log.ipAddress}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
