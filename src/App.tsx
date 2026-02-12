import React, { useEffect, useState } from 'react';
import { AuthSystem } from './components/auth/AuthSystem';
import { CitizenMobileApp } from './components/citizen/CitizenMobileApp';
import { LocalCenterApp } from './components/local-center/LocalCenterApp';
import { RegionalCenterApp } from './components/regional-center/RegionalCenterApp';
import { CentralCenterApp } from './components/central-center/CentralCenterApp';
import { Toaster } from './components/ui/sonner';

type UserRole = 'citizen' | 'local_center' | 'regional_center' | 'central_admin';

interface User {
  email: string;
  role: UserRole;
  name: string;
  organization?: string;
}

/** URL 해시가 #citizen 이면 로그인 없이 시민 화면 직접 접근 */
function useCitizenDirectAccess() {
  const [isCitizen, setIsCitizen] = useState(() => window.location.hash === '#citizen');

  useEffect(() => {
    const onHash = () => setIsCitizen(window.location.hash === '#citizen');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return isCitizen;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const isCitizenDirect = useCitizenDirectAccess();

  const handleLogin = (userData: User) => {
    setUser(userData);
    
    // Audit log
    console.log('[AUDIT] User Logged In:', {
      email: userData.email,
      role: userData.role,
      timestamp: new Date().toISOString(),
    });
  };

  const handleLogout = () => {
    console.log('[AUDIT] User Logged Out:', {
      email: user?.email,
      timestamp: new Date().toISOString(),
    });
    setUser(null);
    // 시민 해시가 남아있으면 제거
    if (window.location.hash === '#citizen') {
      history.replaceState(null, '', window.location.pathname);
    }
  };

  // 시민 직접 접근 (로그인 불필요)
  if (isCitizenDirect) {
    return (
      <>
        <Toaster />
        <CitizenMobileApp />
      </>
    );
  }

  // 로그인 전
  if (!user) {
    return (
      <>
        <Toaster />
        <AuthSystem onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <Toaster />
      
      {user.role === 'citizen' && (
        <CitizenMobileApp />
      )}

      {user.role === 'local_center' && (
        <LocalCenterApp
          userRole="counselor"
          userName={user.name}
          centerName={user.organization || '기초센터'}
          onLogout={handleLogout}
        />
      )}

      {user.role === 'regional_center' && (
        <RegionalCenterApp
          userRole="counselor"
          userName={user.name}
          centerName={user.organization || '광역센터'}
          onLogout={handleLogout}
        />
      )}

      {user.role === 'central_admin' && (
        <CentralCenterApp
          userRole="central_admin"
          userName={user.name}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
