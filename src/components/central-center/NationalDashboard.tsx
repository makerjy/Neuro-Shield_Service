import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { AlertCircle, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { GeoMapPanel } from '../geomap/GeoMapPanel';
import { GEO_INDICATORS } from '../geomap/geoIndicators';
import { REGIONAL_SCOPES } from '../geomap/regions';

// Mock data for national operations
const nationalKPIs = [
  { label: 'SLA 위반률', value: '2.4%', trend: 'down', status: 'good' },
  { label: '데이터 부족률', value: '5.1%', trend: 'up', status: 'warning' },
  { label: '평균 응답시간', value: '18분', trend: 'down', status: 'good' },
  { label: '케이스 처리율', value: '94.2%', trend: 'up', status: 'good' },
];

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

const regionalData = REGIONAL_SCOPES.map((region) => {
  const cases = Math.round(seededValue(`${region.id}-cases`, 280, 1800));
  const sla = Number(seededValue(`${region.id}-sla`, 90, 98).toFixed(1));
  const dataQuality = Number(seededValue(`${region.id}-quality`, 86, 98).toFixed(1));
  const status = sla >= 95 && dataQuality >= 92 ? 'good' : 'warning';
  return {
    code: region.ctprvnCode,
    region: region.label,
    cases,
    sla,
    dataQuality,
    status
  };
});

const weeklyTrend = [
  { week: '1주', cases: 4200, resolved: 3980 },
  { week: '2주', cases: 4450, resolved: 4180 },
  { week: '3주', cases: 4680, resolved: 4420 },
  { week: '4주', cases: 5020, resolved: 4730 },
];

const distributionData = [
  { name: 'L1 (경증)', value: 45, color: '#10b981' },
  { name: 'L2 (중등도)', value: 35, color: '#f59e0b' },
  { name: 'L3 (고위험)', value: 20, color: '#ef4444' },
];

const mapIndicators = GEO_INDICATORS.filter((item) =>
  ['high_risk_rate', 'screening_coverage', 'followup_dropout', 'waitlist_pressure', 'accessibility_score'].includes(item.id)
);


export function NationalDashboard() {
  const [selectedRegion, setSelectedRegion] = useState<typeof regionalData[0] | null>(null);
  const [mapIndicatorId, setMapIndicatorId] = useState(mapIndicators[0]?.id ?? 'high_risk_rate');
  const activeRegion = selectedRegion ?? regionalData[0];

  const populationTrend = useMemo(() => {
    if (!activeRegion) return [];
    return Array.from({ length: 7 }).map((_, idx) => ({
      year: 2019 + idx,
      population: Math.round(seededValue(`${activeRegion.code}-pop-${idx}`, 650, 1100)) * 1000
    }));
  }, [activeRegion?.code]);

  const ageStructure = useMemo(() => {
    if (!activeRegion) return [];
    const groups = ['0-14', '15-29', '30-44', '45-64', '65+'];
    return groups.map((label, idx) => ({
      age: label,
      male: Math.round(seededValue(`${activeRegion.code}-age-m-${idx}`, 7, 18)),
      female: Math.round(seededValue(`${activeRegion.code}-age-f-${idx}`, 8, 20))
    }));
  }, [activeRegion?.code]);

  const migrationFlow = useMemo(() => {
    if (!activeRegion) return [];
    return [
      {
        name: '전입',
        value: Math.round(seededValue(`${activeRegion.code}-in`, 12, 28))
      },
      {
        name: '전출',
        value: Math.round(seededValue(`${activeRegion.code}-out`, 10, 26))
      }
    ];
  }, [activeRegion?.code]);

  const serviceCoverage = useMemo(() => {
    if (!activeRegion) return [];
    return [
      { name: '센터 커버리지', value: Math.round(seededValue(`${activeRegion.code}-coverage`, 58, 92)) },
      { name: '검사 가용성', value: Math.round(seededValue(`${activeRegion.code}-availability`, 55, 88)) },
      { name: '상담 접근성', value: Math.round(seededValue(`${activeRegion.code}-access`, 50, 90)) }
    ];
  }, [activeRegion?.code]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">전국운영대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">
          전국 정신건강복지센터 실시간 운영 현황
        </p>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_360px] gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>선택 권역 요약</CardTitle>
              <p className="text-xs text-gray-500">지도에서 선택한 권역 기준</p>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold text-gray-900 mb-3">{activeRegion?.region}</div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">총 케이스 수</span>
                  <span className="font-semibold text-gray-900">{activeRegion?.cases.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">SLA 준수율</span>
                  <span className="font-semibold text-emerald-600">{activeRegion?.sla}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">데이터 품질</span>
                  <span className="font-semibold text-blue-600">{activeRegion?.dataQuality}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">상태</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    activeRegion?.status === 'good'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-orange-50 text-orange-700'
                  }`}>
                    {activeRegion?.status === 'good' ? '양호' : '주의'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>전국 운영 KPI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {nationalKPIs.map((kpi, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <div>
                      <div className="text-xs text-gray-500">{kpi.label}</div>
                      <div className="text-lg font-semibold text-gray-900">{kpi.value}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {kpi.status === 'good' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                      )}
                      {kpi.trend === 'down' ? (
                        <TrendingDown className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-orange-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>광역센터별 운영 현황</CardTitle>
            <p className="text-sm text-gray-500">행정구역 클릭 시 통계가 즉시 갱신됩니다.</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {mapIndicators.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMapIndicatorId(item.id)}
                  className={`px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
                    mapIndicatorId === item.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-blue-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <GeoMapPanel
              title="전국 GeoMap"
              indicatorId={mapIndicatorId}
              year={2026}
              scope={{ mode: 'national' }}
              onRegionSelect={({ level, code }) => {
                if (level !== 'ctprvn') return;
                const region = regionalData.find((item) => item.code === code);
                if (region) setSelectedRegion(region);
              }}
            />

            <div className="mt-4 text-xs text-gray-500">
              선택 권역: <strong className="text-gray-800">{activeRegion?.region}</strong>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>위험도 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {distributionData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-700">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-900">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>서비스 커버리지</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {serviceCoverage.map((item) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{item.name}</span>
                    <span className="font-semibold text-gray-900">{item.value}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>인구 이동 흐름</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={migrationFlow} layout="vertical" barCategoryGap={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" name="인구 이동" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>연령 구조 (비율)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageStructure} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="age" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip />
                <Bar dataKey="male" stackId="a" fill="#60a5fa" name="남" />
                <Bar dataKey="female" stackId="a" fill="#2563eb" name="여" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>인구 추세</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={populationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="year" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="population" stroke="#3b82f6" strokeWidth={2} name="인구" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>주간 처리량 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="cases"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="총 케이스"
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="처리 완료"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>광역센터별 부하 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={regionalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="region" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="cases" fill="#3b82f6" name="케이스 수" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
