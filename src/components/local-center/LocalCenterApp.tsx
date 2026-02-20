import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MainDashboard } from './v2/MainDashboard';
import { CaseDashboard, type CaseDashboardViewState } from './v2/CaseDashboard';
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
import { applyDrilldownFilter, setGlobalFilters } from './v2/caseSSOT';

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
  const [caseSearchKeyword, setCaseSearchKeyword] = useState('');
  const [caseDashboardViewState, setCaseDashboardViewState] = useState<CaseDashboardViewState | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const caseDashboardScrollTopRef = useRef(0);
  const shouldRestoreDashboardScrollRef = useRef(false);

  const handleCaseSelect = useCallback((caseId: string, stage: StageType) => {
    caseDashboardScrollTopRef.current = mainScrollRef.current?.scrollTop ?? 0;
    setSelectedCaseId(caseId);
    setSelectedCaseStage(stage);
    setCaseSubView('detail');
    setActiveTab('cases');
  }, []);

  const handleNavigateToCases = useCallback((filter: string) => {
    applyDrilldownFilter(filter);
    setCurrentFilter(filter);
    setCaseDashboardViewState(null);
    shouldRestoreDashboardScrollRef.current = false;
    setSelectedCaseId(null);
    setCaseSubView('detail');
    setActiveTab('cases');
  }, []);

  const resetCaseSelection = useCallback(() => {
    shouldRestoreDashboardScrollRef.current = true;
    setSelectedCaseId(null);
    setCaseSubView('detail');
  }, []);

  useEffect(() => {
    if (!shouldRestoreDashboardScrollRef.current) return;
    if (activeTab !== 'cases' || selectedCaseId !== null) return;

    const rafId = window.requestAnimationFrame(() => {
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = caseDashboardScrollTopRef.current;
      }
      shouldRestoreDashboardScrollRef.current = false;
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [activeTab, selectedCaseId]);

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
            externalSearchKeyword={caseSearchKeyword}
            onExternalSearchKeywordChange={setCaseSearchKeyword}
            initialViewState={caseDashboardViewState}
            onViewStateChange={setCaseDashboardViewState}
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
          if (tab !== 'cases') {
            setGlobalFilters({ stage: 'ALL', status: 'ALL', keyword: '' });
          }
          setActiveTab(tab);
          shouldRestoreDashboardScrollRef.current = false;
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
          <Header
            activeTab={activeTab}
            caseSearchKeyword={caseSearchKeyword}
            onCaseSearchKeywordChange={setCaseSearchKeyword}
          />
        )}

        <main ref={mainScrollRef} className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
