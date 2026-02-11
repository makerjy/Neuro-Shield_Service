import React, { useState } from 'react';
import { LocalCenterLayout } from './LocalCenterLayout';
import { CaseDashboard } from './CaseDashboard';
import { Calendar } from './Calendar';
import { CaseDetail } from './CaseDetail';
import { ConsultationPage } from './ConsultationPage';
import { ConsultationSession } from './ConsultationSession';
import { AppointmentBooking } from './AppointmentBooking';
import { ChurnManagement } from './ChurnManagement';
import { ReportGeneration } from './ReportGeneration';
import { AuditLog } from './AuditLog';
import { Settings } from './Settings';
import { CaseDetailStage2 } from './CaseDetailStage2';
import { CaseDetailStage3 } from './CaseDetailStage3';

type PageType = 
  | 'dashboard' 
  | 'calendar' 
  | 'case-detail' 
  | 'case-detail-stage2'
  | 'case-detail-stage3'
  | 'consultation-page'
  | 'consultation' 
  | 'appointment-booking'
  | 'churn-management'
  | 'reports' 
  | 'audit-log'
  | 'settings';

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
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [selectedCaseName, setSelectedCaseName] = useState<string>('');
  const [selectedCasePhone, setSelectedCasePhone] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<number>(1);

  const handleCaseSelect = (caseId: string, stage?: number) => {
    setSelectedCaseId(caseId);
    setSelectedCaseName('김민수');
    setSelectedCasePhone('010-1234-5678');
    const s = stage ?? 1;
    setSelectedStage(s);
    if (s === 2) setCurrentPage('case-detail-stage2');
    else if (s === 3) setCurrentPage('case-detail-stage3');
    else setCurrentPage('case-detail');
  };

  const handleStartConsultation = (caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentPage('consultation-page');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <CaseDashboard onCaseSelect={handleCaseSelect} />;
      case 'case-detail-stage2':
        return (
          <CaseDetailStage2
            caseId={selectedCaseId}
            onBack={() => setCurrentPage('dashboard')}
          />
        );
      case 'case-detail-stage3':
        return (
          <CaseDetailStage3
            caseId={selectedCaseId}
            onBack={() => setCurrentPage('dashboard')}
          />
        );
      case 'calendar':
        return <Calendar />;
      case 'case-detail':
        return (
          <CaseDetail 
            caseId={selectedCaseId} 
            onBack={() => setCurrentPage('dashboard')}
            onStartConsultation={handleStartConsultation}
          />
        );
      case 'consultation-page':
        return (
          <ConsultationPage
            caseId={selectedCaseId}
            onComplete={() => setCurrentPage('dashboard')}
            onCancel={() => setCurrentPage('case-detail')}
            onBack={() => setCurrentPage('case-detail')}
          />
        );
      case 'consultation':
        return (
          <ConsultationSession
            caseId={selectedCaseId}
            patientName={selectedCaseName}
            onComplete={() => setCurrentPage('dashboard')}
            onCancel={() => setCurrentPage('case-detail')}
          />
        );
      case 'appointment-booking':
        return (
          <AppointmentBooking
            caseId={selectedCaseId}
            patientName={selectedCaseName}
            patientPhone={selectedCasePhone}
            onComplete={() => setCurrentPage('dashboard')}
            onCancel={() => setCurrentPage('case-detail')}
          />
        );
      case 'churn-management':
        return (
          <ChurnManagement
            caseId={selectedCaseId}
            patientName={selectedCaseName}
            patientPhone={selectedCasePhone}
            onComplete={() => setCurrentPage('dashboard')}
            onCancel={() => setCurrentPage('case-detail')}
          />
        );
      case 'reports':
        return <ReportGeneration />;
      case 'audit-log':
        return <AuditLog />;
      case 'settings':
        return <Settings userName={userName} userRole={userRole} centerName={centerName} />;
      default:
        return <CaseDashboard onCaseSelect={handleCaseSelect} />;
    }
  };

  return (
    <LocalCenterLayout
      currentPage={currentPage}
      userRole={userRole}
      userName={userName}
      centerName={centerName}
      onPageChange={setCurrentPage}
      onLogout={onLogout}
    >
      {renderPage()}
    </LocalCenterLayout>
  );
}