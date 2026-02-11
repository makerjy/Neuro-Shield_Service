import React, { useState } from 'react';
import { Plus, Search, Calendar, Clock, FileText, AlertCircle, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription } from '../ui/alert';

interface ConsultationRecord {
  id: string;
  citizenId: string;
  citizenName: string;
  appointmentId: string;
  date: string;
  duration: number;
  counselor: string;
  type: string;
  summary: string;
  notes: string;
  riskLevel: 'low' | 'medium' | 'high';
  followUpNeeded: boolean;
  nextAppointment?: string;
}

export function ConsultationRecords() {
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ConsultationRecord | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    citizenName: '',
    appointmentId: '',
    date: '',
    duration: '',
    type: '',
    summary: '',
    notes: '',
    riskLevel: 'low',
    followUpNeeded: false,
    nextAppointment: '',
  });

  // Mock data
  const records: ConsultationRecord[] = [
    {
      id: 'REC-001',
      citizenId: 'CIT-001',
      citizenName: '김민수',
      appointmentId: 'APT-001',
      date: '2026-02-01',
      duration: 60,
      counselor: '이상담',
      type: '초기 상담',
      summary: '업무 스트레스로 인한 불안 증상 상담',
      notes: '내담자는 최근 3개월간 업무 과중으로 인한 스트레스를 호소함. 수면 장애와 집중력 저하를 경험하고 있으며, 주말에도 업무 걱정으로 휴식이 어려움. 심리교육 제공 및 스트레스 관리 기법 안내. 2주 후 재상담 예정.',
      riskLevel: 'medium',
      followUpNeeded: true,
      nextAppointment: '2026-02-15',
    },
    {
      id: 'REC-002',
      citizenId: 'CIT-003',
      citizenName: '박철수',
      appointmentId: 'APT-003',
      date: '2026-02-03',
      duration: 45,
      counselor: '김상담',
      type: '재상담',
      notes: '이전 상담 이후 수면 패턴이 개선되었다고 보고함. 스트레스 관리 기법을 잘 활용하고 있으며, 전반적인 불안 수준이 감소. 필요시 연락하도록 안내.',
      riskLevel: 'low',
      followUpNeeded: false,
      summary: '수면 패턴 개선 확인, 지속적인 자기관리 권장',
    },
    {
      id: 'REC-003',
      citizenId: 'CIT-005',
      citizenName: '정수진',
      appointmentId: 'APT-008',
      date: '2026-01-30',
      duration: 60,
      counselor: '이상담',
      type: '초기 상담',
      summary: '가족 관계 스트레스 상담',
      notes: '최근 가족 간 갈등으로 인한 심리적 어려움 호소. 의사소통 방법에 대한 조언 제공 및 가족상담 가능성 논의. 1주일 후 재상담 예정.',
      riskLevel: 'medium',
      followUpNeeded: true,
      nextAppointment: '2026-02-06',
    },
  ];

  const filteredRecords = records.filter((record) =>
    record.citizenName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.appointmentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRiskBadge = (level: 'low' | 'medium' | 'high') => {
    const variants = {
      low: { variant: 'outline' as const, label: '낮음', color: 'text-green-600' },
      medium: { variant: 'secondary' as const, label: '보통', color: 'text-orange-600' },
      high: { variant: 'destructive' as const, label: '높음', color: 'text-red-600' },
    };
    const { variant, label } = variants[level];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const handleCreateRecord = () => {
    // Here you would call the API to create the record
    console.log('Creating record:', formData);
    setCreateDialogOpen(false);
    // Reset form
    setFormData({
      citizenName: '',
      appointmentId: '',
      date: '',
      duration: '',
      type: '',
      summary: '',
      notes: '',
      riskLevel: 'low',
      followUpNeeded: false,
      nextAppointment: '',
    });
  };

  const handleViewRecord = (record: ConsultationRecord) => {
    setSelectedRecord(record);
    setViewDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">상담 기록</h1>
          <p className="text-gray-500 mt-1">상담 내용을 기록하고 이력을 관리합니다</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          새 상담 기록
        </Button>
      </div>

      {/* Compliance Warning */}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-5 w-5 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>기록 작성 안내:</strong> 상담 기록은 개인정보보호법에 따라 안전하게 관리되며, 
          의료 진단이나 처방은 기록하지 않습니다. 위급 상황 시 즉시 응급 서비스(☎1577-0199)를 안내하세요.
        </AlertDescription>
      </Alert>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="시민 이름, 기록번호, 예약번호로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Records List */}
      <div className="grid gap-4">
        {filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">검색 결과가 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          filteredRecords.map((record) => (
            <Card key={record.id} className="hover:border-blue-300 transition-colors cursor-pointer" onClick={() => handleViewRecord(record)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {record.citizenName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{record.citizenName}</h3>
                        {getRiskBadge(record.riskLevel)}
                        {record.followUpNeeded && (
                          <Badge variant="outline" className="text-blue-600 border-blue-200">
                            후속 필요
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(record.date).toLocaleDateString('ko-KR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {record.duration}분
                        </span>
                        <span>{record.type}</span>
                        <span>•</span>
                        <span>{record.counselor}</span>
                      </div>
                      <p className="text-gray-700 line-clamp-2">{record.summary}</p>
                      {record.nextAppointment && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-900">
                            <strong>다음 상담:</strong> {new Date(record.nextAppointment).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">기록번호</p>
                    <p className="text-sm font-medium text-gray-900">{record.id}</p>
                    <p className="text-xs text-gray-500 mt-1">예약 {record.appointmentId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Record Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 상담 기록 작성</DialogTitle>
            <DialogDescription>
              상담 내용을 기록합니다. 모든 정보는 안전하게 보관됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="citizen-name">시민 이름 *</Label>
                <Input
                  id="citizen-name"
                  value={formData.citizenName}
                  onChange={(e) => setFormData({ ...formData, citizenName: e.target.value })}
                  placeholder="이름 입력 또는 검색"
                />
              </div>
              <div>
                <Label htmlFor="appointment-id">예약번호 *</Label>
                <Input
                  id="appointment-id"
                  value={formData.appointmentId}
                  onChange={(e) => setFormData({ ...formData, appointmentId: e.target.value })}
                  placeholder="APT-000"
                />
              </div>
              <div>
                <Label htmlFor="date">상담 날짜 *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="duration">상담 시간 (분) *</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="60"
                />
              </div>
              <div>
                <Label htmlFor="type">상담 유형 *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initial">초기 상담</SelectItem>
                    <SelectItem value="follow-up">재상담</SelectItem>
                    <SelectItem value="crisis">위기 상담</SelectItem>
                    <SelectItem value="closure">종결 상담</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="risk-level">우선도 평가 *</Label>
                <Select value={formData.riskLevel} onValueChange={(value) => setFormData({ ...formData, riskLevel: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">낮음</SelectItem>
                    <SelectItem value="medium">보통</SelectItem>
                    <SelectItem value="high">높음</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Consultation Details */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="summary">상담 요약 *</Label>
                <Input
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="상담 내용을 한 줄로 요약하세요"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="notes">상담 노트 *</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="상담 내용, 관찰 사항, 제공한 정보 및 권장 사항을 상세히 기록하세요"
                  rows={8}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-2">
                  * 의료 진단이나 처방은 기록하지 마세요
                </p>
              </div>
            </div>

            <Separator />

            {/* Follow-up */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="follow-up"
                  checked={formData.followUpNeeded}
                  onChange={(e) => setFormData({ ...formData, followUpNeeded: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="follow-up">후속 상담 필요</Label>
              </div>
              {formData.followUpNeeded && (
                <div>
                  <Label htmlFor="next-appointment">다음 상담 예정일</Label>
                  <Input
                    id="next-appointment"
                    type="date"
                    value={formData.nextAppointment}
                    onChange={(e) => setFormData({ ...formData, nextAppointment: e.target.value })}
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              취소
            </Button>
            <Button onClick={handleCreateRecord}>
              <Save className="h-4 w-4 mr-2" />
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Record Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>상담 기록 상세</DialogTitle>
            <DialogDescription>기록번호: {selectedRecord?.id}</DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-6 py-4">
              {/* Header Info */}
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-xl">
                    {selectedRecord.citizenName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{selectedRecord.citizenName}</h3>
                  <div className="flex items-center gap-2">
                    {getRiskBadge(selectedRecord.riskLevel)}
                    {selectedRecord.followUpNeeded && (
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        후속 필요
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">상담 날짜</Label>
                  <p className="mt-1 font-medium">
                    {new Date(selectedRecord.date).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">상담 시간</Label>
                  <p className="mt-1 font-medium">{selectedRecord.duration}분</p>
                </div>
                <div>
                  <Label className="text-gray-500">상담 유형</Label>
                  <p className="mt-1 font-medium">{selectedRecord.type}</p>
                </div>
                <div>
                  <Label className="text-gray-500">담당 상담사</Label>
                  <p className="mt-1 font-medium">{selectedRecord.counselor}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-gray-500">예약번호</Label>
                  <p className="mt-1 font-medium">{selectedRecord.appointmentId}</p>
                </div>
              </div>

              <Separator />

              {/* Summary */}
              <div>
                <Label className="text-gray-500">상담 요약</Label>
                <p className="mt-2 text-gray-900">{selectedRecord.summary}</p>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-gray-500">상담 노트</Label>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedRecord.notes}</p>
                </div>
              </div>

              {/* Follow-up */}
              {selectedRecord.nextAppointment && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Label className="text-blue-900">다음 상담 예정</Label>
                  <p className="mt-1 font-medium text-blue-900">
                    {new Date(selectedRecord.nextAppointment).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              닫기
            </Button>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              PDF 출력
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
