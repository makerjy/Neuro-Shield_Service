import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ChangeRequest {
  id: string;
  title: string;
  requestor: string;
  date: string;
  status: 'reviewing' | 'approved' | 'rejected';
  currentRule: string;
  proposedRule: string;
  reason: string;
  sandboxResults: {
    targetIncrease: string;
    workloadIncrease: string;
    slaRisk: string;
    dataQualityImpact: string;
  };
}

const mockRequests: ChangeRequest[] = [
  {
    id: 'CR-2026-003',
    title: 'L2 기준점 조정 (65 → 60)',
    requestor: '이영희 (서울시)',
    date: '2026-01-24',
    status: 'reviewing',
    currentRule: '점수 ≥ 65 → L2',
    proposedRule: '점수 ≥ 60 → L2',
    reason: '최근 3개월 데이터 분석 결과, 60~64점 구간에서 이탈률이 높음(평균 24%). 조기 개입 시 이탈률을 약 15% 감소시킬 수 있을 것으로 예상됨.',
    sandboxResults: {
      targetIncrease: '+8.2%',
      workloadIncrease: '+4.5%',
      slaRisk: '낮음',
      dataQualityImpact: '없음',
    },
  },
  {
    id: 'CR-2026-002',
    title: '재접촉 주기 단축 (7일 → 5일)',
    requestor: '김센터 (강남구)',
    date: '2026-01-20',
    status: 'approved',
    currentRule: '재접촉 주기: 7일',
    proposedRule: '재접촉 주기: 5일',
    reason: 'L3 케이스에서 7일 주기로는 위험 신호를 놓치는 경우가 발생. 5일 주기로 단축하여 조기 대응 가능.',
    sandboxResults: {
      targetIncrease: '+0%',
      workloadIncrease: '+12%',
      slaRisk: '보통',
      dataQualityImpact: '없음',
    },
  },
  {
    id: 'CR-2026-001',
    title: '독거 가중치 증가 (1.2 → 1.5)',
    requestor: '박중앙 (중앙)',
    date: '2026-01-15',
    status: 'rejected',
    currentRule: '독거 가중치: 1.2',
    proposedRule: '독거 가중치: 1.5',
    reason: '독거 노인의 위험도가 과소평가되고 있음. 가중치 증가 필요.',
    sandboxResults: {
      targetIncrease: '+18.5%',
      workloadIncrease: '+22%',
      slaRisk: '높음',
      dataQualityImpact: '없음',
    },
  },
];

function getStatusBadge(status: ChangeRequest['status']) {
  switch (status) {
    case 'reviewing':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-50 text-purple-700 border border-purple-200">
          <Clock className="h-3 w-3 mr-1" />
          검토 중
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-50 text-green-700 border border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          승인됨
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-50 text-red-700 border border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          거부됨
        </span>
      );
  }
}

export function ModelGovernance() {
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(
    mockRequests.find(r => r.status === 'reviewing') || null
  );
  const [approvalNote, setApprovalNote] = useState('');

  const handleApproval = (approved: boolean) => {
    if (!approvalNote.trim()) {
      alert('승인 또는 거부 사유를 입력하세요.');
      return;
    }

    const action = approved ? '승인' : '거부';
    const confirmed = window.confirm(
      `이 변경 요청을 ${action}하시겠습니까?\n\n${action} 후 변경 사항은 ${
        approved ? '전체 시스템에 적용됩니다' : '요청자에게 통보됩니다'
      }.`
    );

    if (confirmed) {
      alert(`변경 요청이 ${action}되었습니다.\n모든 결정은 감사 로그에 기록됩니다.`);
      setApprovalNote('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">모델/규칙 변경 관리</h1>
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            모든 우선순위 할당 규칙, 점검 조건, 모델 기준 변경은
            샌드박스 평가 및 승인 프로세스를 거칩니다.
          </p>
        </div>
      </div>

      {/* Change Request List */}
      <Card>
        <CardHeader>
          <CardTitle>변경 요청 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">요청 ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">제목</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">요청자</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">날짜</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">상태</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">작업</th>
                </tr>
              </thead>
              <tbody>
                {mockRequests.map((request) => (
                  <tr 
                    key={request.id} 
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      selectedRequest?.id === request.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-sm font-mono text-gray-600">{request.id}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{request.title}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{request.requestor}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{request.date}</td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {request.status === 'reviewing' ? '평가 보기' : '상세'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Change Request Detail */}
      {selectedRequest && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Change Details */}
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>{selectedRequest.id}: {selectedRequest.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Change Content */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">변경 내용</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-2">현재 규칙</div>
                    <div className="text-sm font-medium text-gray-900">
                      {selectedRequest.currentRule}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-xs text-blue-600 mb-2">제안 규칙</div>
                    <div className="text-sm font-medium text-blue-900">
                      {selectedRequest.proposedRule}
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Reason */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">변경 사유</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {selectedRequest.reason}
                  </p>
                </div>
              </div>

              {/* Sandbox Evaluation */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">샌드박스 평가 결과</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">대상자 수 변화:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedRequest.sandboxResults.targetIncrease}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">센터 업무량 증가:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedRequest.sandboxResults.workloadIncrease}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">SLA 위반 위험:</span>
                    <span className={`text-sm font-medium ${
                      selectedRequest.sandboxResults.slaRisk === '낮음' ? 'text-green-600' :
                      selectedRequest.sandboxResults.slaRisk === '보통' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {selectedRequest.sandboxResults.slaRisk}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">데이터 품질 영향:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedRequest.sandboxResults.dataQualityImpact}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  샌드박스 평가는 실제 운영 데이터에 영향을 주지 않습니다.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Right: Approval Actions */}
          <Card className="h-fit sticky top-6">
            <CardHeader>
              <CardTitle>승인 작업</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedRequest.status === 'reviewing' ? (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-900">
                        승인 후 변경 사항은 전체 시스템에 적용됩니다.
                        실제 센터 운영에 영향을 미칠 수 있습니다.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      승인/거부 사유 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                      placeholder="승인 또는 거부 사유를 입력하세요."
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Button
                      onClick={() => handleApproval(true)}
                      className="w-full"
                    >
                      변경 승인
                    </Button>
                    <Button
                      onClick={() => handleApproval(false)}
                      variant="outline"
                      className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 border-red-300"
                    >
                      변경 거부
                    </Button>
                  </div>

                  <div className="text-xs text-gray-500 text-center">
                    모든 결정은 감사 로그에 기록됩니다.
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">요청 상태</div>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      이 요청은 이미 처리되었습니다. 상세 내역은 감사 로그에서 확인할 수 있습니다.
                    </p>
                  </div>

                  <Button variant="outline" className="w-full">
                    감사 로그 보기
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
