import React, { useState } from 'react';
import { 
  Home, 
  BarChart3, 
  Settings, 
  Bell,
  Search,
  LogOut,
  Menu,
  X,
  ChevronDown,
  FileText,
  Shield,
  Database,
  Activity,
  ClipboardCheck,
  Brain,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';

interface CentralCenterLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  userRole: 'central_admin' | 'policy_maker';
  userName: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
}

const navigationItems = [
  { id: 'national-dashboard', label: '전국운영대시보드', icon: Home, roles: ['central_admin', 'policy_maker'] },
  { id: 'kpi-dictionary', label: 'KPI 사전', icon: BarChart3, roles: ['central_admin', 'policy_maker'] },
  { id: 'model-apply', label: '모델 적용 센터', icon: Brain, roles: ['central_admin', 'policy_maker'] },
  { id: 'model-governance', label: '모델/규칙 변경 관리', icon: Shield, roles: ['central_admin'] },
  { id: 'quality-monitoring', label: '데이터&모델 품질', icon: Database, roles: ['central_admin', 'policy_maker'] },
  { id: 'compliance-audit', label: '규정 준수 및 감사', icon: ClipboardCheck, roles: ['central_admin'] },
  { id: 'settings', label: '설정', icon: Settings, roles: ['central_admin', 'policy_maker'] },
];

export function CentralCenterLayout({ 
  children, 
  currentPage, 
  userRole, 
  userName,
  onPageChange,
  onLogout
}: CentralCenterLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications] = useState(5);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const filteredNavigation = navigationItems.filter(item => 
    item.roles.includes(userRole)
  );

  const getRoleName = (role: string) => {
    switch (role) {
      case 'central_admin': return '중앙 관리자';
      case 'policy_maker': return '정책 담당자';
      default: return '직원';
    }
  };

  const handleLogout = () => {
    const confirmed = window.confirm('로그아웃 하시겠습니까?');
    if (confirmed) {
      onLogout();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-slate-800 border-r border-slate-700 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
          {sidebarOpen ? (
            <>
              <div>
                <h1 className="font-bold text-lg text-white">Neuro-Shield</h1>
                <p className="text-xs text-slate-400">보건복지부 중앙관리</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
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

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
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
            <div className="text-xs text-slate-400 mb-1">보건복지부</div>
            <div className="text-sm font-medium text-white">{userName}</div>
            <div className="text-xs text-slate-400">{getRoleName(userRole)}</div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="센터, KPI, 감사 항목 검색..."
                className="pl-10 bg-gray-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              {notifications > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {notifications}
                </Badge>
              )}
            </Button>

            {/* User Menu */}
            <div className="relative">
              <Button 
                variant="ghost" 
                className="flex items-center gap-2"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-slate-100 text-slate-600">
                    {userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
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
                      <div className="text-xs text-gray-500">{getRoleName(userRole)}</div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onPageChange('settings');
                        }}
                        className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        설정
                      </button>
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
          {children}
        </main>
      </div>
    </div>
  );
}
