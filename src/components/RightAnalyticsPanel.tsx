import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { ChartCard } from './ChartCard';
import { AlertsCard } from './AlertsCard';
import { Charts as NationalCharts } from '../mocks/mockApi';
import { AlertItem, Charts as RegionalCharts } from '../mocks/mockRegionalApi';
import { CHART_COLORS } from '../styles/tokens';

const pieColors = ['#2563eb', '#e2e8f0'];

const renderTooltip = (value: any) => [`${value}`, ''];

type RightAnalyticsPanelProps = {
  variant?: 'national' | 'regional';
  charts: NationalCharts | RegionalCharts | null;
  alerts?: AlertItem[];
  loading?: boolean;
};

export function RightAnalyticsPanel({ variant = 'national', charts, alerts, loading }: RightAnalyticsPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-48 rounded-md border border-gray-200 bg-gray-50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!charts) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-4 text-xs text-gray-500">데이터가 없습니다.</div>
    );
  }

  if (variant === 'regional') {
    const regionalCharts = charts as RegionalCharts;
    return (
      <div className="space-y-3">
        <AlertsCard alerts={alerts ?? []} />

        <ChartCard
          title="접촉 성공 비율"
          tableData={regionalCharts.pieContact.map((item) => ({ label: item.name, value: `${item.value}%` }))}
          onTypeChange={() => undefined}
          onDownload={() => undefined}
        >
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={regionalCharts.pieContact} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                  {regionalCharts.pieContact.map((_, idx) => (
                    <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={renderTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="상담 완료 비율"
          tableData={regionalCharts.pieConsult.map((item) => ({ label: item.name, value: `${item.value}%` }))}
          onTypeChange={() => undefined}
          onDownload={() => undefined}
        >
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={regionalCharts.pieConsult} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                  {regionalCharts.pieConsult.map((_, idx) => (
                    <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={renderTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="지표별 현재값"
          tableData={regionalCharts.barMetrics.map((item) => ({ label: item.name, value: item.value }))}
          onTypeChange={() => undefined}
          onDownload={() => undefined}
        >
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalCharts.barMetrics} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="상위 지역"
          tableData={regionalCharts.barTopRegions.map((item) => ({ label: item.name, value: item.value }))}
          onTypeChange={() => undefined}
          onDownload={() => undefined}
        >
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalCharts.barTopRegions} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART_COLORS.secondary} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    );
  }

  const nationalCharts = charts as NationalCharts;
  return (
    <div className="space-y-3">
      <ChartCard
        title="SLA 상태 비율"
        tableData={nationalCharts.pieSla.map((item) => ({ label: item.name, value: `${item.value}%` }))}
        onTypeChange={() => undefined}
        onDownload={() => undefined}
      >
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={nationalCharts.pieSla} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                {nationalCharts.pieSla.map((_, idx) => (
                  <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={renderTooltip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="데이터 상태 비율"
        tableData={nationalCharts.pieData.map((item) => ({ label: item.name, value: `${item.value}%` }))}
        onTypeChange={() => undefined}
        onDownload={() => undefined}
      >
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={nationalCharts.pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                {nationalCharts.pieData.map((_, idx) => (
                  <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={renderTooltip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="KPI 구성 분포"
        tableData={nationalCharts.barKpi.map((item) => ({ label: item.name, value: item.value }))}
        onTypeChange={() => undefined}
        onDownload={() => undefined}
      >
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={nationalCharts.barKpi} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="센터 부하 분포"
        tableData={nationalCharts.barLoadByCenter.map((item) => ({ label: item.name, value: item.value }))}
        onTypeChange={() => undefined}
        onDownload={() => undefined}
      >
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={nationalCharts.barLoadByCenter} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill={CHART_COLORS.secondary} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
