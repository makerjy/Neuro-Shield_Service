import React, { useState } from 'react';
import { BarChart3, Download, Table } from 'lucide-react';

type TableRow = {
  label: string;
  value: number | string;
};

type ChartCardProps = {
  title: string;
  children: React.ReactNode;
  tableData?: TableRow[];
  tableTitle?: string;
  onTypeChange?: () => void;
  onDownload?: () => void;
};

export function ChartCard({ title, children, tableData, tableTitle, onTypeChange, onDownload }: ChartCardProps) {
  const [openTable, setOpenTable] = useState(false);

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2 text-gray-600">
          <button
            type="button"
            className="rounded border border-gray-200 bg-white p-1 text-xs hover:bg-gray-50"
            onClick={() => setOpenTable(true)}
            aria-label="표 보기"
            title="표 보기"
          >
            <Table className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded border border-gray-200 bg-white p-1 text-xs hover:bg-gray-50"
            onClick={onTypeChange}
            aria-label="유형 변경"
            title="유형 변경"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded border border-gray-200 bg-white p-1 text-xs hover:bg-gray-50"
            onClick={onDownload}
            aria-label="이미지 저장"
            title="이미지 저장"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3">{children}</div>

      {openTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">{tableTitle ?? title}</div>
              <button
                type="button"
                className="rounded border border-gray-200 px-2 py-1 text-xs"
                onClick={() => setOpenTable(false)}
              >
                닫기
              </button>
            </div>
            <div className="mt-3 max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2">항목</th>
                    <th className="py-2 text-right">값</th>
                  </tr>
                </thead>
                <tbody>
                  {(tableData ?? []).map((row) => (
                    <tr key={row.label} className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">{row.label}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!tableData || tableData.length === 0) && (
                <div className="py-6 text-center text-xs text-gray-500">표 데이터가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
