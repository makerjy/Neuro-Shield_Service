import React, { useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn, type TabType } from "./shared";
import { NeuroShieldLogo } from '../../ui/NeuroShieldLogo';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  userName: string;
  centerName: string;
  userRole: 'counselor' | 'center_manager';
  onLogout: () => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  userName,
  centerName,
  userRole,
  onLogout,
}: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const menuItems = [
    { id: "main" as const, label: "센터 운영 대시보드", icon: LayoutDashboard },
    { id: "cases" as const, label: "케이스 대시보드", icon: Users },
    { id: "calendar" as const, label: "캘린더", icon: Calendar },
    { id: "reports" as const, label: "보고서", icon: BarChart3 },
    { id: "settings" as const, label: "설정", icon: Settings },
  ];

  return (
    <aside
      className={`${sidebarOpen ? "w-64" : "w-20"} bg-slate-800 border-r border-slate-700 text-white flex flex-col shrink-0 transition-all duration-300`}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
        {sidebarOpen ? (
          <>
            <NeuroShieldLogo size={36} showText subtitle="기초센터 운영시스템" variant="dark" />
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="h-8 w-8 p-0 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 shrink-0"
              aria-label="사이드바 접기"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="h-8 w-8 p-0 mx-auto rounded-md inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700"
            aria-label="사이드바 펼치기"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
              activeTab === item.id 
                ? "bg-blue-600 text-white shadow-sm" 
                : "text-slate-300 hover:bg-slate-700 hover:text-white"
            )}
            title={!sidebarOpen ? item.label : undefined}
          >
            <item.icon size={20} className={!sidebarOpen ? "mx-auto" : undefined} />
            {sidebarOpen && item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        {sidebarOpen ? (
          <div className="flex items-center gap-3 p-2 bg-slate-700 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">
              {userName.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{userName}</p>
              <p className="text-[10px] text-slate-300 truncate">
                {centerName} / {userRole === 'center_manager' ? '센터장' : '상담사'}
              </p>
            </div>
          </div>
        ) : null}
        <button
          onClick={onLogout}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 hover:text-red-100 transition-colors"
          title={!sidebarOpen ? "로그아웃" : undefined}
        >
          <LogOut size={14} />
          {sidebarOpen ? '로그아웃' : null}
        </button>
      </div>
    </aside>
  );
}
