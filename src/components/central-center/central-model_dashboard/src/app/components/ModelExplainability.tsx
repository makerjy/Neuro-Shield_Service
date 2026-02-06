import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface ModelExplainabilityProps {
  data: Array<{ factor: string; impact: number }>;
  policyLogs: Array<{
    id: string;
    version: string;
    description: string;
    appliedDate: string;
    category: string;
  }>;
}

export function ModelExplainability({ data, policyLogs }: ModelExplainabilityProps) {
  // SHAP 스타일: 절대값 기준으로 정렬
  const sortedData = [...data].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return (
    <div className="space-y-6">
      {/* 설명가능성 */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">모델 설명가능성 (SHAP)</h3>
            <p className="mt-1 text-sm text-slate-600">
              1차→2차 전환 영향 요인 · 
              <span className="ml-2 text-red-600">양수: 위험 증가</span> · 
              <span className="ml-2 text-blue-600">음수: 위험 감소</span>
            </p>
          </div>
          <Badge variant="outline" className="text-sm">XAI</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* SHAP 양방향 바 차트 */}
          <div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={sortedData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} domain={[-25, 35]} />
                <YAxis dataKey="factor" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip 
                  formatter={(value: number) => [
                    `${value > 0 ? '+' : ''}${value.toFixed(1)}%`,
                    value > 0 ? '위험 증가' : '위험 감소'
                  ]} 
                />
                <ReferenceLine x={0} stroke="#475569" strokeWidth={2} />
                <Bar dataKey="impact" name="영향도">
                  {sortedData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.impact > 0 ? '#ef4444' : '#3b82f6'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 요인 상세 */}
          <div>
            <h4 className="mb-4 text-sm font-medium text-slate-700">요인별 영향도</h4>
            <div className="space-y-2.5">
              {sortedData.map((factor) => (
                <div key={factor.factor} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`size-3 rounded-full ${factor.impact > 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                      />
                      <span className="text-sm font-medium text-slate-700">{factor.factor}</span>
                    </div>
                    <span className={`text-base font-bold ${factor.impact > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {factor.impact > 0 ? '+' : ''}{factor.impact.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    {factor.impact > 0 ? (
                      <>
                        <div className="w-1/2" />
                        <div
                          className="h-full bg-red-500 transition-all"
                          style={{ width: `${(Math.abs(factor.impact) / 60) * 50}%` }}
                        />
                      </>
                    ) : (
                      <>
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${(Math.abs(factor.impact) / 60) * 50}%`, marginLeft: `${50 - (Math.abs(factor.impact) / 60) * 50}%` }}
                        />
                        <div className="w-1/2" />
                      </>
                    )}
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500">
                    {factor.impact > 0 ? '2차 검사 가능성 증가' : '2차 검사 가능성 감소'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          * SHAP 값 기반 집계 영향도 · 개별 데이터가 아닌 평균 기여도를 표시합니다
        </p>
      </div>

      {/* 정책 감사 로그 */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">정책 감사 로그</h3>
            <p className="mt-1 text-sm text-slate-600">모델 버전 및 기준 변경 이력</p>
          </div>
          <Badge variant="outline" className="text-sm">책임 추적</Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>버전</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>변경 내용</TableHead>
                <TableHead>적용일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policyLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">{log.version}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.category === '모델 업데이트' ? 'default' :
                        log.category === '기준 변경' ? 'secondary' :
                        'outline'
                      }
                    >
                      {log.category}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.description}</TableCell>
                  <TableCell className="text-slate-600">{log.appliedDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}