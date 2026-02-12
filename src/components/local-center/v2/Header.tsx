import React from "react";
import { 
  Bell, 
  Search, 
  CheckCircle2,
} from "lucide-react";
import { type TabType } from "./shared";

interface HeaderProps {
  activeTab: TabType;
}

export function Header({ activeTab }: HeaderProps) {
  const tabNames: Record<string, string> = {
    main: "운영 대시보드",
    cases: "케이스 관리 (Cases)",
    calendar: "업무 일정 (Calendar)",
    reports: "성과 분석 (Reports)",
    settings: "시스템 설정 (Settings)",
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">
      <div className="flex items-center gap-6">
        <h2 className="text-xl font-bold text-gray-800">{tabNames[activeTab]}</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="케이스 ID, 성함 검색..." 
            className="bg-gray-100 border-none rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-64 transition-all focus:w-80 outline-none"
          />
        </div>

        <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <CheckCircle2 size={16} />
          </span>
          <span>시스템 정상</span>
        </div>
      </div>
    </header>
  );
}
