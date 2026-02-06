import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Badge } from './ui/badge';

interface PrimaryScreeningProps {
  data: {
    applied: number;
    notApplied: number;
    byAge: Array<{ ageGroup: string; applied: number; notApplied: number }>;
    notAppliedReasons: Array<{ reason: string; count: number; percentage: number }>;
  };
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];

export function PrimaryScreening({ data }: PrimaryScreeningProps) {
  const pieData = [
    { name: '적용됨', value: data.applied },
    { name: '미적용', value: data.notApplied }
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900">1차 검사 (건강검진)</h3>
          <Badge variant="outline" className="text-sm">집계 데이터</Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 적용률 도넛 차트 */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-slate-700">적용 현황</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={(entry) => `${entry.name}: ${entry.value}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 연령대별 분포 */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-slate-700">연령대별 적용 분포</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.byAge}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="ageGroup" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="applied" name="적용" fill="#10b981" />
                <Bar dataKey="notApplied" name="미적용" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 미적용 사유 */}
        <div className="mt-6 border-t border-slate-200 pt-6">
          <h4 className="mb-4 text-sm font-medium text-slate-700">미적용 사유 분석</h4>
          <div className="space-y-3">
            {data.notAppliedReasons.map((reason, index) => (
              <div key={reason.reason} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{reason.reason}</span>
                    <span className="text-slate-600">
                      {reason.count.toLocaleString()}건 ({reason.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${reason.percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length]
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            * 미적용 상태는 실패가 아닌 진행 상태를 나타냅니다
          </p>
        </div>
      </div>
    </div>
  );
}
