import React, { useState } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  ChevronRight,
  Users,
  Clock,
  Activity,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';

interface BottleneckAnalysisProps {
  onNavigateToSupport?: (centerId: string) => void;
}

type IssueStatus = 'planned' | 'confirmed' | 'in_progress' | 'completed';
type IssueSeverity = 'normal' | 'caution' | 'critical';
type IssueType = 'consultation_delay' | 'dropout_increase' | 'referral_decrease' | 'staffing_gap';

interface CenterBottleneck {
  id: string;
  centerName: string;
  district: string;
  status: IssueSeverity;
  primaryIssue: IssueType;
  kpiChanges: {
    contactSuccess: number;
    consultationCompletion: number;
    dropoutRate: number;
    referralRate: number;
  };
  rootCause: string;
  rootCauseCode: string;
  affectedCases: number;
  estimatedLoss: number;
  recommendedAction: string;
  actionStatus: IssueStatus;
  assignee: string;
  lastUpdated: string;
}

export function BottleneckAnalysis({ onNavigateToSupport }: BottleneckAnalysisProps) {
  const [selectedCenter, setSelectedCenter] = useState<CenterBottleneck | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Mock Bottleneck Data
  const bottlenecks: CenterBottleneck[] = [
    {
      id: 'CENTER-001',
      centerName: '송파구 치매안심센터',
      district: '송파구',
      status: 'critical',
      primaryIssue: 'dropout_increase',
      kpiChanges: {
        contactSuccess: -3.2,
        consultationCompletion: -8.5,
        dropoutRate: +12.9,
        referralRate: -5.1,
      },
      rootCause: '인력 공백 (상담사 2명 휴직)',
      rootCauseCode: 'RC001',
      affectedCases: 98,
      estimatedLoss: 156,
      recommendedAction: '타센터 인력 파견 (단기), 재연락 프로세스 단축, 집중 모니터링',
      actionStatus: 'planned',
      assignee: '홍길동',
      lastUpdated: '2026-02-03',
    },
    {
      id: 'CENTER-002',
      centerName: '강남구 치매안심센터',
      district: '강남구',
      status: 'caution',
      primaryIssue: 'consultation_delay',
      kpiChanges: {
        contactSuccess: +1.2,
        consultationCompletion: -4.3,
        dropoutRate: +3.5,
        referralRate: -2.1,
      },
      rootCause: '신규 케이스 급증 (전월 대비 +45%)',
      rootCauseCode: 'RC002',
      affectedCases: 156,
      estimatedLoss: 89,
      recommendedAction: '워크로드 재분배, 상담 프로토콜 최적화, 우선순위 재조정',
      actionStatus: 'in_progress',
      assignee: '김영희',
      lastUpdated: '2026-02-02',
    },
    {
      id: 'CENTER-003',
      centerName: '서초구 치매안심센터',
      district: '서초구',
      status: 'caution',
      primaryIssue: 'referral_decrease',
      kpiChanges: {
        contactSuccess: +0.5,
        consultationCompletion: -2.1,
        dropoutRate: +1.8,
        referralRate: -6.7,
      },
      rootCause: '재접촉 실패 증가, 상담 스크립트 미준수',
      rootCauseCode: 'RC003',
      affectedCases: 67,
      estimatedLoss: 43,
      recommendedAction: '초기 상담 교육 강화, 상담사 재교육, 우수사례 공유',
      actionStatus: 'confirmed',
      assignee: '이철수',
      lastUpdated: '2026-02-01',
    },
    {
      id: 'CENTER-004',
      centerName: '강동구 치매안심센터',
      district: '강동구',
      status: 'normal',
      primaryIssue: 'consultation_delay',
      kpiChanges: {
        contactSuccess: +2.1,
        consultationCompletion: +1.5,
        dropoutRate: -0.8,
        referralRate: +1.2,
      },
      rootCause: '해당없음',
      rootCauseCode: '-',
      affectedCases: 0,
      estimatedLoss: 0,
      recommendedAction: '정상 운영 중 (지속 모니터링)',
      actionStatus: 'completed',
      assignee: '박민수',
      lastUpdated: '2026-02-04',
    },
  ];

  const getStatusColor = (status: IssueSeverity) => {
    return {
      normal: 'bg-green-50 text-green-800 border-green-300',
      caution: 'bg-yellow-50 text-yellow-800 border-yellow-300',
      critical: 'bg-red-50 text-red-800 border-red-300',
    }[status];
  };

  const getIssueTypeText = (type: IssueType) => {
    return {
      consultation_delay: '상담 지연',
      dropout_increase: '이탈 증가',
      referral_decrease: '연계 감소',
      staffing_gap: '인력 공백',
    }[type];
  };

  const getActionStatusText = (status: IssueStatus) => {
    return {
      planned: '계획수립',
      confirmed: '계획확정',
      in_progress: '시행중',
      completed: '완료',
    }[status];
  };

  const getActionStatusColor = (status: IssueStatus) => {
    return {
      planned: 'bg-gray-100 text-gray-800 border-gray-300',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
    }[status];
  };

  const handleViewDetail = (center: CenterBottleneck) => {
    setSelectedCenter(center);
    setDetailDialogOpen(true);
  };

  const handleExportReport = (centerId: string) => {
    console.log('[AUDIT] Bottleneck Report Export:', {
      action: 'BOTTLENECK_REPORT_EXPORT',
      centerId,
      timestamp: new Date().toISOString(),
    });
    alert('병목 분석 보고서가 생성되었습니다.');
  };

  return (
    <div className="h-full overflow-auto bg-white">
      {/* Header */}
      <div className="border-b-2 border-gray-900 bg-white">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">병목 분석</h1>
              <p className="text-sm text-gray-600 mt-1">
                성과 저조, 병목 구간, 이슈 발생 센터의 원인·영향·대응 가이드
              </p>
            </div>
            <Button variant="outline" onClick={() => handleExportReport('ALL')}>
              <Download className="h-4 w-4 mr-2" />
              전체 보고서 내보내기
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-900">
            센터별 병목 현황
          </h2>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left py-3 px-2 text-sm font-bold text-gray-900 w-32">센터명</th>
                <th className="text-center py-3 px-2 text-sm font-bold text-gray-900 w-20">상태</th>
                <th className="text-left py-3 px-2 text-sm font-bold text-gray-900 w-24">주요 이슈</th>
                <th className="text-left py-3 px-2 text-sm font-bold text-gray-900">KPI 변화 (2개월)</th>
                <th className="text-left py-3 px-2 text-sm font-bold text-gray-900">주요 원인</th>
                <th className="text-center py-3 px-2 text-sm font-bold text-gray-900 w-20">영향</th>
                <th className="text-center py-3 px-2 text-sm font-bold text-gray-900 w-20">손실</th>
                <th className="text-left py-3 px-2 text-sm font-bold text-gray-900">권장 조치</th>
                <th className="text-center py-3 px-2 text-sm font-bold text-gray-900 w-24">조치상태</th>
                <th className="text-center py-3 px-2 text-sm font-bold text-gray-900 w-24">작업</th>
              </tr>
            </thead>
            <tbody>
              {bottlenecks.map((bottleneck) => (
                <tr key={bottleneck.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <div className="font-medium text-gray-900">{bottleneck.centerName}</div>
                    <div className="text-xs text-gray-500">{bottleneck.district}</div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Badge variant="outline" className={getStatusColor(bottleneck.status)}>
                      {bottleneck.status === 'normal' ? '정상' : bottleneck.status === 'caution' ? '주의' : '심각'}
                    </Badge>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-sm text-gray-900">{getIssueTypeText(bottleneck.primaryIssue)}</span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                      {/* Mini Sparkline */}
                      <div className="flex items-end gap-px h-8">
                        <div
                          className={`w-1.5 ${bottleneck.kpiChanges.contactSuccess >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                          style={{ height: `${Math.min(Math.abs(bottleneck.kpiChanges.contactSuccess) * 3, 32)}px` }}
                          title={`접촉: ${bottleneck.kpiChanges.contactSuccess > 0 ? '+' : ''}${bottleneck.kpiChanges.contactSuccess}%`}
                        />
                        <div
                          className={`w-1.5 ${bottleneck.kpiChanges.consultationCompletion >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                          style={{ height: `${Math.min(Math.abs(bottleneck.kpiChanges.consultationCompletion) * 3, 32)}px` }}
                          title={`상담: ${bottleneck.kpiChanges.consultationCompletion > 0 ? '+' : ''}${bottleneck.kpiChanges.consultationCompletion}%`}
                        />
                        <div
                          className={`w-1.5 ${bottleneck.kpiChanges.dropoutRate <= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                          style={{ height: `${Math.min(Math.abs(bottleneck.kpiChanges.dropoutRate) * 3, 32)}px` }}
                          title={`이탈: ${bottleneck.kpiChanges.dropoutRate > 0 ? '+' : ''}${bottleneck.kpiChanges.dropoutRate}%`}
                        />
                        <div
                          className={`w-1.5 ${bottleneck.kpiChanges.referralRate >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                          style={{ height: `${Math.min(Math.abs(bottleneck.kpiChanges.referralRate) * 3, 32)}px` }}
                          title={`연계: ${bottleneck.kpiChanges.referralRate > 0 ? '+' : ''}${bottleneck.kpiChanges.referralRate}%`}
                        />
                      </div>
                      <div className="text-xs text-gray-600">
                        이탈 {bottleneck.kpiChanges.dropoutRate > 0 ? '+' : ''}{bottleneck.kpiChanges.dropoutRate}%
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="text-sm text-gray-900">{bottleneck.rootCause}</div>
                    <div className="text-xs text-gray-500">{bottleneck.rootCauseCode}</div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="font-semibold text-gray-900">{bottleneck.affectedCases}</span>
                    <span className="text-xs text-gray-500">건</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="font-semibold text-red-700">{bottleneck.estimatedLoss}</span>
                    <span className="text-xs text-gray-500">건</span>
                  </td>
                  <td className="py-3 px-2">
                    <p className="text-sm text-gray-900 line-clamp-2">{bottleneck.recommendedAction}</p>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Badge variant="outline" className={getActionStatusColor(bottleneck.actionStatus)}>
                      {getActionStatusText(bottleneck.actionStatus)}
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetail(bottleneck)}
                      >
                        상세
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportReport(bottleneck.id)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
            <strong>분석 기준:</strong> 최근 2개월 KPI 변화율, 전국/시도 평균 대비 편차 | 
            <strong className="ml-3">갱신:</strong> 매일 오전 9시 | 
            <strong className="ml-3">담당:</strong> 김행정 (광역센터장) | 
            <strong className="ml-3">총 {bottlenecks.length}개 센터 모니터링 중</strong>
          </div>
        </section>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-[900px]">
          <DialogHeader>
            <DialogTitle>센터 병목 상세 분석</DialogTitle>
            <DialogDescription>
              {selectedCenter?.centerName} ({selectedCenter?.district})
            </DialogDescription>
          </DialogHeader>

          {selectedCenter && (
            <div className="py-4 space-y-6">
              {/* Status Overview */}
              <div className="grid grid-cols-3 gap-4">
                <div className="border-l-4 border-red-600 pl-3">
                  <div className="text-sm text-gray-600 mb-1">상태</div>
                  <Badge variant="outline" className={getStatusColor(selectedCenter.status)}>
                    {selectedCenter.status === 'normal' ? '정상' : selectedCenter.status === 'caution' ? '주의' : '심각'}
                  </Badge>
                </div>
                <div className="border-l-4 border-orange-600 pl-3">
                  <div className="text-sm text-gray-600 mb-1">영향 케이스</div>
                  <div className="text-2xl font-bold text-orange-600">{selectedCenter.affectedCases}건</div>
                </div>
                <div className="border-l-4 border-purple-600 pl-3">
                  <div className="text-sm text-gray-600 mb-1">추정 손실</div>
                  <div className="text-2xl font-bold text-purple-600">{selectedCenter.estimatedLoss}건</div>
                </div>
              </div>

              {/* KPI Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">KPI 변화 상세</h3>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="py-2 text-gray-600">접촉 성공률</td>
                      <td className="py-2 text-right font-semibold">
                        <span className={selectedCenter.kpiChanges.contactSuccess >= 0 ? 'text-green-700' : 'text-red-700'}>
                          {selectedCenter.kpiChanges.contactSuccess > 0 ? '+' : ''}{selectedCenter.kpiChanges.contactSuccess}%p
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-600">상담 완료율</td>
                      <td className="py-2 text-right font-semibold">
                        <span className={selectedCenter.kpiChanges.consultationCompletion >= 0 ? 'text-green-700' : 'text-red-700'}>
                          {selectedCenter.kpiChanges.consultationCompletion > 0 ? '+' : ''}{selectedCenter.kpiChanges.consultationCompletion}%p
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-600">이탈률</td>
                      <td className="py-2 text-right font-semibold">
                        <span className={selectedCenter.kpiChanges.dropoutRate <= 0 ? 'text-green-700' : 'text-red-700'}>
                          {selectedCenter.kpiChanges.dropoutRate > 0 ? '+' : ''}{selectedCenter.kpiChanges.dropoutRate}%p
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-600">연계율</td>
                      <td className="py-2 text-right font-semibold">
                        <span className={selectedCenter.kpiChanges.referralRate >= 0 ? 'text-green-700' : 'text-red-700'}>
                          {selectedCenter.kpiChanges.referralRate > 0 ? '+' : ''}{selectedCenter.kpiChanges.referralRate}%p
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Root Cause */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">주요 원인</h3>
                <div className="bg-yellow-50 border border-yellow-200 p-3">
                  <p className="text-gray-900">{selectedCenter.rootCause}</p>
                  <p className="text-xs text-gray-600 mt-1">코드: {selectedCenter.rootCauseCode}</p>
                </div>
              </div>

              {/* Recommended Action */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">권장 조치</h3>
                <div className="bg-blue-50 border border-blue-200 p-3">
                  <p className="text-gray-900">{selectedCenter.recommendedAction}</p>
                </div>
              </div>

              {/* Action Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">조치 상태</h4>
                  <Badge variant="outline" className={getActionStatusColor(selectedCenter.actionStatus)}>
                    {getActionStatusText(selectedCenter.actionStatus)}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">담당자</h4>
                  <p className="text-gray-900">{selectedCenter.assignee}</p>
                </div>
              </div>

              {/* Last Updated */}
              <div className="text-xs text-gray-500 border-t pt-3">
                최종 업데이트: {selectedCenter.lastUpdated} | 분석 시스템: 광역센터 통합 분석 v2.1
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              닫기
            </Button>
            {onNavigateToSupport && selectedCenter && (
              <Button onClick={() => {
                onNavigateToSupport(selectedCenter.id);
                setDetailDialogOpen(false);
              }}>
                지원 계획 수립
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
