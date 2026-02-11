import React from "react";
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Clock, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  BarChart3,
  ChevronRight,
  Filter
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line 
} from "recharts";
import { cn } from "./shared";

export function ReportsView() {
  const templates = [
    { name: "월간 운영 성과 보고서", type: "PDF", lastRun: "2026-02-01", status: "자동생성" },
    { name: "Stage별 파이프라인 효율 분석", type: "XLSX", lastRun: "2026-02-10", status: "수동생성" },
    { name: "지역별 수검률 분포 (지도 포함)", type: "CSV", lastRun: "2026-02-11", status: "실시간" },
    { name: "감사 로그 리포트", type: "PDF", lastRun: "2026-01-31", status: "보안" },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Filters & Export Global */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-semibold shadow-sm">
            <Filter size={14} className="text-gray-400" />
            기간: 2026-01-01 ~ 2026-01-31
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-semibold shadow-sm text-gray-400">
            담당자: 전체
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm">
          <Download size={16} /> 전체 보고서 패키지 다운로드
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Templates Area */}
        <div className="col-span-8 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                보고서 템플릿
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {templates.map((t, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50 flex items-center justify-between group cursor-pointer transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      t.type === "PDF" ? "bg-red-50 text-red-600" : 
                      t.type === "XLSX" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {t.type === "PDF" ? <FileText size={20} /> : <FileSpreadsheet size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{t.name}</p>
                      <p className="text-[10px] text-gray-500">최근 생성: {t.lastRun} | <span className="text-blue-600 font-bold">{t.status}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="px-3 py-1.5 border border-gray-200 rounded text-[10px] font-bold text-gray-600 hover:bg-white">열람</button>
                    <button className="px-3 py-1.5 bg-gray-900 text-white rounded text-[10px] font-bold hover:bg-black">내보내기</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-gray-50 flex items-center justify-center border-t border-gray-100">
              <button className="text-xs font-bold text-gray-500 hover:text-blue-600 flex items-center gap-1">
                보고서 예약 생성 설정 <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-6 flex items-center justify-between">
              단계별 처리 성과 분석
              <span className="text-[10px] text-emerald-600 font-bold">평균 처리 시간 12% 단축됨</span>
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: "선별", target: 2, actual: 1.2 },
                  { name: "평가", target: 5, actual: 4.5 },
                  { name: "진단", target: 14, actual: 15.4 },
                  { name: "의뢰", target: 7, actual: 5.2 },
                  { name: "추적", target: 180, actual: 192 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="actual" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Insight Summary Area */}
        <div className="col-span-4 space-y-6">
          <div className="bg-blue-600 text-white rounded-xl p-6 shadow-md">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <TrendingUp size={18} />
              운영 인사이트 (AI 요약)
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-white/10 rounded-lg border border-white/10">
                <p className="text-[10px] font-bold text-white/60 uppercase">주요 경향</p>
                <p className="text-sm font-medium mt-1">2차 평가 연계 속도가 전주 대비 15% 빨라졌으나, 3차 감별 대기 시간이 점진적으로 늘어나고 있습니다.</p>
              </div>
              <div className="p-3 bg-white/10 rounded-lg border border-white/10">
                <p className="text-[10px] font-bold text-white/60 uppercase">병목 현상</p>
                <p className="text-sm font-medium mt-1">강남구 서부 지역의 선별 수검률이 전국 평균 대비 8% 낮습니다. 방문 선별 인력 배치가 권고됩니다.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-4 text-sm">지역 비교 지수</h3>
            <div className="space-y-4">
              {[
                { label: "전국 평균 대비 편차", value: "+4.2%", color: "text-emerald-600" },
                { label: "센터별 가동률", value: "92%", color: "text-blue-600" },
                { label: "자원 대비 수요율", value: "115%", color: "text-red-600" },
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                  <span className={cn("text-sm font-bold", item.color)}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="p-3 bg-gray-50 text-[10px] text-gray-500 italic text-center rounded-lg border border-gray-200">
        * 운영자 주석: 해당 보고서는 공공기관 보고 양식을 준수하며, 외부 유출 시 열람 로그에 따라 법적 책임이 발생할 수 있습니다.
      </div>
    </div>
  );
}
