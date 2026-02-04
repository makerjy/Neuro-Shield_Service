import React, { useState } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Eye,
  EyeOff,
  ChevronRight,
  ArrowLeft,
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
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';

interface CaseAnalysisProps {
  caseId: string;
  onBack: () => void;
  onStartConsultation: (caseId: string) => void;
}

type RiskLevel = 'high' | 'medium' | 'low';
type Urgency = 'immediate' | 'within_3days' | 'routine';

interface RiskFactor {
  name: string;
  value: string;
  impact: number;
  trend?: 'up' | 'down' | 'stable';
}

export function CaseAnalysis({ caseId, onBack, onStartConsultation }: CaseAnalysisProps) {
  const [piiDialogOpen, setPiiDialogOpen] = useState(false);
  const [piiAccessReason, setPiiAccessReason] = useState('');
  const [piiVisible, setPiiVisible] = useState(false);

  // Mock Case Data
  const caseData = {
    id: 'CASE-2026-0215',
    riskLevel: 'high' as RiskLevel,
    riskScore: 78,
    riskPercentile: 92,
    riskRank: 23,
    totalCases: 287,
    status: '접촉완료',
    lastContact: '2026-02-01',
    counselor: '이상담',
    urgency: 'immediate' as Urgency,
    
    // De-identified info (always visible)
    ageGroup: '70대 초반',
    gender: '남성',
    district: '강남구 **동',
    
    // Trend
    riskTrend: 'up' as 'up' | 'down' | 'stable',
    previousScore: 65,
    lastAnalysisDate: '2026-02-04',
    
    // PII (protected)
    pii: {
      fullName: '김민수',
      residentNumber: '540215-1******',
      phone: '010-1234-5678',
      fullAddress: '서울시 강남구 테헤란로 123, 아파트 101동 1001호',
      emergencyContact: '김영희 (배우자)',
      emergencyPhone: '010-9876-5432',
    },
  };

  // Risk Factors
  const riskFactors: RiskFactor[] = [
    { name: '최근 기억력 검사 점수', value: '18/30점 (하락)', impact: 28, trend: 'down' },
    { name: '고위험 연령대', value: '72세 (고위험군)', impact: 22, trend: 'stable' },
    { name: '사회적 고립도', value: '높음 (상승 추세)', impact: 18, trend: 'up' },
    { name: '최근 건강검진', value: '미실시 (12개월)', impact: 15, trend: 'stable' },
    { name: '생활습관 리스크', value: '운동부족, 식사 불규칙', impact: 12, trend: 'stable' },
  ];

  // Operational Guidelines
  const guidelines = [
    '최근 2회 전화 응답 없음. 우선 SMS 예약 권고 후 3일 이내 재연락 필요.',
    '청력 저하 있음. 통화 시 또박또박 크고 천천히 말하기.',
    '대중교통 이용 가능. 센터 방문 시 1층 상담실 배정 권장 (무릎 관절 문제).',
    '가족 동반 상담 권장. 배우자 연락처 확보됨.',
  ];

  const getRiskBadgeColor = (level: RiskLevel) => {
    switch (level) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getUrgencyBadgeColor = (urgency: Urgency) => {
    switch (urgency) {
      case 'immediate':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'within_3days':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'routine':
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (!trend) return <Minus className="h-4 w-4 text-gray-400" />;
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const handleRequestPiiAccess = () => {
    console.log('[AUDIT] PII Access Requested:', {
      action: 'PII_ACCESS_REQUEST',
      caseId: caseData.id,
      userId: 'USER-001',
      userName: caseData.counselor,
      timestamp: new Date().toISOString(),
    });

    if (!piiAccessReason.trim()) {
      alert('접근 사유를 입력해주세요.');
      return;
    }

    console.log('[AUDIT] PII Access Granted:', {
      action: 'PII_ACCESS_GRANTED',
      caseId: caseData.id,
      userId: 'USER-001',
      userName: caseData.counselor,
      reason: piiAccessReason,
      timestamp: new Date().toISOString(),
    });

    setPiiVisible(true);
    setPiiDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI 위험도 분석</h1>
            <p className="text-sm text-gray-500 mt-1">케이스 ID: {caseData.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => onStartConsultation(caseData.id)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            상담 시작
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Risk Score Card */}
      <div className="bg-white border-2 border-gray-900 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Badge className={`${getRiskBadgeColor(caseData.riskLevel)} text-base px-3 py-1 border-2`}>
                위험도: {caseData.riskLevel === 'high' ? '높음' : caseData.riskLevel === 'medium' ? '보통' : '낮음'}
              </Badge>
              <Badge className={`${getUrgencyBadgeColor(caseData.urgency)} text-base px-3 py-1 border-2`}>
                {caseData.urgency === 'immediate' ? '즉시 조치' : caseData.urgency === 'within_3days' ? '3일 내 조치' : '정기 관리'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">AI 위험 점수</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-red-600">{caseData.riskScore}</p>
                  <p className="text-sm text-gray-500">/ 100</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">상위 백분위</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-gray-900">{caseData.riskPercentile}%</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">위험도 순위</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-gray-900">{caseData.riskRank}</p>
                  <p className="text-sm text-gray-500">/ {caseData.totalCases}</p>
                </div>
              </div>
            </div>

            {/* Trend */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm">
                {getTrendIcon(caseData.riskTrend)}
                <span className="text-gray-700">
                  지난 분석 대비 <span className="font-bold text-red-600">+{caseData.riskScore - caseData.previousScore}점</span> 상승
                </span>
                <span className="text-gray-500">
                  (이전: {caseData.previousScore}점, {caseData.lastAnalysisDate})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="bg-white border-2 border-gray-900">
        <div className="border-b-2 border-gray-900 bg-gray-50 px-6 py-3">
          <h2 className="text-lg font-bold text-gray-900">주요 위험 요인</h2>
          <p className="text-xs text-gray-600 mt-1">AI가 분석한 위험도 영향 요인 (합계: 100%)</p>
        </div>
        <div className="p-6 space-y-3">
          {riskFactors.map((factor, index) => (
            <div key={index} className="border-2 border-gray-300 p-4 hover:border-gray-400 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{factor.name}</h3>
                    {getTrendIcon(factor.trend)}
                  </div>
                  <p className="text-sm text-gray-700">{factor.value}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{factor.impact}%</p>
                  <p className="text-xs text-gray-500">영향도</p>
                </div>
              </div>
              {/* Impact Bar */}
              <div className="w-full bg-gray-200 h-2 mt-3">
                <div 
                  className="bg-red-600 h-2 transition-all"
                  style={{ width: `${factor.impact}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Guidelines */}
      <div className="bg-blue-50 border-2 border-blue-300">
        <div className="border-b-2 border-blue-300 bg-blue-100 px-6 py-3">
          <h2 className="text-lg font-bold text-blue-900">운영 가이드라인</h2>
          <p className="text-xs text-blue-700 mt-1">상담 및 접촉 시 참고사항</p>
        </div>
        <div className="p-6">
          <ul className="space-y-3">
            {guidelines.map((guideline, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                  {index + 1}
                </div>
                <p className="text-sm text-gray-900 pt-0.5">{guideline}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* De-identified Information */}
      <div className="bg-white border-2 border-gray-900">
        <div className="border-b-2 border-gray-900 bg-gray-50 px-6 py-3">
          <h2 className="text-lg font-bold text-gray-900">비식별 정보</h2>
          <p className="text-xs text-gray-600 mt-1">개인정보보호법에 따라 비식별 처리된 정보</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">연령대</p>
              <p className="font-bold text-gray-900">{caseData.ageGroup}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">성별</p>
              <p className="font-bold text-gray-900">{caseData.gender}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">거주지역</p>
              <p className="font-bold text-gray-900">{caseData.district}</p>
            </div>
          </div>
        </div>
      </div>

      {/* PII Section */}
      <div className="bg-red-50 border-2 border-red-300">
        <div className="border-b-2 border-red-300 bg-red-100 px-6 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-700" />
            <h2 className="text-lg font-bold text-red-900">개인정보 (PII)</h2>
          </div>
          <p className="text-xs text-red-700 mt-1">
            접근 시 모든 기록이 감사로그에 저장됩니다
          </p>
        </div>
        <div className="p-6">
          {!piiVisible ? (
            <div className="text-center py-8">
              <div className="bg-gray-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <EyeOff className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">개인정보 보호됨</h3>
              <p className="text-sm text-gray-600 mb-6">
                개인정보를 열람하려면 접근 사유를 입력해야 합니다
              </p>
              <Button onClick={() => setPiiDialogOpen(true)}>
                <Eye className="h-4 w-4 mr-2" />
                개인정보 열람 요청
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-red-700 font-semibold">
                  ⚠️ 개인정보 열람 중 - 모든 활동이 기록됩니다
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPiiVisible(false)}
                >
                  <EyeOff className="h-4 w-4 mr-2" />
                  숨기기
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4 bg-white border-2 border-gray-300">
                <div>
                  <p className="text-sm text-gray-600 mb-1">성명</p>
                  <p className="font-bold text-gray-900">{caseData.pii.fullName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">주민등록번호</p>
                  <p className="font-bold text-gray-900">{caseData.pii.residentNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">연락처</p>
                  <p className="font-bold text-gray-900">{caseData.pii.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">비상연락처</p>
                  <p className="font-bold text-gray-900">{caseData.pii.emergencyPhone}</p>
                  <p className="text-xs text-gray-500">{caseData.pii.emergencyContact}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600 mb-1">주소</p>
                  <p className="font-bold text-gray-900">{caseData.pii.fullAddress}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PII Access Dialog */}
      <Dialog open={piiDialogOpen} onOpenChange={setPiiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              개인정보 열람 요청
            </DialogTitle>
            <DialogDescription>
              개인정보 열람 사유를 입력해주세요. 모든 접근은 감사로그에 기록됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pii-reason">열람 사유 *</Label>
              <Textarea
                id="pii-reason"
                value={piiAccessReason}
                onChange={(e) => setPiiAccessReason(e.target.value)}
                placeholder="예: 상담 예약을 위한 연락처 확인"
                rows={4}
                className="mt-2"
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-900">
              ⚠️ 이 정보는 감사로그에 저장되며 상급기관에서 검토합니다
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPiiDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleRequestPiiAccess}>
              확인 및 열람
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
