import React from "react";
import { 
  Bell, 
  Search, 
  Filter,
  CheckCircle2,
} from "lucide-react";
import { type TabType } from "./shared";

interface HeaderProps {
  activeTab: TabType;
  globalFilter: {
    period: string;
    manager: string;
    stage: string;
    quality: string;
  };
  setGlobalFilter: (filter: {
    period: string;
    manager: string;
    stage: string;
    quality: string;
  }) => void;
}

export function Header({ activeTab, globalFilter, setGlobalFilter }: HeaderProps) {
  const tabNames: Record<string, string> = {
    main: "운영 지휘본부 (Main)",
    cases: "케이스 관리 (Cases)",
    calendar: "업무 일정 (Calendar)",
    reports: "성과 분석 (Reports)",
    settings: "시스템 설정 (Settings)",
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">
      <div className="flex items-center gap-6">
        <h2 className="text-xl font-bold text-gray-800">{tabNames[activeTab]}</h2>
        
        {/* Global Filters */}
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-1">
          <select 
            className="bg-transparent text-xs font-semibold px-2 py-1 outline-none border-r border-gray-200"
            value={globalFilter.period}
            onChange={(e) => setGlobalFilter({ ...globalFilter, period: e.target.value })}
          >
            <option value="today">오늘</option>
            <option value="week">이번 주</option>
            <option value="month">이번 달</option>
          </select>
          <select 
            className="bg-transparent text-xs font-semibold px-2 py-1 outline-none border-r border-gray-200"
            value={globalFilter.manager}
            onChange={(e) => setGlobalFilter({ ...globalFilter, manager: e.target.value })}
          >
            <option value="all">전체 담당자</option>
            <option value="me">내 업무</option>
          </select>
          <div className="flex items-center gap-1 px-2 text-xs text-gray-500">
            <Filter size={14} />
            <span className="font-medium">상세 필터</span>
          </div>
        </div>
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
