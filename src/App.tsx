import React, { useState } from 'react';
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);

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
  };

  // Render appropriate app based on user role
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
