import React, { useState } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  GraduationCap,
  FileText,
  Bell,
  User,
  LogOut,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { RegionalDashboard } from './RegionalDashboard';
import { BottleneckAnalysis } from './BottleneckAnalysis';
import { EducationSupport } from './EducationSupport';
import { Reports } from './Reports';
import { REGIONAL_SCOPES, resolveRegionFromName } from '../geomap/regions';

type Page = 'dashboard' | 'bottleneck' | 'support' | 'reports';

interface RegionalCenterAppProps {
  userRole?: string;
  userName?: string;
  centerName?: string;
  onLogout?: () => void;
}

export function RegionalCenterApp({
  userName = '김행정',
  centerName = '서울시 광역정신건강복지센터',
  onLogout
}: RegionalCenterAppProps) {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [regionId, setRegionId] = useState(() => resolveRegionFromName(centerName).id);

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
              setCurrentPage('support');
            }}
          />
        );
      case 'support':
        return (
          <EducationSupport
            centerId={selectedCenterId}
            onNavigateToBottleneck={() => setCurrentPage('bottleneck')}
          />
        );
      case 'reports':
        return <Reports />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Navigation */}
      <div className="bg-white border-b-2 border-gray-900">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-lg">광</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{region.label} 광역 치매안심센터</h1>
                <p className="text-xs text-gray-600">행정 통제 및 KPI 관리 시스템</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">관할 권역</span>
                <select
                  value={regionId}
                  onChange={(event) => setRegionId(event.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-700"
                >
                  {REGIONAL_SCOPES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5 text-gray-600" />
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  3
                </Badge>
              </Button>
              <div className="flex items-center gap-2 border-l pl-3 border-gray-300">
                <User className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">김행정</div>
                  <div className="text-xs text-gray-500">광역센터장</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="h-4 w-4 text-gray-600" />
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-gray-200">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                currentPage === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 inline mr-2" />
              대시보드
            </button>
            <button
              onClick={() => setCurrentPage('bottleneck')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                currentPage === 'bottleneck'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              병목 분석
            </button>
            <button
              onClick={() => setCurrentPage('support')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                currentPage === 'support'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <GraduationCap className="h-4 w-4 inline mr-2" />
              교육/인력
            </button>
            <button
              onClick={() => setCurrentPage('reports')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                currentPage === 'reports'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              보고서
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {renderPage()}
      </div>
    </div>
  );
}
