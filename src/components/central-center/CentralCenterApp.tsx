import React, { useState } from 'react';
import { CentralCenterLayout } from './CentralCenterLayout';
import { NationalDashboard } from './NationalDashboard';
import { KPIDictionary } from './KPIDictionary';
import { ModelGovernance } from './ModelGovernance';
import { QualityMonitoring } from './QualityMonitoring';
import { ComplianceAudit } from './ComplianceAudit';

interface CentralCenterAppProps {
  userRole: 'central_admin' | 'policy_maker';
  userName: string;
  onLogout: () => void;
}

export function CentralCenterApp({ 
  userRole, 
  userName, 
  onLogout 
}: CentralCenterAppProps) {
  const [currentPage, setCurrentPage] = useState('national-dashboard');

  const renderContent = () => {
    switch (currentPage) {
      case 'national-dashboard':
        return <NationalDashboard />;
      case 'kpi-dictionary':
        return <KPIDictionary />;
      case 'model-governance':
        return <ModelGovernance />;
      case 'quality-monitoring':
        return <QualityMonitoring />;
      case 'compliance-audit':
        return <ComplianceAudit />;
      case 'settings':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">설정</h1>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600">설정 화면 준비 중입니다.</p>
            </div>
          </div>
        );
      default:
        return <NationalDashboard />;
    }
  };

  return (
    <CentralCenterLayout
      currentPage={currentPage}
      userRole={userRole}
      userName={userName}
      onPageChange={setCurrentPage}
      onLogout={onLogout}
    >
      {renderContent()}
    </CentralCenterLayout>
  );
}
