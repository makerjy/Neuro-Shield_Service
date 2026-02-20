import React, { useEffect, useState } from 'react';
import { AuthSystem } from './components/auth/AuthSystem';
import { CitizenMobileApp } from './components/citizen/CitizenMobileApp';
import { PublicSmsLanding } from './components/citizen/PublicSmsLanding';
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

function normalizeBasePath(path: string) {
  if (!path || !path.trim()) return '/neuro-shield/';
  let normalized = path.trim();
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (!normalized.endsWith('/')) normalized = `${normalized}/`;
  return normalized;
}

function isPublicSmsPathname(pathname: string): boolean {
  if (pathname === '/p/sms' || pathname === '/p/sms/') return true;
  const basePath = normalizeBasePath(import.meta.env.VITE_BASE_PATH || '/neuro-shield/');
  if (!pathname.startsWith(basePath)) return false;
  const stripped = pathname.slice(basePath.length - 1);
  return stripped === '/p/sms' || stripped === '/p/sms/';
}

function isCitizenLegacyPathname(pathname: string): boolean {
  const legacyPaths = new Set(['/citizen', '/citizen/', '/p/citizen', '/p/citizen/', '/citizen-portal', '/citizen-portal/']);
  if (legacyPaths.has(pathname)) return true;
  const basePath = normalizeBasePath(import.meta.env.VITE_BASE_PATH || '/neuro-shield/');
  if (!pathname.startsWith(basePath)) return false;
  const stripped = pathname.slice(basePath.length - 1);
  return legacyPaths.has(stripped);
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

function useCitizenLegacyPathAccess() {
  const [isCitizenPath, setIsCitizenPath] = useState(() => isCitizenLegacyPathname(window.location.pathname));

  useEffect(() => {
    const onRouteChange = () => setIsCitizenPath(isCitizenLegacyPathname(window.location.pathname));
    window.addEventListener('popstate', onRouteChange);
    window.addEventListener('hashchange', onRouteChange);
    return () => {
      window.removeEventListener('popstate', onRouteChange);
      window.removeEventListener('hashchange', onRouteChange);
    };
  }, []);

  return isCitizenPath;
}

/** URL 경로가 /p/sms 이면 공개 링크 랜딩 화면 접근 */
function usePublicSmsLandingAccess() {
  const [isLanding, setIsLanding] = useState(() => isPublicSmsPathname(window.location.pathname));

  useEffect(() => {
    const onRouteChange = () => setIsLanding(isPublicSmsPathname(window.location.pathname));
    window.addEventListener('popstate', onRouteChange);
    window.addEventListener('hashchange', onRouteChange);
    return () => {
      window.removeEventListener('popstate', onRouteChange);
      window.removeEventListener('hashchange', onRouteChange);
    };
  }, []);

  return isLanding;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const isCitizenDirectByHash = useCitizenDirectAccess();
  const isCitizenLegacyPath = useCitizenLegacyPathAccess();
  const isCitizenDirect = isCitizenDirectByHash || isCitizenLegacyPath;
  const isPublicSmsLanding = usePublicSmsLandingAccess();

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

  // 문자 링크 공개 랜딩 (/p/sms?t=:token)
  if (isPublicSmsLanding) {
    return (
      <>
        <Toaster />
        <PublicSmsLanding />
      </>
    );
  }

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
