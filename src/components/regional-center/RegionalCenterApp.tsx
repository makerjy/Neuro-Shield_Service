import React, { useState } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  GraduationCap,
  FileText,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Search,
  Settings,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { RegionalDashboard } from './RegionalDashboard';
import { BottleneckAnalysis } from './BottleneckAnalysis';
import { RegionalSettings } from './RegionalSettings';
import { EducationSupport } from './EducationSupport';
import { InterventionManager } from './InterventionManager';
import { Reports } from './Reports';
import { REGIONAL_SCOPES, resolveRegionFromName } from '../geomap/regions';

type Page = 'dashboard' | 'bottleneck' | 'support' | 'intervention' | 'reports' | 'settings';

interface RegionalCenterAppProps {
  userRole?: string;
  userName?: string;
  centerName?: string;
  onLogout?: () => void;
}

/* ─── 좌측 사이드바 네비게이션 정의 (중앙센터와 동일 패턴) ─── */
const navigationItems: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: '광역 대시보드', icon: LayoutDashboard },
  { id: 'intervention', label: '병목 개입 관리', icon: GraduationCap },
  { id: 'reports', label: '보고서', icon: FileText },
  { id: 'settings', label: '설정', icon: Settings },
];

export function RegionalCenterApp({
  userName = '김행정',
  centerName = '서울시 광역정신건강복지센터',
  onLogout
}: RegionalCenterAppProps) {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [regionId, setRegionId] = useState(() => resolveRegionFromName(centerName).id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const region = REGIONAL_SCOPES.find((item) => item.id === regionId) ?? REGIONAL_SCOPES[0];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <RegionalDashboard
            region={region}
            onNavigateToBottleneck={() => setCurrentPage('bottleneck')}
          />
        );
      case 'bottleneck':
        return (
          <BottleneckAnalysis
            onNavigateToSupport={(centerId) => {
              setSelectedCenterId(centerId);
              setCurrentPage('intervention');
            }}
          />
        );
      case 'intervention':
        return (
          <InterventionManager
            region={regionId}
            centerId={selectedCenterId}
            onNavigateToBottleneck={() => setCurrentPage('bottleneck')}
          />
        );
      case 'support':
        return (
          <InterventionManager
            region={regionId}
            centerId={selectedCenterId}
            onNavigateToBottleneck={() => setCurrentPage('bottleneck')}
          />
        );
      case 'reports':
        return <Reports />;
      case 'settings':
        return <RegionalSettings regionCode={regionId} regionLabel={region.label} />;
      default:
        return null;
    }
  };

  const handleLogout = () => {
    const confirmed = window.confirm('로그아웃 하시겠습니까?');
    if (confirmed && onLogout) {
      onLogout();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ═══ Sidebar (중앙센터 CentralCenterLayout과 동일 패턴) ═══ */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-slate-800 border-r border-slate-700 transition-all duration-300 flex flex-col shrink-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-base">광</span>
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-sm text-white truncate">Neuro-Shield</h1>
                  <p className="text-[10px] text-slate-400 truncate">{region.label} 광역센터</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="h-8 w-8 p-0 mx-auto text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 권역 선택 */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-b border-slate-700">
            <label className="text-[10px] text-slate-400 block mb-1">관할 권역</label>
            <select
              value={regionId}
              onChange={(event) => setRegionId(event.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {REGIONAL_SCOPES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 ${!sidebarOpen && 'mx-auto'}`} />
                {sidebarOpen && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Info */}
        {sidebarOpen && (
          <div className="p-4 border-t border-slate-700">
            <div className="text-xs text-slate-400 mb-1">{region.label} 광역센터</div>
            <div className="text-sm font-medium text-white">{userName}</div>
            <div className="text-xs text-slate-400">광역센터장</div>
          </div>
        )}
      </aside>

      {/* ═══ Main Content Area (중앙센터와 동일 구조) ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="센터, KPI, 시군구 검색..."
                className="pl-10 bg-gray-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                3
              </Badge>
            </Button>

            {/* User Menu */}
            <div className="relative">
              <Button
                variant="ghost"
                className="flex items-center gap-2"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm">
                  {userName.charAt(0)}
                </div>
                <span className="text-sm font-medium">{userName}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </Button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="px-3 py-2 border-b border-gray-200">
                      <div className="text-sm font-medium text-gray-900">{userName}</div>
                      <div className="text-xs text-gray-500">광역센터장</div>
                    </div>
                    <div className="border-t border-gray-200 py-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        로그아웃
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 w-full overflow-auto relative">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
