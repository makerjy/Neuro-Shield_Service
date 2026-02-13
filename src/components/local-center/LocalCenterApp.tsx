import React, { useState } from 'react';
import { MainDashboard } from './v2/MainDashboard';
import { CaseDashboard } from './v2/CaseDashboard';
import { CalendarView } from './v2/CalendarView';
import { ReportsView } from './v2/ReportsView';
import { SettingsView } from './v2/SettingsView';
import { Sidebar } from './v2/Sidebar';
import { Header } from './v2/Header';
import { CaseDetail } from './v2/CaseDetail';
import { type StageType, type TabType } from './v2/shared';
import { CaseDetailStage2 } from './CaseDetailStage2';
import { CaseDetailStage3 } from './CaseDetailStage3';
import { ConsultationPage } from './ConsultationPage';
import { SmsOperationsPage } from './SmsOperationsPage';

interface LocalCenterAppProps {
  userRole?: 'counselor' | 'center_manager';
  userName?: string;
  centerName?: string;
  onLogout: () => void;
}

export function LocalCenterApp({ 
  userRole = 'counselor',
  userName = '이상담',
  centerName = '서울시 강남구 치매안심센터',
  onLogout
}: LocalCenterAppProps) {
  const [activeTab, setActiveTab] = useState<TabType>('main');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCaseStage, setSelectedCaseStage] = useState<StageType>('Stage 1');
  const [currentFilter, setCurrentFilter] = useState<string | null>(null);
  const [caseSubView, setCaseSubView] = useState<'detail' | 'consultation' | 'sms' | 'stage-workflow'>('detail');

  const handleCaseSelect = (caseId: string, stage: StageType) => {
    setSelectedCaseId(caseId);
    setSelectedCaseStage(stage);
    setCaseSubView('detail');
    setActiveTab('cases');
  };

  const handleNavigateToCases = (filter: string) => {
    setCurrentFilter(filter);
    setSelectedCaseId(null);
    setCaseSubView('detail');
    setActiveTab('cases');
  };

  const resetCaseSelection = () => {
    setSelectedCaseId(null);
    setCaseSubView('detail');
  };

  const renderContent = () => {
    if (selectedCaseId && activeTab === 'cases') {
      if (caseSubView === 'consultation') {
        return (
          <ConsultationPage
            caseId={selectedCaseId}
            showReferralTab={false}
            onComplete={resetCaseSelection}
            onCancel={() => setCaseSubView('detail')}
            onBack={() => setCaseSubView('detail')}
          />
        );
      }

      if (caseSubView === 'sms') {
        return (
          <SmsOperationsPage
            caseId={selectedCaseId}
            onBack={() => setCaseSubView('detail')}
          />
        );
      }

      if (caseSubView === 'stage-workflow' && selectedCaseStage === 'Stage 2') {
        return (
          <CaseDetailStage2
            caseId={selectedCaseId}
            onBack={resetCaseSelection}
          />
        );
      }

      if (caseSubView === 'stage-workflow' && selectedCaseStage === 'Stage 3') {
        return (
          <CaseDetailStage3
            caseId={selectedCaseId}
            onBack={resetCaseSelection}
          />
        );
      }

      return (
        <CaseDetail
          caseId={selectedCaseId}
          stage={selectedCaseStage}
          onBack={resetCaseSelection}
        />
      );
    }

    switch (activeTab) {
      case 'main':
        return (
          <MainDashboard
            onNavigateToCases={handleNavigateToCases}
            onSelectCase={handleCaseSelect}
            centerName={centerName}
          />
        );
      case 'cases':
        return (
          <CaseDashboard
            onSelectCase={handleCaseSelect}
            initialFilter={currentFilter}
          />
        );
      case 'calendar':
        return <CalendarView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return (
          <MainDashboard
            onNavigateToCases={handleNavigateToCases}
            onSelectCase={handleCaseSelect}
            centerName={centerName}
          />
        );
    }
  };

  const isCaseDetailView = activeTab === 'cases' && selectedCaseId !== null;

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden text-slate-900 font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedCaseId(null);
          setCurrentFilter(null);
          setCaseSubView('detail');
        }}
        userName={userName}
        centerName={centerName}
        userRole={userRole}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {!isCaseDetailView && (
          <Header activeTab={activeTab} />
        )}

        <main className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
