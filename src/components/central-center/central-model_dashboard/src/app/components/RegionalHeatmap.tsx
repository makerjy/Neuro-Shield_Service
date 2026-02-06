import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface RegionalData {
  region: string;
  centers: number;
  subjects: number;
  primaryRate: number;
  secondaryConversion: number;
  highRiskRate: number;
  avgProcessingDays: number;
}

interface RegionalHeatmapProps {
  data: RegionalData[];
}

type SortKey = keyof RegionalData;
type SortDirection = 'asc' | 'desc';

export function RegionalHeatmap({ data }: RegionalHeatmapProps) {
  const [sortKey, setSortKey] = useState<SortKey>('primaryRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // 전국 평균 계산
  const nationalAvg = {
    primaryRate: data.reduce((sum, d) => sum + d.primaryRate, 0) / data.length,
    secondaryConversion: data.reduce((sum, d) => sum + d.secondaryConversion, 0) / data.length,
    highRiskRate: data.reduce((sum, d) => sum + d.highRiskRate, 0) / data.length,
    avgProcessingDays: data.reduce((sum, d) => sum + d.avgProcessingDays, 0) / data.length
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * multiplier;
    }
    return String(aValue).localeCompare(String(bValue)) * multiplier;
  });

  // 색상 계산 함수 (전국 평균 대비)
  const getHeatColor = (value: number, avgValue: number, higherIsBetter = true) => {
    const diff = ((value - avgValue) / avgValue) * 100;
    
    if (higherIsBetter) {
      if (diff > 5) return 'bg-emerald-100 text-emerald-800';
      if (diff > 2) return 'bg-emerald-50 text-emerald-700';
      if (diff < -5) return 'bg-red-100 text-red-800';
      if (diff < -2) return 'bg-red-50 text-red-700';
    } else {
      if (diff < -5) return 'bg-emerald-100 text-emerald-800';
      if (diff < -2) return 'bg-emerald-50 text-emerald-700';
      if (diff > 5) return 'bg-red-100 text-red-800';
      if (diff > 2) return 'bg-red-50 text-red-700';
    }
    
    return 'bg-slate-50 text-slate-700';
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-slate-900">지역/센터 비교 분석</h3>
        <p className="mt-2 text-sm text-slate-600">
          색상은 전국 평균 대비 편차를 나타냅니다 (녹색: 우수, 빨강: 주의)
        </p>
      </div>

      {/* 전국 평균 카드 */}
      <div className="mb-6 grid gap-4 rounded-lg bg-blue-50 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-blue-700">전국 평균 1차 적용률</p>
          <p className="text-xl font-bold text-blue-900">{nationalAvg.primaryRate.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-blue-700">전국 평균 2차 전환율</p>
          <p className="text-xl font-bold text-blue-900">{nationalAvg.secondaryConversion.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-blue-700">전국 평균 고위험율</p>
          <p className="text-xl font-bold text-blue-900">{nationalAvg.highRiskRate.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-blue-700">전국 평균 처리 일수</p>
          <p className="text-xl font-bold text-blue-900">{nationalAvg.avgProcessingDays.toFixed(1)}일</p>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('region')} className="h-8 px-2">
                  지역
                  <ArrowUpDown className="ml-2 size-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('centers')} className="h-8 px-2">
                  센터 수
                  <ArrowUpDown className="ml-2 size-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('subjects')} className="h-8 px-2">
                  대상자 수
                  <ArrowUpDown className="ml-2 size-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('primaryRate')} className="h-8 px-2">
                  1차 적용률
                  <ArrowUpDown className="ml-2 size-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('secondaryConversion')} className="h-8 px-2">
                  2차 전환율
                  <ArrowUpDown className="ml-2 size-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('highRiskRate')} className="h-8 px-2">
                  고위험 비율
                  <ArrowUpDown className="ml-2 size-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('avgProcessingDays')} className="h-8 px-2">
                  평균 처리일수
                  <ArrowUpDown className="ml-2 size-4" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => (
              <TableRow key={row.region}>
                <TableCell className="font-medium">{row.region}</TableCell>
                <TableCell className="text-center">{row.centers}</TableCell>
                <TableCell className="text-center">{row.subjects.toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${getHeatColor(row.primaryRate, nationalAvg.primaryRate, true)}`}>
                    {row.primaryRate}%
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${getHeatColor(row.secondaryConversion, nationalAvg.secondaryConversion, true)}`}>
                    {row.secondaryConversion}%
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${getHeatColor(row.highRiskRate, nationalAvg.highRiskRate, false)}`}>
                    {row.highRiskRate}%
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${getHeatColor(row.avgProcessingDays, nationalAvg.avgProcessingDays, false)}`}>
                    {row.avgProcessingDays}일
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
