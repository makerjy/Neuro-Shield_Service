import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, Edit, Trash2, History, Eye } from 'lucide-react';

interface KPI {
  id: string;
  name: string;
  definition: string;
  formula: string;
  dataSource: string;
  reportingCycle: string;
  version: string;
  lastModified: string;
  status: 'active' | 'deprecated';
}

const mockKPIs: KPI[] = [
  {
    id: 'KPI-001',
    name: 'SLA 준수율',
    definition: '정해진 시간 내 케이스 처리 비율',
    formula: '(정시 처리 건수 / 전체 케이스 수) × 100',
    dataSource: '케이스 관리 시스템',
    reportingCycle: '일별',
    version: 'v2.1',
    lastModified: '2026-01-15',
    status: 'active',
  },
  {
    id: 'KPI-002',
    name: '데이터 품질 점수',
    definition: '케이스 데이터의 완전성 및 정확성 지표',
    formula: '(완전한 필드 수 / 전체 필수 필드 수) × 100',
    dataSource: '데이터 검증 시스템',
    reportingCycle: '주별',
    version: 'v1.5',
    lastModified: '2025-12-20',
    status: 'active',
  },
  {
    id: 'KPI-003',
    name: '평균 응답 시간',
    definition: '시민 요청부터 첫 접촉까지 평균 소요 시간',
    formula: 'SUM(응답시간) / 전체 요청 건수',
    dataSource: '예약 관리 시스템',
    reportingCycle: '일별',
    version: 'v1.0',
    lastModified: '2025-11-10',
    status: 'active',
  },
  {
    id: 'KPI-004',
    name: '케이스 해결률',
    definition: '전체 케이스 중 완료 처리된 비율',
    formula: '(완료된 케이스 수 / 전체 케이스 수) × 100',
    dataSource: '케이스 관리 시스템',
    reportingCycle: '주별',
    version: 'v2.0',
    lastModified: '2026-01-05',
    status: 'active',
  },
  {
    id: 'KPI-005',
    name: '위험도 평가 정확도',
    definition: 'AI 모델의 위험도 예측 정확성',
    formula: '(정확한 예측 수 / 전체 평가 수) × 100',
    dataSource: 'AI 평가 시스템',
    reportingCycle: '월별',
    version: 'v3.2',
    lastModified: '2026-01-20',
    status: 'active',
  },
];

const versionHistory = [
  { version: 'v2.1', date: '2026-01-15', author: '김정책', changes: 'SLA 기준 시간 조정 (24시간 → 18시간)' },
  { version: 'v2.0', date: '2025-12-01', author: '이관리', changes: 'SLA 계산 방식 변경 (근무일 기준 → 달력일 기준)' },
  { version: 'v1.5', date: '2025-09-15', author: '박중앙', changes: 'SLA 위반 기준 세분화' },
  { version: 'v1.0', date: '2025-06-01', author: '최초', changes: '최초 정의' },
];

interface KPIDetailModalProps {
  kpi: KPI;
  onClose: () => void;
}

function KPIDetailModal({ kpi, onClose }: KPIDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{kpi.name}</h2>
            <p className="text-sm text-gray-500">{kpi.id} • 버전 {kpi.version}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* KPI Details */}
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">정의</div>
              <div className="text-gray-900">{kpi.definition}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">계산식</div>
              <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-sm text-gray-900">
                {kpi.formula}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">데이터 출처</div>
                <div className="text-gray-900">{kpi.dataSource}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">보고 주기</div>
                <div className="text-gray-900">{kpi.reportingCycle}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">현재 버전</div>
                <div className="text-gray-900">{kpi.version}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">최종 수정일</div>
                <div className="text-gray-900">{kpi.lastModified}</div>
              </div>
            </div>
          </div>

          {/* Version History */}
          <div>
            <div className="text-sm font-medium text-gray-900 mb-3">버전 히스토리</div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-700">버전</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-700">날짜</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-700">수정자</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-700">변경 내용</th>
                  </tr>
                </thead>
                <tbody>
                  {versionHistory.map((version, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="py-2 px-4 text-sm text-gray-900">{version.version}</td>
                      <td className="py-2 px-4 text-sm text-gray-600">{version.date}</td>
                      <td className="py-2 px-4 text-sm text-gray-600">{version.author}</td>
                      <td className="py-2 px-4 text-sm text-gray-600">{version.changes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Applied Centers */}
          <div>
            <div className="text-sm font-medium text-gray-900 mb-3">적용 기관</div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-900">
                이 KPI는 전국 모든 광역센터(17개)와 기초센터(226개)에 적용됩니다.
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            수정
          </Button>
        </div>
      </div>
    </div>
  );
}

export function KPIDictionary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKPI, setSelectedKPI] = useState<KPI | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'deprecated'>('all');

  const filteredKPIs = mockKPIs.filter(kpi => {
    const matchesSearch = 
      kpi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kpi.definition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kpi.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || kpi.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI 사전</h1>
          <p className="text-sm text-gray-500 mt-1">
            전국 정신건강복지센터 핵심성과지표 관리
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          KPI 추가
        </Button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="KPI 이름, 정의, ID로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('all')}
              >
                전체
              </Button>
              <Button
                variant={filterStatus === 'active' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('active')}
              >
                활성
              </Button>
              <Button
                variant={filterStatus === 'deprecated' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('deprecated')}
              >
                비활성
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI List */}
      <Card>
        <CardHeader>
          <CardTitle>KPI 목록 ({filteredKPIs.length}개)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">이름</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">정의</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">데이터 출처</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">보고 주기</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">버전</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredKPIs.map((kpi) => (
                  <tr key={kpi.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600">{kpi.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{kpi.name}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                      {kpi.definition}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{kpi.dataSource}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{kpi.reportingCycle}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                        {kpi.version}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedKPI(kpi)}
                          className="text-blue-600 hover:text-blue-800"
                          title="상세보기"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="text-gray-600 hover:text-gray-800"
                          title="수정"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="text-gray-400 hover:text-red-600"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Version History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>최근 KPI 변경 이력</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { date: '2026-01-20', kpi: 'KPI-005', change: '위험도 평가 정확도 v3.2 업데이트', author: '김정책' },
              { date: '2026-01-15', kpi: 'KPI-001', change: 'SLA 준수율 v2.1 업데이트', author: '김정책' },
              { date: '2026-01-05', kpi: 'KPI-004', change: '케이스 해결률 v2.0 업데이트', author: '이관리' },
              { date: '2025-12-20', kpi: 'KPI-002', change: '데이터 품질 점수 v1.5 업데이트', author: '박중앙' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0">
                <div className="flex-shrink-0 w-24 text-sm text-gray-500">
                  {item.date}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{item.change}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    수정자: {item.author} • {item.kpi}
                  </div>
                </div>
                <History className="h-4 w-4 text-gray-400" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPI Detail Modal */}
      {selectedKPI && (
        <KPIDetailModal 
          kpi={selectedKPI} 
          onClose={() => setSelectedKPI(null)} 
        />
      )}
    </div>
  );
}
