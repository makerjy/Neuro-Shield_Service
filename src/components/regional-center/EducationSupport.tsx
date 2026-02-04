import React, { useState } from 'react';
import {
  GraduationCap,
  Users,
  Settings,
  Download,
  ChevronRight,
  FileText,
  CheckCircle,
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

type Priority = 'high' | 'medium' | 'low';

interface CenterIntervention {
  id: string;
  centerName: string;
  district: string;
  weakKPIs: string[];
  recommendedTraining: string;
  recommendedStaffing: string;
  priority: Priority;
}

interface InterventionProgram {
  id: string;
  number: number;
  name: string;
  description: string;
  highlighted?: boolean;
}

interface EducationSupportProps {
  centerId?: string | null;
  onNavigateToBottleneck?: () => void;
}

export function EducationSupport({ centerId, onNavigateToBottleneck }: EducationSupportProps) {
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<CenterIntervention | null>(null);

  // Summary Data
  const summaryData = {
    educationNeeded: 3,
    staffingNeeded: 1,
    processImprovement: 2,
  };

  // Center Interventions Data
  const centerInterventions: CenterIntervention[] = [
    {
      id: 'CENTER-001',
      centerName: '송파구 치매안심센터',
      district: '송파구',
      weakKPIs: ['이탈률', '접촉률'],
      recommendedTraining: '초기 상담 기술 강화, 재접촉 프로토콜 교육',
      recommendedStaffing: '상담사 1명 단기 파견 (2주), 인력풀 재배치',
      priority: 'high',
    },
    {
      id: 'CENTER-002',
      centerName: '강남구 치매안심센터',
      district: '강남구',
      weakKPIs: ['연계 지연', '노쇼율'],
      recommendedTraining: '예약 관리 시스템 활용 교육, 리마인더 프로세스',
      recommendedStaffing: '현 인력 충분, 워크로드 재분배 권장',
      priority: 'medium',
    },
    {
      id: 'CENTER-003',
      centerName: '서초구 치매안심센터',
      district: '서초구',
      weakKPIs: ['노쇼율'],
      recommendedTraining: '예약 확인 절차 강화 교육',
      recommendedStaffing: '인력 증원 불필요',
      priority: 'medium',
    },
    {
      id: 'CENTER-004',
      centerName: '강동구 치매안심센터',
      district: '강동구',
      weakKPIs: ['우수'],
      recommendedTraining: '우수사례 문서화 및 타 센터 공유',
      recommendedStaffing: '해당없음',
      priority: 'low',
    },
  ];

  // Intervention Programs
  const interventionPrograms: InterventionProgram[] = [
    {
      id: 'PROG-001',
      number: 1,
      name: '송파구 집중 지원 패키지',
      description: '상담사 1명 단기 파견 + 초기 상담 집중 교육 (2일) + 재접촉 프로세스 단축',
      highlighted: true,
    },
    {
      id: 'PROG-002',
      number: 2,
      name: '강남·서초구 예약 관리 개선 프로그램',
      description: '예약 관리 시스템 활용 교육 (1일) + 리마인더 자동화 도입',
      highlighted: false,
    },
    {
      id: 'PROG-003',
      number: 3,
      name: '강동구 우수사례 확산 프로젝트',
      description: '우수 상담 프로세스 문서화 + 타 센터 순회 교육 실시',
      highlighted: false,
    },
  ];

  const getPriorityColor = (priority: Priority) => {
    return {
      high: 'bg-red-50 text-red-800 border-red-300',
      medium: 'bg-yellow-50 text-yellow-800 border-yellow-300',
      low: 'bg-green-50 text-green-800 border-green-300',
    }[priority];
  };

  const getPriorityText = (priority: Priority) => {
    return {
      high: '높음',
      medium: '중간',
      low: '낮음',
    }[priority];
  };

  const handleActionPlan = (center: CenterIntervention) => {
    setSelectedCenter(center);
    setPlanDialogOpen(true);
  };

  const handleExportPlan = () => {
    console.log('[AUDIT] Education Support Plan Export:', {
      action: 'EDUCATION_PLAN_EXPORT',
      timestamp: new Date().toISOString(),
    });
    alert('교육/인력 계획서가 내보내기 되었습니다.');
  };

  const handleApproveProgram = (programId: string) => {
    console.log('[AUDIT] Intervention Program Approved:', {
      action: 'PROGRAM_APPROVE',
      programId,
      timestamp: new Date().toISOString(),
    });
    alert('개입 프로그램이 승인되었습니다. 담당자에게 일정이 통보됩니다.');
  };

  return (
    <div className="h-full overflow-auto bg-white">
      {/* Header */}
      <div className="border-b-2 border-gray-900 bg-white">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">교육 & 인력 권장사항</h1>
              <p className="text-sm text-gray-600 mt-1">
                병목 센터 개입 우선순위 및 지원 계획 관리
              </p>
            </div>
            <Button variant="outline" onClick={handleExportPlan}>
              <Download className="h-4 w-4 mr-2" />
              계획서 내보내기
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Summary Cards */}
        <section className="mb-8">
          <div className="grid grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white border-2 border-gray-200 rounded p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-600 mb-1">교육 필요 센터</div>
                  <div className="text-4xl font-bold text-gray-900">{summaryData.educationNeeded}개</div>
                </div>
              </div>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
                중간 우선순위
              </Badge>
            </div>

            {/* Card 2 */}
            <div className="bg-white border-2 border-gray-200 rounded p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-600 mb-1">인력 증원 필요</div>
                  <div className="text-4xl font-bold text-gray-900">{summaryData.staffingNeeded}개</div>
                </div>
              </div>
              <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300">
                높은 우선순위
              </Badge>
            </div>

            {/* Card 3 */}
            <div className="bg-white border-2 border-gray-200 rounded p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-600 mb-1">프로세스 개선</div>
                  <div className="text-4xl font-bold text-gray-900">{summaryData.processImprovement}개</div>
                </div>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-800 border-green-300">
                낮은 우선순위
              </Badge>
            </div>
          </div>
        </section>

        {/* Center Interventions Table */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-900">
            센터별 권장 개입
          </h2>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left py-3 px-2 text-sm font-bold text-gray-900 w-40">센터</th>
                <th className="text-left py-3 px-2 text-sm font-bold text-gray-900 w-32">약한 KPI</th>
                <th className="text-left py-3 px-2 text-sm font-bold text-gray-900">권장 교육</th>
                <th className="text-left py-3 px-2 text-sm font-bold text-gray-900">권장 인력 조치</th>
                <th className="text-center py-3 px-2 text-sm font-bold text-gray-900 w-24">우선순위</th>
                <th className="text-center py-3 px-2 text-sm font-bold text-gray-900 w-40">작업</th>
              </tr>
            </thead>
            <tbody>
              {centerInterventions.map((intervention) => (
                <tr key={intervention.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <div className="font-medium text-gray-900">{intervention.centerName}</div>
                    <div className="text-xs text-gray-500">{intervention.district}</div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex flex-wrap gap-1">
                      {intervention.weakKPIs.map((kpi, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={
                            kpi === '우수'
                              ? 'bg-green-50 text-green-700 border-green-300 text-xs'
                              : 'bg-gray-100 text-gray-700 border-gray-300 text-xs'
                          }
                        >
                          {kpi}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <p className="text-sm text-gray-900">{intervention.recommendedTraining}</p>
                  </td>
                  <td className="py-3 px-2">
                    <p className="text-sm text-gray-900">{intervention.recommendedStaffing}</p>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Badge variant="outline" className={getPriorityColor(intervention.priority)}>
                      {getPriorityText(intervention.priority)}
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {intervention.priority === 'high' && (
                      <Button size="sm" onClick={() => handleActionPlan(intervention)}>
                        조치 계획 수립
                      </Button>
                    )}
                    {intervention.priority === 'medium' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActionPlan(intervention)}
                      >
                        검토
                      </Button>
                    )}
                    {intervention.priority === 'low' && (
                      <button
                        className="text-sm text-blue-600 hover:underline"
                        onClick={() => handleActionPlan(intervention)}
                      >
                        우수 사례 문서화
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
            <strong>분석 기준:</strong> 최근 2개월 KPI 데이터, 인력 현황, 병목 분석 결과 종합 | 
            <strong className="ml-3">업데이트:</strong> 매주 월요일 09:00 | 
            <strong className="ml-3">담당:</strong> 김행정 (광역센터장)
          </div>
        </section>

        {/* Intervention Programs */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-900">
            제안된 개입 프로그램
          </h2>

          <div className="space-y-4">
            {interventionPrograms.map((program) => (
              <div
                key={program.id}
                className={`border-2 rounded p-6 ${
                  program.highlighted
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                        program.highlighted
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {program.number}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-2 text-lg">{program.name}</h3>
                    <p className="text-gray-700 mb-4">{program.description}</p>
                    <div className="flex items-center gap-2">
                      {program.highlighted ? (
                        <>
                          <Button onClick={() => handleApproveProgram(program.id)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            승인 및 시작
                          </Button>
                          <Button variant="outline">
                            <FileText className="h-4 w-4 mr-2" />
                            상세 계획 보기
                          </Button>
                        </>
                      ) : program.number === 2 ? (
                        <Button variant="outline">
                          일정 조율
                        </Button>
                      ) : (
                        <Button variant="outline">
                          계획 수립
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
            <strong>프로그램 제안 주체:</strong> 광역센터 통합 분석 시스템 (AI 기반 추천) | 
            <strong className="ml-3">승인 권한:</strong> 광역센터장 | 
            <strong className="ml-3">실행 주체:</strong> 각 센터 + 광역센터 지원팀
          </div>
        </section>
      </div>

      {/* Action Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-[800px]">
          <DialogHeader>
            <DialogTitle>조치 계획 수립</DialogTitle>
            <DialogDescription>
              {selectedCenter?.centerName} ({selectedCenter?.district})
            </DialogDescription>
          </DialogHeader>

          {selectedCenter && (
            <div className="py-4 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">약한 KPI</h3>
                <div className="flex gap-2">
                  {selectedCenter.weakKPIs.map((kpi, idx) => (
                    <Badge key={idx} variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                      {kpi}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">권장 교육</h3>
                <p className="text-gray-700 bg-blue-50 border border-blue-200 p-3 rounded">
                  {selectedCenter.recommendedTraining}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">권장 인력 조치</h3>
                <p className="text-gray-700 bg-purple-50 border border-purple-200 p-3 rounded">
                  {selectedCenter.recommendedStaffing}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">우선순위</h3>
                <Badge variant="outline" className={getPriorityColor(selectedCenter.priority)}>
                  {getPriorityText(selectedCenter.priority)}
                </Badge>
              </div>

              <div className="bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
                <strong>참고:</strong> 조치 계획 수립 시 해당 센터 담당자와 사전 협의가 필요하며,
                승인 후 자동으로 일정이 배정됩니다.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              닫기
            </Button>
            <Button onClick={() => {
              console.log('[AUDIT] Action Plan Created:', {
                action: 'ACTION_PLAN_CREATE',
                centerId: selectedCenter?.id,
                timestamp: new Date().toISOString(),
              });
              alert('조치 계획이 수립되었습니다. 담당자에게 통보됩니다.');
              setPlanDialogOpen(false);
            }}>
              계획 확정
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}