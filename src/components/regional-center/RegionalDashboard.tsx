import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  AlertTriangle,
  ArrowRight,
  Settings,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { GeoMapPanel } from '../geomap/GeoMapPanel';
import { RegionalScope } from '../geomap/regions';

interface RegionalDashboardProps {
  region: RegionalScope;
  onNavigateToBottleneck?: () => void;
}

type KPIType = 'completion' | 'referral' | 'dropout' | 'recontact' | 'wait_time' | 'consultation_time';

interface DistrictData {
  id: string;
  name: string;
  completion: number;
  referral: number;
  dropout: number;
  recontact: number;
  waitTime: number;
  consultationTime: number;
  trend: 'up' | 'down' | 'stable';
  staffCount: number;
  monthlyChange: number;
}

interface Alert {
  id: string;
  district: string;
  message: string;
  severity: 'critical' | 'warning';
  change: string;
  action: string;
}

const hashSeed = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const seededValue = (seed: string, min: number, max: number) => {
  const ratio = (hashSeed(seed) % 1000) / 1000;
  return min + (max - min) * ratio;
};

const buildDistrictData = (region: RegionalScope): DistrictData[] => {
  const labels = ['권역 1', '권역 2', '권역 3', '권역 4', '권역 5'];
  return labels.map((label, idx) => {
    const key = `${region.id}-${idx}`;
    const completion = Math.round(seededValue(`${key}-completion`, 60, 92));
    const referral = Math.round(seededValue(`${key}-referral`, 30, 65));
    const dropout = Math.round(seededValue(`${key}-dropout`, 6, 28));
    const recontact = Math.round(seededValue(`${key}-recontact`, 35, 78));
    const waitTime = Number(seededValue(`${key}-wait`, 0.8, 5.2).toFixed(1));
    const consultationTime = Number(seededValue(`${key}-consult`, 16, 28).toFixed(1));
    const monthlyChange = Math.round(seededValue(`${key}-change`, -12, 12));
    const trend: DistrictData['trend'] = monthlyChange > 2 ? 'up' : monthlyChange < -2 ? 'down' : 'stable';
    return {
      id: `${region.id}-${idx}`,
      name: `${region.name} ${label}`,
      completion,
      referral,
      dropout,
      recontact,
      waitTime,
      consultationTime,
      trend,
      staffCount: Math.round(seededValue(`${key}-staff`, 8, 22)),
      monthlyChange
    };
  });
};

const buildDistrictDetail = (name: string): DistrictData => {
  const key = `detail-${name}`;
  const completion = Math.round(seededValue(`${key}-completion`, 60, 92));
  const referral = Math.round(seededValue(`${key}-referral`, 30, 65));
  const dropout = Math.round(seededValue(`${key}-dropout`, 6, 28));
  const recontact = Math.round(seededValue(`${key}-recontact`, 35, 78));
  const waitTime = Number(seededValue(`${key}-wait`, 0.8, 5.2).toFixed(1));
  const consultationTime = Number(seededValue(`${key}-consult`, 16, 28).toFixed(1));
  const monthlyChange = Math.round(seededValue(`${key}-change`, -12, 12));
  const trend: DistrictData['trend'] = monthlyChange > 2 ? 'up' : monthlyChange < -2 ? 'down' : 'stable';
  return {
    id: key,
    name,
    completion,
    referral,
    dropout,
    recontact,
    waitTime,
    consultationTime,
    trend,
    staffCount: Math.round(seededValue(`${key}-staff`, 8, 22)),
    monthlyChange
  };
};

const buildAlerts = (region: RegionalScope): Alert[] => ([
  {
    id: 'ALERT-001',
    district: `${region.name} 권역 1`,
    message: '이탈률 2주간 급증',
    severity: 'critical',
    change: '+12%p (전월 대비)',
    action: '상담사 긴급 파견 필요'
  },
  {
    id: 'ALERT-002',
    district: `${region.name} 권역 3`,
    message: '재접촉 성공률 하락',
    severity: 'warning',
    change: '-8%p (3주 연속)',
    action: '재접촉 프로토콜 점검 권고'
  },
  {
    id: 'ALERT-003',
    district: `${region.name} 권역 2`,
    message: '평균 대기시간 증가',
    severity: 'warning',
    change: '+2.1일 (지역 평균 2배)',
    action: '인력 재배치 검토'
  }
]);

export function RegionalDashboard({ region, onNavigateToBottleneck }: RegionalDashboardProps) {
  const [selectedKPI, setSelectedKPI] = useState<KPIType>('completion');
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDistrictName(null);
  }, [region.id]);

  const districtData = useMemo(() => buildDistrictData(region), [region]);
  const alerts = useMemo(() => buildAlerts(region), [region]);

  const statsScopeKey = selectedDistrictName ? `${region.id}-${selectedDistrictName}` : region.id;
  const statsScopeLabel = selectedDistrictName ? `${selectedDistrictName} 권역` : region.label;

  const kpiOptions = [
    { id: 'completion', label: '케이스 처리율', avg: 82 },
    { id: 'referral', label: 'SLA 준수율', avg: 94 },
    { id: 'dropout', label: '추적 이탈 비율', avg: 13 },
    { id: 'recontact', label: '데이터 품질', avg: 96 },
    { id: 'wait_time', label: '평균 응답시간', avg: 18.4 },
    { id: 'consultation_time', label: 'SLA 위반률', avg: 3.2 },
  ];

  const ageDistribution = useMemo(() => {
    const groups = ['0-14', '15-29', '30-44', '45-64', '65+'];
    return groups.map((label, idx) => ({
      age: label,
      male: Math.round(seededValue(`${statsScopeKey}-age-m-${idx}`, 8, 22)),
      female: Math.round(seededValue(`${statsScopeKey}-age-f-${idx}`, 9, 24))
    }));
  }, [statsScopeKey]);

  const trendData = useMemo(() => {
    return Array.from({ length: 6 }).map((_, idx) => ({
      month: `${idx + 1}월`,
      cases: Math.round(seededValue(`${statsScopeKey}-trend-${idx}`, 280, 620)),
      resolved: Math.round(seededValue(`${statsScopeKey}-resolved-${idx}`, 240, 560))
    }));
  }, [statsScopeKey]);

  const capacityData = useMemo(() => {
    return [
      {
        name: '수요 대비 공급',
        demand: Math.round(seededValue(`${statsScopeKey}-demand`, 70, 120)),
        supply: Math.round(seededValue(`${statsScopeKey}-supply`, 60, 110))
      },
      {
        name: '검사 커버리지',
        demand: Math.round(seededValue(`${statsScopeKey}-coverage`, 60, 100)),
        supply: Math.round(seededValue(`${statsScopeKey}-capacity`, 55, 98))
      }
    ];
  }, [statsScopeKey]);

  const riskComposition = useMemo(() => {
    const high = Math.round(seededValue(`${statsScopeKey}-risk-high`, 18, 32));
    const mid = Math.round(seededValue(`${statsScopeKey}-risk-mid`, 28, 42));
    const low = 100 - high - mid;
    return [
      { name: 'L1', value: low, color: '#10b981' },
      { name: 'L2', value: mid, color: '#f59e0b' },
      { name: 'L3', value: high, color: '#ef4444' }
    ];
  }, [statsScopeKey]);

  const getKPIValue = (district: DistrictData, kpi: KPIType): number => {
    const map = {
      completion: district.completion,
      referral: district.referral,
      dropout: district.dropout,
      recontact: district.recontact,
      wait_time: district.waitTime,
      consultation_time: district.consultationTime,
    };
    return map[kpi];
  };

  const getKPIColor = (value: number, kpi: KPIType): string => {
    // Inverse for dropout (lower is better)
    if (kpi === 'dropout') {
      if (value <= 10) return '#10b981'; // Green
      if (value <= 18) return '#fbbf24'; // Yellow
      return '#ef4444'; // Red
    }
    // Inverse for wait_time (lower is better)
    if (kpi === 'wait_time') {
      if (value <= 2) return '#10b981';
      if (value <= 3.5) return '#fbbf24';
      return '#ef4444';
    }
    // Normal (higher is better)
    if (value >= 75) return '#10b981';
    if (value >= 60) return '#fbbf24';
    return '#ef4444';
  };

  const handleExportReport = () => {
    console.log('[AUDIT] Dashboard Report Export:', {
      action: 'REPORT_EXPORT',
      kpi: selectedKPI,
      timestamp: new Date().toISOString(),
    });
    alert('보고서가 내보내기 되었습니다.');
  };

  const currentDistrictData = useMemo(
    () => (selectedDistrictName ? buildDistrictDetail(selectedDistrictName) : null),
    [selectedDistrictName]
  );

  // Calculate KPI Summary
  const kpiSummary = kpiOptions.map((option) => {
    const values = districtData.map((d) => getKPIValue(d, option.id as KPIType));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const minDistrict = districtData.find((d) => getKPIValue(d, option.id as KPIType) === min);
    const maxDistrict = districtData.find((d) => getKPIValue(d, option.id as KPIType) === max);

    return {
      label: option.label,
      avg: avg.toFixed(1),
      min: min.toFixed(1),
      minDistrict: minDistrict?.name || '',
      max: max.toFixed(1),
      maxDistrict: maxDistrict?.name || '',
      unit: option.id === 'wait_time' ? '분' : '%',
    };
  });

  return (
    <div className="h-full overflow-auto bg-white">
      {/* Header */}
      <div className="border-b-2 border-gray-900 bg-white sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{region.label} 광역대시보드</h1>
              <p className="text-sm text-gray-600 mt-1">
                데이터 기준일: 2026년 2월 4일 | 담당: 김행정 (광역센터장)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                설정
              </Button>
              <Button variant="outline" onClick={handleExportReport}>
                <Download className="h-4 w-4 mr-2" />
                보고서 내보내기
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {/* KPI Selector */}
        <section className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            {kpiOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedKPI(option.id as KPIType)}
                className={`px-4 py-2 border-2 rounded transition-all ${
                  selectedKPI === option.id
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{option.label}</span>
                  <span className="text-xs opacity-70">
                    (평균: {option.avg}
                    {option.id === 'wait_time' ? '분' : '%'})
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* GeoMap + 운영 지표 패널 */}
        <section className="mb-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-6">
          <GeoMapPanel
            key={`${region.id}-${selectedKPI}`}
            title={`지역별 통계 지오맵 - ${kpiOptions.find((o) => o.id === selectedKPI)?.label}`}
            indicatorId={selectedKPI}
            year={2026}
            scope={{ mode: 'regional', ctprvnCodes: [region.ctprvnCode], label: region.label }}
            onRegionSelect={({ level, name }) => {
              if (level === 'ctprvn') {
                setSelectedDistrictName(null);
                return;
              }
              if (level === 'sig' || level === 'emd') {
                setSelectedDistrictName(name);
              }
            }}
          />

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{statsScopeLabel} 통계 요약</CardTitle>
                <p className="text-xs text-gray-500">
                {selectedDistrictName ? '선택 구역 기준' : '광역 평균 기준'} · 케이스 분포 · 처리 추세
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-sm font-semibold text-gray-900 mb-2">연령 구조 (비율)</div>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={ageDistribution} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="age" stroke="#6b7280" fontSize={10} />
                        <YAxis stroke="#6b7280" fontSize={10} />
                        <Tooltip />
                        <Bar dataKey="male" stackId="a" fill="#60a5fa" name="남" />
                        <Bar dataKey="female" stackId="a" fill="#2563eb" name="여" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-sm font-semibold text-gray-900 mb-2">최근 6개월 상담 추세</div>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" stroke="#6b7280" fontSize={10} />
                        <YAxis stroke="#6b7280" fontSize={10} />
                        <Tooltip />
                        <Line type="monotone" dataKey="cases" stroke="#3b82f6" strokeWidth={2} name="발생" />
                        <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="처리" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>위험군 구성</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={riskComposition} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={4}>
                      {riskComposition.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  {riskComposition.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span>{item.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>수요·공급/커버리지</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={capacityData} barGap={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="demand" fill="#f59e0b" name="수요" />
                    <Bar dataKey="supply" fill="#3b82f6" name="공급" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Alerts Panel */}
        <section className="mb-8">
          <div className="border-2 border-gray-900 bg-white">
            <div className="border-b-2 border-gray-900 bg-gray-900 text-white px-4 py-3">
              <h2 className="font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                이상징후 알림
              </h2>
            </div>

            <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`border-l-4 p-3 ${
                    alert.severity === 'critical'
                      ? 'border-red-600 bg-red-50'
                      : 'border-yellow-600 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-gray-900 text-sm">{alert.district}</div>
                    <Badge
                      variant="outline"
                      className={
                        alert.severity === 'critical'
                          ? 'bg-red-100 text-red-800 border-red-300 text-xs'
                          : 'bg-yellow-100 text-yellow-800 border-yellow-300 text-xs'
                      }
                    >
                      {alert.severity === 'critical' ? '긴급' : '주의'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-900 font-medium mb-1">{alert.message}</p>
                  <p className="text-xs text-gray-600 mb-2">{alert.change}</p>
                  <div className="pt-2 border-t border-gray-300">
                    <p className="text-xs text-gray-700">
                      <strong>권고조치:</strong> {alert.action}
                    </p>
                  </div>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">현재 이상징후가 없습니다</p>
                </div>
              )}
            </div>

            <div className="border-t-2 border-gray-300 p-3 bg-gray-50 text-xs text-gray-600">
              <strong>분석 기준:</strong> 최근 2주 데이터 | <strong>갱신:</strong> 매일 09:00
            </div>
          </div>
        </section>

        {/* KPI Summary Table */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 pb-2 border-b-2 border-gray-900 flex-1">
              핵심 KPI 요약
            </h2>
            <Button variant="outline" size="sm" onClick={handleExportReport}>
              <Download className="h-4 w-4 mr-2" />
              다운로드
            </Button>
          </div>

          <table className="w-full border-collapse border-2 border-gray-300">
            <thead>
              <tr className="border-b-2 border-gray-900 bg-gray-100">
                <th className="text-left py-3 px-4 text-sm font-bold text-gray-900">KPI 구분</th>
                <th className="text-center py-3 px-4 text-sm font-bold text-gray-900">평균값</th>
                <th className="text-center py-3 px-4 text-sm font-bold text-gray-900">최저 (지역)</th>
                <th className="text-center py-3 px-4 text-sm font-bold text-gray-900">최고 (지역)</th>
              </tr>
            </thead>
            <tbody>
              {kpiSummary.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-300 hover:bg-gray-50">
                  <td className="py-3 px-4 font-semibold text-gray-900">{item.label}</td>
                  <td className="py-3 px-4 text-center text-gray-900">
                    {item.avg}
                    {item.unit}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-700">
                    {item.min}
                    {item.unit} ({item.minDistrict})
                  </td>
                  <td className="py-3 px-4 text-center text-gray-700">
                    {item.max}
                    {item.unit} ({item.maxDistrict})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
            <strong>데이터 출처:</strong> 각 센터 자동 집계 시스템 | 
            <strong className="ml-3">집계 주체:</strong> 광역센터 통합 분석 시스템 | 
            <strong className="ml-3">갱신 시각:</strong> 2026-02-04 09:00
          </div>
        </section>

        {/* District Details Table */}
        {currentDistrictData && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 pb-2 border-b-2 border-gray-900 flex-1">
                지역별 상세 데이터 - {currentDistrictData.name}
              </h2>
              {onNavigateToBottleneck && (
                <Button variant="outline" onClick={onNavigateToBottleneck}>
                  해당 지역 병목 분석
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>

            <table className="w-full border-collapse border-2 border-gray-300">
              <thead>
                <tr className="border-b-2 border-gray-900 bg-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-900">지표</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-gray-900">현재값</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-gray-900">최근 변동률</th>
                  <th className="text-center py-3 px-4 text-sm font-bold text-gray-900">상태</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="py-3 px-4 text-gray-900">상담완료율</td>
                  <td className="py-3 px-4 text-center font-bold text-gray-900">
                    {currentDistrictData.completion}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={
                        currentDistrictData.monthlyChange > 0
                          ? 'text-green-700'
                          : currentDistrictData.monthlyChange < 0
                          ? 'text-red-700'
                          : 'text-gray-700'
                      }
                    >
                      {currentDistrictData.monthlyChange > 0 ? '+' : ''}
                      {currentDistrictData.monthlyChange}%p
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge
                      variant="outline"
                      className={
                        currentDistrictData.completion >= 80
                          ? 'bg-green-50 text-green-700 border-green-300'
                          : currentDistrictData.completion >= 70
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                          : 'bg-red-50 text-red-700 border-red-300'
                      }
                    >
                      {currentDistrictData.completion >= 80
                        ? '정상'
                        : currentDistrictData.completion >= 70
                        ? '주의'
                        : '심각'}
                    </Badge>
                  </td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="py-3 px-4 text-gray-900">이탈률</td>
                  <td className="py-3 px-4 text-center font-bold text-gray-900">
                    {currentDistrictData.dropout}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={currentDistrictData.trend === 'down' ? 'text-green-700' : 'text-red-700'}>
                      {currentDistrictData.trend === 'up' ? '상승' : currentDistrictData.trend === 'down' ? '하락' : '유지'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge
                      variant="outline"
                      className={
                        currentDistrictData.dropout <= 10
                          ? 'bg-green-50 text-green-700 border-green-300'
                          : currentDistrictData.dropout <= 18
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                          : 'bg-red-50 text-red-700 border-red-300'
                      }
                    >
                      {currentDistrictData.dropout <= 10
                        ? '정상'
                        : currentDistrictData.dropout <= 18
                        ? '주의'
                        : '심각'}
                    </Badge>
                  </td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="py-3 px-4 text-gray-900">인력 현황</td>
                  <td className="py-3 px-4 text-center font-bold text-gray-900">
                    {currentDistrictData.staffCount}명
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600">-</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                      운영중
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-3 bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
              <strong>참고:</strong> 변동률은 전월 동일 기간 대비 | 
              <strong className="ml-3">담당자:</strong> {currentDistrictData.name} 센터장 | 
              <strong className="ml-3">연락처:</strong> 센터 관리 시스템 참조
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
