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

type PageType = 
  | 'dashboard' 
  | 'calendar' 
  | 'case-detail' 
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

  const handleCaseSelect = (caseId: string) => {
    setSelectedCaseId(caseId);
    // In a real app, we would fetch the case details
    setSelectedCaseName('김민수');
    setSelectedCasePhone('010-1234-5678');
    setCurrentPage('case-detail');
  };

  const handleStartConsultation = (caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentPage('consultation-page');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <CaseDashboard onCaseSelect={handleCaseSelect} />;
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