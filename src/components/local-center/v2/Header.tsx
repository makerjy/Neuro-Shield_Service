import React from "react";
import { 
  Bell, 
  Search, 
  CheckCircle2,
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  Settings,
} from "lucide-react";
import { type TabType } from "./shared";
import { AppHeaderTitle, HEADER_TITLE_MAP } from '../../ui/AppHeaderTitle';

const TAB_ICONS: Record<string, React.ElementType> = {
  main: LayoutDashboard,
  cases: Users,
  calendar: Calendar,
  reports: BarChart3,
  settings: Settings,
};

interface HeaderProps {
  activeTab: TabType;
  caseSearchKeyword: string;
  onCaseSearchKeywordChange: (value: string) => void;
}

export function Header({ activeTab, caseSearchKeyword, onCaseSearchKeywordChange }: HeaderProps) {
  const Icon = TAB_ICONS[activeTab] || LayoutDashboard;
  const mapped = HEADER_TITLE_MAP[activeTab as keyof typeof HEADER_TITLE_MAP];
  const isCaseTab = activeTab === "cases";

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">
      <div className="flex items-center gap-6">
        <AppHeaderTitle
          title={mapped?.title ?? activeTab}
          subtitle={mapped?.subtitle ?? 'Neuro-Shield 치매안심센터 운영 시스템'}
          icon={<Icon className="h-4 w-4 text-white" />}
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input 
            type="text" 
            value={isCaseTab ? caseSearchKeyword : ""}
            onChange={(event) => {
              if (!isCaseTab) return;
              onCaseSearchKeywordChange(event.target.value);
            }}
            placeholder={isCaseTab ? "케이스 ID, 성함 검색..." : "케이스 대시보드에서 검색 가능"}
            disabled={!isCaseTab}
            className="bg-gray-100 border-none rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-64 transition-all focus:w-80 outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
