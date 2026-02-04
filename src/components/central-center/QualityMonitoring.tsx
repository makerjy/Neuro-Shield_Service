import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const dataQualityTrend = [
  { date: '1주', completeness: 94.2, accuracy: 96.5, timeliness: 92.1 },
  { date: '2주', completeness: 95.1, accuracy: 96.8, timeliness: 93.5 },
  { date: '3주', completeness: 94.8, accuracy: 97.2, timeliness: 94.2 },
  { date: '4주', completeness: 95.5, accuracy: 97.0, timeliness: 93.8 },
  { date: '5주', completeness: 96.2, accuracy: 97.5, timeliness: 95.1 },
];

const centerQualityComparison = [
  { center: '서울', completeness: 96.5, accuracy: 97.2, timeliness: 94.8, overall: 96.2 },
  { center: '경기', completeness: 94.8, accuracy: 96.1, timeliness: 93.2, overall: 94.7 },
  { center: '인천', completeness: 95.2, accuracy: 96.8, timeliness: 94.1, overall: 95.4 },
  { center: '부산', completeness: 92.5, accuracy: 94.2, timeliness: 89.5, overall: 92.1 },
  { center: '대구', completeness: 91.8, accuracy: 93.5, timeliness: 88.2, overall: 91.2 },
  { center: '광주', completeness: 94.2, accuracy: 95.8, timeliness: 92.5, overall: 94.2 },
  { center: '대전', completeness: 95.8, accuracy: 96.5, timeliness: 93.8, overall: 95.4 },
  { center: '울산', completeness: 93.5, accuracy: 94.8, timeliness: 91.2, overall: 93.2 },
];

const modelPerformance = [
  { 
    model: 'L1/L2 분류 모델', 
    accuracy: 94.2, 
    precision: 92.8, 
    recall: 95.1, 
    f1Score: 93.9,
    lastEval: '2026-01-20',
    status: 'good',
    trend: 'up'
  },
  { 
    model: 'L3 위험 예측 모델', 
    accuracy: 89.5, 
    precision: 87.2, 
    recall: 91.3, 
    f1Score: 89.2,
    lastEval: '2026-01-20',
    status: 'warning',
    trend: 'down'
  },
  { 
    model: '재접촉 우선순위 모델', 
    accuracy: 91.8, 
    precision: 90.5, 
    recall: 92.8, 
    f1Score: 91.6,
    lastEval: '2026-01-19',
    status: 'good',
    trend: 'up'
  },
];

const dataQualityIssues = [
  { 
    center: '부산 광역센터', 
    issue: '필수 필드 누락률 높음', 
    severity: 'high',
    affectedCases: 42,
    detectedDate: '2026-01-23'
  },
  { 
    center: '대구 광역센터', 
    issue: '데이터 입력 지연 (평균 48시간)', 
    severity: 'medium',
    affectedCases: 28,
    detectedDate: '2026-01-22'
  },
  { 
    center: '경기 강남구 센터', 
    issue: '중복 케이스 입력', 
    severity: 'low',
    affectedCases: 5,
    detectedDate: '2026-01-21'
  },
];

export function QualityMonitoring() {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [selectedCenter, setSelectedCenter] = useState<string>('all');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">데이터 & 모델 품질 모니터링</h1>
          <p className="text-sm text-gray-500 mt-1">
            전국 센터 데이터 품질 및 AI 모델 성능 지표
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={selectedPeriod === 'week' ? 'default' : 'outline'}
            onClick={() => setSelectedPeriod('week')}
          >
            주간
          </Button>
          <Button
            variant={selectedPeriod === 'month' ? 'default' : 'outline'}
            onClick={() => setSelectedPeriod('month')}
          >
            월간
          </Button>
          <Button
            variant={selectedPeriod === 'quarter' ? 'default' : 'outline'}
            onClick={() => setSelectedPeriod('quarter')}
          >
            분기
          </Button>
        </div>
      </div>

      {/* Data Quality Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500 mb-1">평균 완전성</div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-gray-900">95.5%</div>
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                +1.2%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500 mb-1">평균 정확성</div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-gray-900">96.8%</div>
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                +0.8%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500 mb-1">평균 적시성</div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-gray-900">93.8%</div>
              <div className="flex items-center text-orange-600 text-sm">
                <TrendingDown className="h-4 w-4 mr-1" />
                -0.5%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500 mb-1">품질 문제</div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-orange-600">3건</div>
              <div className="text-sm text-gray-500">
                조치 필요
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Quality Trend */}
      <Card>
        <CardHeader>
          <CardTitle>데이터 품질 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dataQualityTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" domain={[85, 100]} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="completeness" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="완전성"
              />
              <Line 
                type="monotone" 
                dataKey="accuracy" 
                stroke="#10b981" 
                strokeWidth={2}
                name="정확성"
              />
              <Line 
                type="monotone" 
                dataKey="timeliness" 
                stroke="#f59e0b" 
                strokeWidth={2}
                name="적시성"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Center Quality Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>센터별 데이터 품질 비교</CardTitle>
          <p className="text-sm text-gray-500">기준선: 90% (빨간색 점선)</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">센터</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">완전성</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">정확성</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">적시성</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">종합 점수</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">상태</th>
                </tr>
              </thead>
              <tbody>
                {centerQualityComparison.map((center, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{center.center}</td>
                    <td className={`py-3 px-4 text-sm text-right ${
                      center.completeness >= 95 ? 'text-green-600' : 
                      center.completeness >= 90 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {center.completeness}%
                    </td>
                    <td className={`py-3 px-4 text-sm text-right ${
                      center.accuracy >= 95 ? 'text-green-600' : 
                      center.accuracy >= 90 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {center.accuracy}%
                    </td>
                    <td className={`py-3 px-4 text-sm text-right ${
                      center.timeliness >= 95 ? 'text-green-600' : 
                      center.timeliness >= 90 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {center.timeliness}%
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                      {center.overall}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      {center.overall >= 95 ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                      ) : center.overall >= 90 ? (
                        <AlertTriangle className="h-5 w-5 text-orange-600 mx-auto" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality Issues */}
      <Card>
        <CardHeader>
          <CardTitle>데이터 품질 문제</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dataQualityIssues.map((issue, idx) => (
              <div 
                key={idx}
                className={`p-4 rounded-lg border ${
                  issue.severity === 'high' ? 'border-red-200 bg-red-50' :
                  issue.severity === 'medium' ? 'border-orange-200 bg-orange-50' :
                  'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`h-4 w-4 ${
                        issue.severity === 'high' ? 'text-red-600' :
                        issue.severity === 'medium' ? 'text-orange-600' :
                        'text-yellow-600'
                      }`} />
                      <span className="font-medium text-sm text-gray-900">{issue.center}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        issue.severity === 'high' ? 'bg-red-200 text-red-800' :
                        issue.severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                        'bg-yellow-200 text-yellow-800'
                      }`}>
                        {issue.severity === 'high' ? '높음' : issue.severity === 'medium' ? '중간' : '낮음'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 mb-1">{issue.issue}</div>
                    <div className="text-xs text-gray-500">
                      영향 케이스: {issue.affectedCases}건 • 발견일: {issue.detectedDate}
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    조치
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Model Performance */}
      <Card>
        <CardHeader>
          <CardTitle>AI 모델 성능 지표</CardTitle>
          <p className="text-sm text-gray-500">최근 평가 기준 (2026-01-20)</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">모델명</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">정확도</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">정밀도</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">재현율</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">F1 점수</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">최근 평가</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">추세</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">상태</th>
                </tr>
              </thead>
              <tbody>
                {modelPerformance.map((model, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{model.model}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{model.accuracy}%</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{model.precision}%</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{model.recall}%</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{model.f1Score}%</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{model.lastEval}</td>
                    <td className="py-3 px-4 text-center">
                      {model.trend === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-orange-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {model.status === 'good' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-50 text-green-700">
                          양호
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-orange-50 text-orange-700">
                          주의
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
