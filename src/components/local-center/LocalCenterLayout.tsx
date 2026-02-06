import React, { useState } from 'react';
import { 
  Home, 
  Calendar, 
  BarChart3, 
  Settings, 
  Bell,
  Search,
  LogOut,
  Menu,
  X,
  ChevronDown,
  FileText,
  Users,
  ClipboardList,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';

interface LocalCenterLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  userRole: 'counselor' | 'center_manager';
  userName: string;
  centerName: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
}

const navigationItems = [
  { id: 'dashboard', label: '케이스 관리', icon: Home, roles: ['counselor', 'center_manager'] },
  { id: 'calendar', label: '일정 캘린더', icon: Calendar, roles: ['counselor', 'center_manager'] },
  { id: 'reports', label: '보고서 관리', icon: FileText, roles: ['counselor', 'center_manager'] },
  { id: 'audit-log', label: '감사 로그', icon: ClipboardList, roles: ['center_manager'] },
  { id: 'settings', label: '설정', icon: Settings, roles: ['counselor', 'center_manager'] },
];

export function LocalCenterLayout({ 
  children, 
  currentPage, 
  userRole, 
  userName,
  centerName,
  onPageChange,
  onLogout
}: LocalCenterLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications] = useState(3);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const filteredNavigation = navigationItems.filter(item => 
    item.roles.includes(userRole)
  );

  const getRoleName = (role: string) => {
    switch (role) {
      case 'counselor': return '상담사';
      case 'center_manager': return '센터장';
      default: return '직원';
    }
  };

  const handleLogout = () => {
    console.log('[DEBUG] Logout button clicked');
    console.log('[DEBUG] onLogout function:', onLogout);
    
    const confirmed = window.confirm('로그아웃 하시겠습니까?');
    console.log('[DEBUG] User confirmed:', confirmed);
    
    if (confirmed) {
      console.log('[DEBUG] Calling onLogout...');
      onLogout();
      console.log('[DEBUG] onLogout called');
    }
  };

  const handleNavClick = (pageId: string) => {
    setUserMenuOpen(false);
    onPageChange(pageId);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen ? (
            <>
              <div>
                <h1 className="font-bold text-lg text-blue-600">Neuro-Shield</h1>
                <p className="text-xs text-gray-500">치매안심센터</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="h-8 w-8 p-0 mx-auto"
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
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleNavClick(item.id);
                }}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
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
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-1">{centerName}</div>
            <div className="text-sm font-medium text-gray-900">{userName}</div>
            <div className="text-xs text-gray-500">{getRoleName(userRole)}</div>
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
                placeholder="시민 이름, 전화번호, 예약번호 검색..."
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

            {/* User Menu - Custom Dropdown */}
            <div className="relative">
              <Button 
                variant="ghost" 
                className="flex items-center gap-2"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
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
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
