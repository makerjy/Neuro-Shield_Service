import React, { useState } from 'react';
import { ArrowLeft, Shield, Building2, User, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { NeuroShieldLogoLarge } from '../ui/NeuroShieldLogo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { toast } from 'sonner@2.0.3';

type AuthMode = 'select' | 'login' | 'register';
type UserRole = 'citizen' | 'local_center' | 'regional_center' | 'central_admin';

const DEMO_CITIZEN_TOKEN_DEFAULT = 'R-2ldKkoGbDF-marBFEbgVilAXB5Tw0r';

function normalizeBasePath(path: string) {
  if (!path || !path.trim()) return '/neuro-shield/';
  let normalized = path.trim();
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (!normalized.endsWith('/')) normalized = `${normalized}/`;
  return normalized;
}

function resolveCitizenEntryUrl(): string {
  const envAny = import.meta.env as Record<string, string | undefined>;
  const explicitUrl = (envAny.VITE_CITIZEN_ENTRY_URL || envAny.VITE_STAGE1_DEMO_LINK || '').trim();
  if (explicitUrl) return explicitUrl;

  const token = (envAny.VITE_CITIZEN_DEMO_TOKEN || DEMO_CITIZEN_TOKEN_DEFAULT).trim();
  const basePath = normalizeBasePath(envAny.VITE_BASE_PATH || '/neuro-shield/');
  return `${window.location.origin}${basePath}p/sms?t=${encodeURIComponent(token)}`;
}

interface DemoAccount {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  organization?: string;
}

const demoAccounts: DemoAccount[] = [
  {
    email: 'admin@central.gov.kr',
    password: 'demo1234',
    role: 'central_admin',
    name: '중앙관리자',
    organization: '중앙정신건강복지센터',
  },
  {
    email: 'regional@seoul.go.kr',
    password: 'demo1234',
    role: 'regional_center',
    name: '광역담당자',
    organization: '서울시 광역정신건강복지센터',
  },
  {
    email: 'local@gangnam.go.kr',
    password: 'demo1234',
    role: 'local_center',
    name: '이상담',
    organization: '서울시 강남구 치매안심센터',
  },
];

interface AuthSystemProps {
  onLogin: (user: { email: string; role: UserRole; name: string; organization?: string }) => void;
}

export function AuthSystem({ onLogin }: AuthSystemProps) {
  const [mode, setMode] = useState<AuthMode>('select');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [step, setStep] = useState(1);

  const roles = [
    {
      id: 'citizen' as UserRole,
      title: '시민',
      description: '예약 및 상담 서비스 (로그인 없음)',
      icon: User,
      color: 'bg-blue-600',
    },
    {
      id: 'local_center' as UserRole,
      title: '기초센터',
      description: '읍/면/동 치매안심센터',
      icon: Building2,
      color: 'bg-green-600',
    },
    {
      id: 'regional_center' as UserRole,
      title: '광역센터',
      description: '광역 정신건강복지센터',
      icon: Building2,
      color: 'bg-purple-600',
    },
    {
      id: 'central_admin' as UserRole,
      title: '중앙관리',
      description: '중앙 정신건강복지센터',
      icon: Shield,
      color: 'bg-red-600',
    },
  ];

  const handleRoleSelect = (role: UserRole) => {
    if (role === 'citizen') {
      const entryUrl = resolveCitizenEntryUrl();
      try {
        window.location.href = entryUrl;
      } catch {
        window.location.hash = '#citizen';
      }
      return;
    }

    setSelectedRole(role);
    setMode('login');
  };

  const handleLogin = () => {
    if (!email || !password) {
      toast.error('이메일과 비밀번호를 입력해주세요');
      return;
    }

    // Check demo accounts
    const demoAccount = demoAccounts.find(
      (acc) => acc.email === email && acc.password === password
    );

    if (demoAccount) {
      // Audit log
      console.log('[AUDIT] Login Success:', {
        email,
        role: demoAccount.role,
        timestamp: new Date().toISOString(),
        ipAddress: 'CLIENT_IP',
      });

      if (rememberEmail) {
        localStorage.setItem('rememberedEmail', email);
      }

      toast.success(`로그인 성공: ${demoAccount.name}`);
      onLogin({
        email: demoAccount.email,
        role: demoAccount.role,
        name: demoAccount.name,
        organization: demoAccount.organization,
      });
    } else {
      console.log('[AUDIT] Login Failed:', {
        email,
        timestamp: new Date().toISOString(),
        reason: 'Invalid credentials',
      });
      toast.error('이메일 또는 비밀번호가 올바르지 않습니다');
    }
  };

  const handleRegister = () => {
    if (step === 1) {
      if (!email || !password) {
        toast.error('이메일과 비밀번호를 입력해주세요');
        return;
      }
      setStep(2);
    } else {
      if (!name || (selectedRole !== 'citizen' && !organization)) {
        toast.error('모든 필수 항목을 입력해주세요');
        return;
      }

      // Audit log
      console.log('[AUDIT] Registration:', {
        email,
        role: selectedRole,
        name,
        organization,
        timestamp: new Date().toISOString(),
      });

      toast.success('회원가입이 완료되었습니다');
      setMode('login');
      setStep(1);
    }
  };

  const handleBack = () => {
    if (mode === 'register' && step === 2) {
      setStep(1);
    } else {
      setMode('select');
      setSelectedRole(null);
      setStep(1);
      setEmail('');
      setPassword('');
      setName('');
      setOrganization('');
    }
  };

  const fillDemoAccount = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    toast.info(`데모 계정 정보가 입력되었습니다: ${account.name}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <NeuroShieldLogoLarge size={88} />
        </div>

        {/* Role Selection */}
        {mode === 'select' && (
          <div className="space-y-6">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-center">서비스/기관 선택</CardTitle>
                <CardDescription className="text-center">
                  시민 서비스는 로그인 없이 바로 이용할 수 있습니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {roles.map((role) => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.id}
                        onClick={() => handleRoleSelect(role.id)}
                        className="p-6 border-2 border-gray-300 hover:border-primary rounded transition-all hover:shadow-lg group"
                      >
                        <div className={`${role.color} w-16 h-16 rounded flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                          <Icon className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{role.title}</h3>
                        <p className="text-sm text-gray-600">{role.description}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Demo Accounts Info */}
            <Card className="border-blue-300 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  데모 계정 안내
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-800 mb-4">
                  아래 데모 계정으로 시스템을 체험할 수 있습니다:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {demoAccounts.map((account) => (
                    <div key={account.email} className="bg-white p-3 rounded border border-blue-200">
                      <p className="font-semibold text-gray-900 mb-1">{account.name}</p>
                      <p className="text-xs text-gray-600 mb-1">{account.email}</p>
                      <p className="text-xs text-gray-500">비밀번호: {account.password}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && selectedRole && (
          <Card className="max-w-md mx-auto border-2">
            <CardHeader>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="mb-2 -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                뒤로
              </Button>
              <CardTitle>
                {roles.find((r) => r.id === selectedRole)?.title} 로그인
              </CardTitle>
              <CardDescription>
                계정 정보를 입력하여 로그인하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@domain.com"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="password">비밀번호</Label>
                <div className="relative mt-2">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberEmail}
                  onCheckedChange={(checked) => setRememberEmail(checked as boolean)}
                />
                <label htmlFor="remember" className="text-sm text-gray-700 cursor-pointer">
                  이메일 저장
                </label>
              </div>

              <Button className="w-full" onClick={handleLogin}>
                로그인
              </Button>

              <div className="text-center">
                <button
                  onClick={() => setMode('register')}
                  className="text-sm text-primary hover:underline"
                >
                  계정이 없으신가요? 회원가입
                </button>
              </div>

              {/* Quick Demo Login */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="text-sm font-medium mb-2">빠른 로그인:</p>
                  <div className="space-y-1">
                    {demoAccounts
                      .filter((acc) => acc.role === selectedRole)
                      .map((account) => (
                        <button
                          key={account.email}
                          onClick={() => fillDemoAccount(account)}
                          className="text-xs text-blue-600 hover:underline block"
                        >
                          {account.name} ({account.email})
                        </button>
                      ))}
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Register Form */}
        {mode === 'register' && selectedRole && (
          <Card className="max-w-md mx-auto border-2">
            <CardHeader>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="mb-2 -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                뒤로
              </Button>
              <CardTitle>
                {roles.find((r) => r.id === selectedRole)?.title} 회원가입
              </CardTitle>
              <CardDescription>
                {step === 1 ? '계정 정보를 입력하세요' : '추가 정보를 입력하세요'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 1 ? (
                <>
                  <div>
                    <Label htmlFor="reg-email">이메일 *</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@domain.com"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="reg-password">비밀번호 *</Label>
                    <div className="relative mt-2">
                      <Input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="8자 이상"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="name">이름 *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="홍길동"
                      className="mt-2"
                    />
                  </div>

                  {selectedRole !== 'citizen' && (
                    <div>
                      <Label htmlFor="organization">소속 기관 *</Label>
                      <Input
                        id="organization"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="예: 서울시 강남구 치매안심센터"
                        className="mt-2"
                      />
                    </div>
                  )}
                </>
              )}

              <Button className="w-full" onClick={handleRegister}>
                {step === 1 ? '다음' : '회원가입 완료'}
              </Button>

              <div className="text-center">
                <button
                  onClick={() => {
                    setMode('login');
                    setStep(1);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  이미 계정이 있으신가요? 로그인
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>© 2026 Neuro-Shield. All rights reserved.</p>
          <p className="mt-1">중앙정신건강복지센터</p>
        </div>
      </div>
    </div>
  );
}
