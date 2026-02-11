import React, { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Phone, 
  Calendar as CalendarIcon, 
  Home, 
  Activity, 
  ExternalLink,
  Clock,
  AlertCircle
} from "lucide-react";
import { cn } from "./shared";

export function CalendarView() {
  const [view, setView] = useState("month");
  
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dates = Array.from({ length: 35 }, (_, i) => i - 3); // Mocking Feb 2026 starts on Sunday (Feb 1st)

  const schedules = [
    { date: 11, type: "연락", title: "CASE-0012 재평가 안내", status: "예정", color: "bg-blue-500" },
    { date: 11, type: "예약", title: "박진호님 2차 방문", status: "지연", color: "bg-red-500" },
    { date: 12, type: "방문", title: "가정 방문 상담 (강남)", status: "예정", color: "bg-emerald-500" },
    { date: 14, type: "의뢰", title: "성모병원 연계 발송", status: "예정", color: "bg-purple-500" },
  ];

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        {/* Calendar Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-gray-800">2026년 2월</h3>
            <div className="flex gap-1">
              <button className="p-1 hover:bg-gray-100 rounded border border-gray-200"><ChevronLeft size={16} /></button>
              <button className="p-1 hover:bg-gray-100 rounded border border-gray-200"><ChevronRight size={16} /></button>
            </div>
            <button className="text-xs font-bold text-gray-500 hover:text-gray-800">오늘</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {["month", "week", "day"].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold rounded capitalize",
                    view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  )}
                >
                  {v === "month" ? "월" : v === "week" ? "주" : "일"}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">
              <Plus size={14} /> 일정 생성
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {days.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d}</div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-auto">
            {dates.map((date, idx) => {
              const daySchedules = schedules.filter(s => s.date === date);
              const isToday = date === 11;
              const isOtherMonth = date <= 0 || date > 28;

              return (
                <div key={idx} className={cn(
                  "min-h-[120px] p-2 border-r border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer",
                  isOtherMonth ? "bg-gray-50/30" : ""
                )}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={cn(
                      "text-[10px] font-bold",
                      isToday ? "w-5 h-5 flex items-center justify-center bg-blue-600 text-white rounded-full" : 
                      isOtherMonth ? "text-gray-300" : "text-gray-500"
                    )}>
                      {date > 0 && date <= 28 ? date : ""}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {daySchedules.map((s, sIdx) => (
                      <div key={sIdx} className={cn(
                        "text-[9px] font-bold text-white p-1 rounded truncate flex items-center gap-1",
                        s.color
                      )}>
                        {s.type === "연락" && <Phone size={8} />}
                        {s.type === "예약" && <CalendarIcon size={8} />}
                        {s.type === "방문" && <Home size={8} />}
                        {s.type === "의뢰" && <ExternalLink size={8} />}
                        {s.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-3 bg-gray-50 text-[10px] text-gray-500 italic text-center border-t border-gray-100">
          * 운영자 주석: 당일 '지연' 상태인 일정은 연체 리스트에 자동 등록되며 상위 관리자에게 보고될 수 있습니다.
        </div>
      </div>

      {/* Right Panels */}
      <div className="w-80 flex flex-col gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-blue-600" />
            오늘 할 일
          </h3>
          <div className="space-y-3">
            {schedules.filter(s => s.date === 11).map((s, idx) => (
              <div key={idx} className="flex gap-3 p-2.5 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all cursor-pointer">
                <div className={cn("w-1 shrink-0 rounded-full", s.color)}></div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-900">{s.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">상태: <span className={s.status === "지연" ? "text-red-600 font-bold" : ""}>{s.status}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-red-50 rounded-xl border border-red-100 p-5">
          <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            지연 일정 경고
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-white border border-red-100 rounded-lg">
              <p className="text-[10px] font-bold text-red-600 mb-1">D+2 지연</p>
              <p className="text-xs font-bold text-gray-900">CASE-2025-0982 보호자 상담</p>
              <button className="mt-2 w-full py-1.5 bg-red-600 text-white text-[10px] font-bold rounded">지금 연락하기</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
