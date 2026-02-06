import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from './ui/badge';

interface AgeCohortsProps {
  data: Array<{
    ageGroup: string;
    primaryRate: number;
    secondaryEntry: number;
    highRiskRate: number;
    subjects: number;
  }>;
}

export function AgeCohorts({ data }: AgeCohortsProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">연령 코호트 분석</h3>
          <p className="mt-1 text-sm text-slate-600">연령대별 모델 적용 현황 및 위험도 분석</p>
        </div>
        <Badge variant="outline" className="text-sm">편향 탐지</Badge>
      </div>

      {/* 차트 */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="ageGroup" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} label={{ value: '비율 (%)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="primaryRate" name="1차 적용률" fill="#3b82f6" />
            <Bar dataKey="secondaryEntry" name="2차 진입률" fill="#f59e0b" />
            <Bar dataKey="highRiskRate" name="고위험 판정률" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 상세 데이터 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((cohort) => (
          <div key={cohort.ageGroup} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-semibold text-slate-900">{cohort.ageGroup}</h4>
              <Badge variant="secondary" className="text-xs">
                {cohort.subjects.toLocaleString()}명
              </Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">1차 적용률</span>
                <span className="font-semibold text-blue-600">{cohort.primaryRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">2차 진입률</span>
                <span className="font-semibold text-amber-600">{cohort.secondaryEntry}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">고위험율</span>
                <span className="font-semibold text-red-600">{cohort.highRiskRate}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 인사이트 */}
      <div className="mt-6 rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="size-2 rounded-full bg-amber-500" />
          <h4 className="font-semibold text-amber-900">연령 편향 탐지</h4>
        </div>
        <ul className="space-y-1 text-sm text-amber-800">
          <li>• 75세 이상 그룹의 1차 적용률이 상대적으로 낮음 (68.1%)</li>
          <li>• 고령층으로 갈수록 고위험 판정률이 증가하는 패턴 확인</li>
          <li>• 60-64세 그룹의 2차 진입률이 가장 높음 (15.8%)</li>
        </ul>
      </div>
    </div>
  );
}
