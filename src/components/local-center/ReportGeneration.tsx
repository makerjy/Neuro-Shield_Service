import React, { useState, useRef } from 'react';
import {
  FileText,
  Download,
  Send,
  Upload,
  Edit,
  CheckCircle,
  Clock,
  AlertCircle,
  FileCheck,
  Eye,
  Plus,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
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
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { toast } from 'sonner@2.0.3';

type ReportType = 'weekly' | 'monthly' | 'case' | 'program' | 'budget' | 'issue';
type ReportStatus = 'draft' | 'review' | 'approved' | 'sent' | 'generating';

interface Report {
  id: string;
  title: string;
  type: ReportType;
  period: string;
  generatedDate: string;
  generatedBy: string;
  status: ReportStatus;
  fileSize: string;
  pages: number;
  lastModified?: string;
  uploadedFile?: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  estimatedTime: string;
}

export function ReportGeneration() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Report Templates for Local Center
  const templates: ReportTemplate[] = [
    {
      id: 'TPL-L001',
      name: '주간 운영 보고서',
      description: '주간 상담 실적, 예약 현황, 특이사항 보고',
      type: 'weekly',
      estimatedTime: '약 2분',
    },
    {
      id: 'TPL-L002',
      name: '월간 실적 보고서',
      description: '월간 통계, KPI 달성도, 센터 운영 현황',
      type: 'monthly',
      estimatedTime: '약 3분',
    },
    {
      id: 'TPL-L003',
      name: '상담 사례 보고서',
      description: '고위험 사례, 특이 사례, 성공 사례 보고',
      type: 'case',
      estimatedTime: '약 3분',
    },
    {
      id: 'TPL-L004',
      name: '교육 프로그램 실행 보고서',
      description: '실시한 교육/프로그램 내용 및 참여 현황',
      type: 'program',
      estimatedTime: '약 2분',
    },
    {
      id: 'TPL-L005',
      name: '예산 집행 보고서',
      description: '예산 사용 내역 및 집행률',
      type: 'budget',
      estimatedTime: '약 2분',
    },
    {
      id: 'TPL-L006',
      name: '특이사항/지원요청',
      description: '문제 발생 시 긴급 보고 및 지원 요청',
      type: 'issue',
      estimatedTime: '약 2분',
    },
  ];

  // Report History
  const reports: Report[] = [
    {
      id: 'LRPT-2026-02-W1',
      title: '2026년 2월 1주차 주간 보고서',
      type: 'weekly',
      period: '2026.01.27 - 2026.02.02',
      generatedDate: '2026-02-03 09:00',
      generatedBy: '박상담',
      status: 'draft',
      fileSize: '0.8 MB',
      pages: 5,
      lastModified: '2026-02-03 14:20',
    },
    {
      id: 'LRPT-2026-01',
      title: '2026년 1월 월간 실적 보고서',
      type: 'monthly',
      period: '2026.01.01 - 2026.01.31',
      generatedDate: '2026-02-01 09:30',
      generatedBy: '박상담',
      status: 'review',
      fileSize: '1.5 MB',
      pages: 12,
      uploadedFile: '2026년1월_실적보고_수정본.pdf',
      lastModified: '2026-02-01 16:30',
    },
    {
      id: 'LRPT-2025-12',
      title: '2025년 12월 월간 실적 보고서',
      type: 'monthly',
      period: '2025.12.01 - 2025.12.31',
      generatedDate: '2026-01-02 10:00',
      generatedBy: '박상담',
      status: 'approved',
      fileSize: '1.4 MB',
      pages: 11,
      uploadedFile: '2025년12월_실적보고_최종.pdf',
      lastModified: '2026-01-03 09:00',
    },
    {
      id: 'LRPT-CASE-001',
      title: '고위험 사례 특별 보고',
      type: 'case',
      period: '2026.01.15',
      generatedDate: '2026-01-15 14:00',
      generatedBy: '이상담',
      status: 'sent',
      fileSize: '0.5 MB',
      pages: 3,
      uploadedFile: '고위험사례_C-2026-015.pdf',
      lastModified: '2026-01-15 15:20',
    },
    {
      id: 'LRPT-ISSUE-001',
      title: '인력 부족 지원 요청',
      type: 'issue',
      period: '2026.01.20',
      generatedDate: '2026-01-20 11:00',
      generatedBy: '박상담',
      status: 'sent',
      fileSize: '0.3 MB',
      pages: 2,
      uploadedFile: '인력지원요청_긴급.pdf',
      lastModified: '2026-01-20 11:30',
    },
  ];

  const getTypeLabel = (type: ReportType) => {
    const labels = {
      weekly: '주간',
      monthly: '월간',
      case: '사례',
      program: '프로그램',
      budget: '예산',
      issue: '특이사항',
    };
    return labels[type];
  };

  const getTypeBadgeColor = (type: ReportType) => {
    const colors = {
      weekly: 'bg-blue-50 text-blue-700 border-blue-300',
      monthly: 'bg-purple-50 text-purple-700 border-purple-300',
      case: 'bg-orange-50 text-orange-700 border-orange-300',
      program: 'bg-green-50 text-green-700 border-green-300',
      budget: 'bg-yellow-50 text-yellow-700 border-yellow-300',
      issue: 'bg-red-50 text-red-700 border-red-300',
    };
    return colors[type];
  };

  const getStatusBadge = (status: ReportStatus) => {
    const config = {
      draft: {
        label: '초안',
        color: 'bg-gray-50 text-gray-700 border-gray-300',
        icon: Edit,
      },
      review: {
        label: '광역 검토중',
        color: 'bg-yellow-50 text-yellow-700 border-yellow-300',
        icon: FileCheck,
      },
      approved: {
        label: '광역 승인',
        color: 'bg-blue-50 text-blue-700 border-blue-300',
        icon: CheckCircle,
      },
      sent: {
        label: '광역 전송완료',
        color: 'bg-green-50 text-green-700 border-green-300',
        icon: Send,
      },
      generating: {
        label: '생성 중',
        color: 'bg-orange-50 text-orange-700 border-orange-300',
        icon: Clock,
      },
    };
    return config[status];
  };

  const handleCreateReport = () => {
    if (!selectedTemplate || !selectedPeriod) {
      toast.error('보고서 템플릿과 기간을 선택해주세요');
      return;
    }

    console.log('[AUDIT] Local Center Report Draft Generation:', {
      action: 'LOCAL_REPORT_DRAFT_CREATE',
      template: selectedTemplate,
      period: selectedPeriod,
      timestamp: new Date().toISOString(),
    });

    toast.success('보고서 초안 생성이 시작되었습니다. 완료되면 다운로드하여 수정 후 업로드해주세요.');
    setCreateDialogOpen(false);
    setSelectedTemplate('');
    setSelectedPeriod('');
  };

  const handleDownload = (report: Report) => {
    console.log('[AUDIT] Local Center Report Downloaded:', {
      action: 'LOCAL_REPORT_DOWNLOAD',
      reportId: report.id,
      timestamp: new Date().toISOString(),
    });
    toast.success(`"${report.title}" 보고서 초안을 다운로드합니다.\n\n로컬에서 수정 후 "업로드" 버튼으로 업로드해주세요.`);
  };

  const handleFileUpload = (report: Report) => {
    setSelectedReport(report);
    setUploadDialogOpen(true);
  };

  const handleUploadConfirm = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedReport) {
      console.log('[AUDIT] Local Center Report Uploaded:', {
        action: 'LOCAL_REPORT_UPLOAD',
        reportId: selectedReport.id,
        fileName: file.name,
        fileSize: file.size,
        timestamp: new Date().toISOString(),
      });

      toast.success(`"${file.name}" 파일이 업로드되었습니다.\n보고서 상태가 "광역 검토중"으로 변경됩니다.`);
      setUploadDialogOpen(false);
      setSelectedReport(null);
    }
  };

  const handleSendReport = (report: Report) => {
    setSelectedReport(report);
    setSendDialogOpen(true);
  };

  const handleSendConfirm = () => {
    if (selectedReport) {
      console.log('[AUDIT] Local Center Report Sent to Regional Center:', {
        action: 'LOCAL_REPORT_SEND',
        reportId: selectedReport.id,
        timestamp: new Date().toISOString(),
      });

      toast.success(`"${selectedReport.title}" 보고서가 광역센터로 전송되었습니다.\n전송 내역은 시스템에 기록됩니다.`);
      setSendDialogOpen(false);
      setSelectedReport(null);
    }
  };

  const filteredReports = reports.filter((report) => {
    if (filterType !== 'all' && report.type !== filterType) return false;
    return true;
  });

  return (
    <div className="h-full overflow-auto bg-white">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.hwp,.xlsx"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="border-b-2 border-gray-900 bg-white">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">보고서 관리</h1>
              <p className="text-xs text-gray-600 mt-1">
                초안 생성 → 로컬 수정 → 파일 업로드 → 센터장 검토 → 광역센터 전송
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              새 보고서 생성
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-4">
        {/* Workflow Guide */}
        <section className="mb-6">
          <div className="bg-blue-50 border-2 border-blue-300 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">기초센터 보고서 작성 프로세스</h3>
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
                <span>초안 생성</span>
              </div>
              <span>→</span>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
                <span>다운로드</span>
              </div>
              <span>→</span>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">3</div>
                <span>로컬 수정</span>
              </div>
              <span>→</span>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">4</div>
                <span>업로드</span>
              </div>
              <span>→</span>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">5</div>
                <span>센터장 검토</span>
              </div>
              <span>→</span>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">6</div>
                <span>광역센터 전송</span>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">빠른 생성</h2>
          <div className="grid grid-cols-6 gap-3">
            {templates.map((template) => (
              <button
                key={template.id}
                className="border-2 border-gray-300 p-3 hover:border-blue-600 hover:bg-blue-50 transition-all text-center"
                onClick={() => {
                  setSelectedTemplate(template.id);
                  setCreateDialogOpen(true);
                }}
              >
                <div className="text-xs font-semibold text-gray-900 mb-1">{template.name}</div>
                <Badge variant="outline" className={`${getTypeBadgeColor(template.type)} text-xs`}>
                  {getTypeLabel(template.type)}
                </Badge>
              </button>
            ))}
          </div>
        </section>

        {/* Report History */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">보고서 이력</h2>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="weekly">주간</SelectItem>
                  <SelectItem value="monthly">월간</SelectItem>
                  <SelectItem value="case">사례</SelectItem>
                  <SelectItem value="program">프로그램</SelectItem>
                  <SelectItem value="budget">예산</SelectItem>
                  <SelectItem value="issue">특이사항</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left py-2 px-2 text-xs font-bold text-gray-900">보고서명</th>
                <th className="text-center py-2 px-2 text-xs font-bold text-gray-900 w-20">유형</th>
                <th className="text-center py-2 px-2 text-xs font-bold text-gray-900 w-32">기간</th>
                <th className="text-center py-2 px-2 text-xs font-bold text-gray-900 w-24">작성자</th>
                <th className="text-center py-2 px-2 text-xs font-bold text-gray-900 w-24">상태</th>
                <th className="text-center py-2 px-2 text-xs font-bold text-gray-900 w-40">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => {
                const statusConfig = getStatusBadge(report.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <tr key={report.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <div className="text-sm font-medium text-gray-900">{report.title}</div>
                      <div className="text-xs text-gray-500">
                        {report.status !== 'generating' && `${report.pages}p · ${report.fileSize}`}
                        {report.uploadedFile && ` · ${report.uploadedFile}`}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Badge variant="outline" className={`${getTypeBadgeColor(report.type)} text-xs`}>
                        {getTypeLabel(report.type)}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-center text-xs text-gray-700">
                      {report.period}
                    </td>
                    <td className="py-2 px-2 text-center text-xs text-gray-700">
                      {report.generatedBy}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Badge variant="outline" className={`${statusConfig.color} text-xs`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-center gap-1">
                        {report.status !== 'generating' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleDownload(report)}
                              title="초안 다운로드"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              다운
                            </Button>
                            {report.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleFileUpload(report)}
                                title="수정본 업로드"
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                업로드
                              </Button>
                            )}
                            {(report.status === 'approved' || report.status === 'review') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleSendReport(report)}
                                title="광역센터 전송"
                              >
                                <Send className="h-3 w-3 mr-1" />
                                전송
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredReports.length === 0 && (
            <div className="border-2 border-gray-300 p-6 text-center text-gray-500">
              <FileText className="h-10 w-10 mx-auto mb-2 text-gray-400" />
              <p className="text-xs">조건에 맞는 보고서가 없습니다</p>
            </div>
          )}

          <div className="mt-2 bg-gray-50 border border-gray-200 p-2 text-xs text-gray-600">
            <strong>보고 대상:</strong> 광역 치매안심센터 | 
            <strong className="ml-2">보고 주기:</strong> 주간(매주 월요일), 월간(매월 1일) | 
            <strong className="ml-2">승인 권한:</strong> 센터장 | 
            <strong className="ml-2">전송 이력:</strong> 모두 감사 로그 기록
          </div>
        </section>
      </div>

      {/* Create Report Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-[700px]">
          <DialogHeader>
            <DialogTitle>새 보고서 초안 생성</DialogTitle>
            <DialogDescription>
              시스템이 센터 데이터 기반 초안을 생성합니다. 다운로드 후 수정하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                템플릿 선택
              </label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="템플릿을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({getTypeLabel(template.type)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Template Info */}
            {selectedTemplate && (
              <div className="bg-blue-50 border border-blue-200 p-3 text-xs">
                <div className="font-semibold text-gray-900 mb-1">
                  {templates.find((t) => t.id === selectedTemplate)?.name}
                </div>
                <div className="text-gray-700 mb-2">
                  {templates.find((t) => t.id === selectedTemplate)?.description}
                </div>
                <div className="text-gray-600">
                  예상 시간: {templates.find((t) => t.id === selectedTemplate)?.estimatedTime}
                </div>
              </div>
            )}

            {/* Period Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                보고 기간
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setSelectedPeriod('2026-W05')}
                  className={`border-2 p-2 text-center transition-all text-xs ${
                    selectedPeriod === '2026-W05'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold text-gray-900">이번주</div>
                </button>
                <button
                  onClick={() => setSelectedPeriod('2026-01')}
                  className={`border-2 p-2 text-center transition-all text-xs ${
                    selectedPeriod === '2026-01'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold text-gray-900">이번달</div>
                </button>
                <button
                  onClick={() => setSelectedPeriod('2025-12')}
                  className={`border-2 p-2 text-center transition-all text-xs ${
                    selectedPeriod === '2025-12'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold text-gray-900">지난달</div>
                </button>
                <button
                  onClick={() => setSelectedPeriod('custom')}
                  className={`border-2 p-2 text-center transition-all text-xs ${
                    selectedPeriod === 'custom'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold text-gray-900">직접 선택</div>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateReport}>
              <FileText className="h-4 w-4 mr-2" />
              초안 생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>수정본 파일 업로드</DialogTitle>
            <DialogDescription>
              {selectedReport?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-yellow-50 border border-yellow-300 p-4 text-xs">
              <strong>주의사항:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1 text-gray-700">
                <li>초안을 다운로드하여 로컬에서 수정한 파일만 업로드하세요</li>
                <li>지원 포맷: PDF, DOCX, HWP, XLSX</li>
                <li>파일 크기: 최대 20MB</li>
                <li>업로드 후 센터장 검토를 거쳐 광역센터로 전송됩니다</li>
              </ul>
            </div>

            <div className="border-2 border-dashed border-gray-300 p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm text-gray-700 mb-2">파일을 선택하여 업로드</p>
              <p className="text-xs text-gray-500">PDF, DOCX, HWP, XLSX 형식 지원</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUploadConfirm}>
              <Upload className="h-4 w-4 mr-2" />
              파일 선택
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>광역센터 전송</DialogTitle>
            <DialogDescription>
              {selectedReport?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-blue-50 border border-blue-300 p-4 text-xs">
              <strong>전송 정보:</strong>
              <ul className="mt-2 space-y-1 text-gray-700">
                <li>전송 대상: 관할 광역 치매안심센터</li>
                <li>전송 방법: 보건소 행정망</li>
                <li>전송 일시: {new Date().toLocaleString('ko-KR')}</li>
                <li>전송자: 박상담 (상담사)</li>
                <li>승인자: 김센터장 (센터장)</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-300 p-3 text-xs text-gray-700">
              <strong>확인사항:</strong> 전송 후에는 수정이 불가능합니다. 센터장 승인을 받은 보고서만 전송하세요.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSendConfirm}>
              <Send className="h-4 w-4 mr-2" />
              전송 확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}