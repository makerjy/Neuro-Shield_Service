import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, AlertTriangle, CheckCircle, Download, Filter, Eye } from 'lucide-react';

const violations = [
  {
    date: '2026-01-24',
    center: '강남구 센터',
    type: '권한 없는 PII 접근 시도',
    count: 1,
    status: 'reviewing',
    severity: 'high',
    user: '김상담',
    details: 'L2 권한으로 타 센터 케이스 개인정보 열람 시도'
  },
  {
    date: '2026-01-18',
    center: '서초구 센터',
    type: '타 센터 케이스 접근',
    count: 1,
    status: 'resolved',
    severity: 'medium',
    user: '이센터',
    details: '관할 구역 외 케이스 접근, 시스템 권한 재교육 완료'
  },
  {
    date: '2026-01-15',
    center: '송파구 센터',
    type: 'SLA 기준 위반',
    count: 3,
    status: 'resolved',
    severity: 'low',
    user: '박직원',
    details: '업무 과부하로 인한 지연, 인력 재배치로 해결'
  },
];

const centerOverrideRate = [
  { center: '강남구 센터', rate: 8, status: 'good' },
  { center: '서초구 센터', rate: 12, status: 'good' },
  { center: '송파구 센터', rate: 22, status: 'warning' },
  { center: '관악구 센터', rate: 10, status: 'good' },
  { center: '구로구 센터', rate: 15, status: 'warning' },
  { center: '영등포구 센터', rate: 9, status: 'good' },
];

const complianceChecklist = [
  { item: '위험 점수, 확률 미노출', status: 'pass', description: '시민 화면에서 수치 표현 없음 확인' },
  { item: '진단 관련 용어 미사용', status: 'pass', description: "'진단', '질환', '발병' 등 금지 용어 없음" },
  { item: '목적 제한 명시', status: 'pass', description: '복지 목적 외 사용 금지 안내 포함' },
  { item: '선택적 참여 강조', status: 'pass', description: '시민에게 선택권 강조 문구 적용' },
];

const auditLogs = [
  { 
    timestamp: '2026-01-24 14:32:15', 
    user: '김상담 (강남구)', 
    action: 'PII 접근 시도', 
    resource: 'CASE-2024-1234',
    result: '차단됨',
    ip: '192.168.1.45',
    severity: 'high'
  },
  { 
    timestamp: '2026-01-24 13:15:22', 
    user: '이센터 (중앙)', 
    action: 'KPI 정의 수정', 
    resource: 'KPI-001',
    result: '성공',
    ip: '10.0.1.23',
    severity: 'low'
  },
  { 
    timestamp: '2026-01-24 11:48:30', 
    user: '박관리 (서울시)', 
    action: '권한 변경', 
    resource: 'USER-2024-5678',
    result: '성공',
    ip: '172.16.0.89',
    severity: 'medium'
  },
  { 
    timestamp: '2026-01-24 10:22:18', 
    user: '최담당 (부산시)', 
    action: '케이스 조회', 
    resource: 'CASE-2024-5432',
    result: '성공',
    ip: '203.241.100.12',
    severity: 'low'
  },
  { 
    timestamp: '2026-01-23 16:45:09', 
    user: '정직원 (대구시)', 
    action: '모델 변경 요청', 
    resource: 'CR-2026-003',
    result: '성공',
    ip: '211.234.78.45',
    severity: 'medium'
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'reviewing':
      return <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-orange-50 text-orange-700 border border-orange-200">검토 중</span>;
    case 'resolved':
      return <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-50 text-green-700 border border-green-200">해결됨</span>;
    default:
      return <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-50 text-gray-700 border border-gray-200">{status}</span>;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case 'high':
      return <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-50 text-red-700">높음</span>;
    case 'medium':
      return <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-orange-50 text-orange-700">중간</span>;
    case 'low':
      return <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-50 text-gray-700">낮음</span>;
    default:
      return null;
  }
}

export function ComplianceAudit() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">규정 준수 및 감사</h1>
          <p className="text-sm text-gray-500 mt-1">
            시스템 접근 이력 및 규정 위반 모니터링
          </p>
        </div>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          감사 보고서 내보내기
        </Button>
      </div>

      {/* Violations */}
      <Card>
        <CardHeader>
          <CardTitle>규정 위반 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">날짜</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">센터</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">위반 유형</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">건수</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">심각도</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">조치 상태</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">작업</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((violation, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600">{violation.date}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{violation.center}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{violation.type}</td>
                    <td className="py-3 px-4 text-sm text-center text-gray-900">{violation.count}</td>
                    <td className="py-3 px-4 text-center">
                      {getSeverityBadge(violation.severity)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(violation.status)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 mx-auto">
                        <Eye className="h-4 w-4" />
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {violations.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              위반 내역이 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Center Override Rate */}
      <Card>
        <CardHeader>
          <CardTitle>센터별 수동 변경률</CardTitle>
          <p className="text-sm text-gray-500">
            시스템 권장 대비 수동 변경 비율. 높은 비율은 규칙 재검토를 시사할 수 있습니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {centerOverrideRate.map((center, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-32 text-sm text-gray-900">{center.center}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full flex items-center justify-end pr-2 text-xs font-medium text-white ${
                      center.rate <= 15 ? 'bg-green-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${Math.min(center.rate * 4, 100)}%` }}
                  >
                    {center.rate > 5 && `${center.rate}%`}
                  </div>
                </div>
                <div className="w-16 text-right text-sm font-medium text-gray-900">
                  {center.rate}%
                </div>
                <div className="w-16 text-right">
                  {center.status === 'good' ? (
                    <span className="text-xs text-green-600">양호</span>
                  ) : (
                    <span className="text-xs text-orange-600">검토</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>목표:</strong> 15% 이하. 송파구 센터, 구로구 센터는 규칙 적합성 검토 권장.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Citizen-facing Compliance Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>시민 대상 표현 준수 체크리스트</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {complianceChecklist.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{item.item}</div>
                  <div className="text-xs text-gray-600 mt-1">{item.description}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">
                  준수
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>시스템 감사 로그</CardTitle>
              <p className="text-sm text-gray-500 mt-1">모든 주요 시스템 활동 기록</p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="사용자, 작업, 리소스 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                필터
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">시간</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">사용자</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">작업</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">리소스</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">결과</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">IP 주소</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">심각도</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-xs font-mono text-gray-600">{log.timestamp}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{log.user}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{log.action}</td>
                    <td className="py-3 px-4 text-sm font-mono text-gray-600">{log.resource}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                        log.result === '성공' 
                          ? 'bg-green-50 text-green-700' 
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {log.result}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-600">{log.ip}</td>
                    <td className="py-3 px-4 text-center">
                      {getSeverityBadge(log.severity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              총 {filteredLogs.length}개 항목 표시
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">이전</Button>
              <Button variant="outline" size="sm">다음</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Policies */}
      <Card>
        <CardHeader>
          <CardTitle>보안 정책 문서</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: '개인정보 처리 방침', date: '2026-01-01', version: 'v3.0' },
              { name: '데이터 접근 권한 정책', date: '2025-12-15', version: 'v2.1' },
              { name: '감사 로그 보관 정책', date: '2025-11-20', version: 'v1.5' },
              { name: 'AI 모델 거버넌스 규정', date: '2025-10-10', version: 'v2.0' },
            ].map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                  <div className="text-xs text-gray-500">
                    최종 수정: {doc.date} • {doc.version}
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  다운로드
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
