import React, { useState, useCallback } from 'react';
import { CentralCenterLayout } from './CentralCenterLayout';
import { NationalDashboard } from './NationalDashboard';
import { KPIDictionary } from './KPIDictionary';
import ModelApplyDashboard from './ModelApplyDashboard';
import { ModelGovernance } from './ModelGovernance';
import { QualityMonitoring } from './QualityMonitoring';
import { ComplianceAudit } from './ComplianceAudit';
import { CentralSettings } from './CentralSettings';
import { DEFAULT_TAB_CONTEXT, mergeContext, type TabContext } from '../../lib/useTabContext';

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
  const [tabContext, setTabContext] = useState<TabContext>(DEFAULT_TAB_CONTEXT);

  /** 탭 간 딥-링크 네비게이션 */
  const handleNavigate = useCallback(
    (page: string, ctx?: Partial<TabContext>) => {
      setTabContext((prev) => mergeContext(prev, ctx));
      setCurrentPage(page);
    },
    [],
  );

  const renderContent = () => {
    switch (currentPage) {
      case 'national-dashboard':
        return <NationalDashboard onNavigate={handleNavigate} />;
      case 'kpi-dictionary':
        return <KPIDictionary onNavigate={handleNavigate} />;
      case 'model-apply':
        return <ModelApplyDashboard />;
      case 'model-governance':
        return <ModelGovernance context={tabContext} onNavigate={handleNavigate} />;
      case 'quality-monitoring':
        return <QualityMonitoring context={tabContext} onNavigate={handleNavigate} />;
      case 'compliance-audit':
        return <ComplianceAudit context={tabContext} onNavigate={handleNavigate} />;
      case 'settings':
        return <CentralSettings userRole={userRole} />;
      default:
        return <NationalDashboard onNavigate={handleNavigate} />;
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
