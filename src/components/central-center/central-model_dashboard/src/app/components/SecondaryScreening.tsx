import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Badge } from './ui/badge';

interface SecondaryScreeningProps {
  data: {
    status: Array<{ status: string; count: number; percentage: number }>;
    byType: Array<{ type: string; count: number }>;
    results: Array<{ result: string; count: number; percentage: number }>;
  };
}

const STATUS_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];
const RESULT_COLORS = ['#ef4444', '#f59e0b', '#10b981'];

export function SecondaryScreening({ data }: SecondaryScreeningProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-slate-900">2차 검사 (정밀 자원 관리)</h3>
        <Badge variant="outline" className="text-sm">자원 사용 모니터링</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 진행 상태 */}
        <div>
          <h4 className="mb-4 text-sm font-medium text-slate-700">진행 상태</h4>
          <div className="space-y-3">
            {data.status.map((item, index) => (
              <div key={item.status} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{item.status}</span>
                  <Badge 
                    variant={item.status === '진행 중' ? 'default' : item.status === '대기' ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {item.percentage}%
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-slate-900">{item.count.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 검사 종류별 */}
        <div>
          <h4 className="mb-4 text-sm font-medium text-slate-700">검사 종류별 분해</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.byType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 검사 결과 */}
        <div>
          <h4 className="mb-4 text-sm font-medium text-slate-700">2차 결과 분포</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.results}
                cx="50%"
                cy="50%"
                outerRadius={70}
                dataKey="count"
                label={(entry) => `${entry.result}`}
              >
                {data.results.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={RESULT_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => value.toLocaleString()} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 결과 상세 */}
      <div className="mt-6 border-t border-slate-200 pt-6">
        <h4 className="mb-4 text-sm font-medium text-slate-700">결과 상세 집계</h4>
        <div className="grid gap-4 sm:grid-cols-3">
          {data.results.map((result, index) => (
            <div key={result.result} className="rounded-lg border-2 border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: RESULT_COLORS[index] }}
                />
                <span className="text-sm font-medium text-slate-700">{result.result}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{result.count.toLocaleString()}</p>
              <p className="mt-1 text-sm text-slate-500">{result.percentage}%</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        * 자원 사용 편차 및 벤치마킹 데이터는 집계값으로 표시됩니다
      </p>
    </div>
  );
}
