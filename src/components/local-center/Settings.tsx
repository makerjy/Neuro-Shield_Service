import React, { useState } from 'react';
import { User, Bell, Lock, Globe, Palette, Shield, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { toast } from 'sonner@2.0.3';

interface SettingsProps {
  userName: string;
  userRole: 'counselor' | 'center_manager';
  centerName: string;
}

export function Settings({ userName, userRole, centerName }: SettingsProps) {
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsReminders, setSmsReminders] = useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  
  const [displayName, setDisplayName] = useState(userName);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSaveProfile = () => {
    console.log('[AUDIT] Profile Updated:', {
      userName: displayName,
      timestamp: new Date().toISOString(),
    });
    toast.success('프로필이 저장되었습니다');
  };

  const handleSaveNotifications = () => {
    console.log('[AUDIT] Notification Settings Updated:', {
      notificationEnabled,
      emailNotifications,
      smsReminders,
      timestamp: new Date().toISOString(),
    });
    toast.success('알림 설정이 저장되었습니다');
  };

  const handleSavePreferences = () => {
    console.log('[AUDIT] Preferences Updated:', {
      autoSaveEnabled,
      darkMode,
      timestamp: new Date().toISOString(),
    });
    toast.success('환경 설정이 저장되었습니다');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">설정</h1>
        <p className="text-gray-600">시스템 및 개인 설정을 관리합니다</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            프로필 정보
          </CardTitle>
          <CardDescription>
            개인 정보를 수정할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="mt-2"
            />
          </div>

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
            <Label htmlFor="phone">연락처</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              className="mt-2"
            />
          </div>

          <div>
            <Label>소속 기관</Label>
            <Input
              value={centerName}
              disabled
              className="mt-2 bg-gray-50"
            />
          </div>

          <div>
            <Label>역할</Label>
            <Input
              value={userRole === 'counselor' ? '상담사' : '센터장'}
              disabled
              className="mt-2 bg-gray-50"
            />
          </div>

          <Button onClick={handleSaveProfile}>
            <Save className="h-4 w-4 mr-2" />
            프로필 저장
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            알림 설정
          </CardTitle>
          <CardDescription>
            알림 수신 방법을 설정합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">시스템 알림</p>
              <p className="text-sm text-gray-600">
                새로운 케이스, 예약, 중요 이벤트 알림
              </p>
            </div>
            <Switch
              checked={notificationEnabled}
              onCheckedChange={setNotificationEnabled}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">이메일 알림</p>
              <p className="text-sm text-gray-600">
                일일 요약 및 보고서를 이메일로 수신
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
              disabled={!notificationEnabled}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">SMS 리마인더</p>
              <p className="text-sm text-gray-600">
                예약 및 상담 일정을 SMS로 수신
              </p>
            </div>
            <Switch
              checked={smsReminders}
              onCheckedChange={setSmsReminders}
              disabled={!notificationEnabled}
            />
          </div>

          <Button onClick={handleSaveNotifications}>
            <Save className="h-4 w-4 mr-2" />
            알림 설정 저장
          </Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            환경 설정
          </CardTitle>
          <CardDescription>
            작업 환경을 개인화합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">자동 저장</p>
              <p className="text-sm text-gray-600">
                상담 및 보고서 작성 시 자동으로 저장
              </p>
            </div>
            <Switch
              checked={autoSaveEnabled}
              onCheckedChange={setAutoSaveEnabled}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">다크 모드</p>
              <p className="text-sm text-gray-600">
                어두운 테마 사용 (준비 중)
              </p>
            </div>
            <Switch
              checked={darkMode}
              onCheckedChange={setDarkMode}
              disabled
            />
          </div>

          <Button onClick={handleSavePreferences}>
            <Save className="h-4 w-4 mr-2" />
            환경 설정 저장
          </Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            보안 설정
          </CardTitle>
          <CardDescription>
            계정 보안을 관리합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full justify-start">
            <Lock className="h-4 w-4 mr-2" />
            비밀번호 변경
          </Button>

          <Button variant="outline" className="w-full justify-start">
            <Shield className="h-4 w-4 mr-2" />
            2단계 인증 설정
          </Button>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-900">
              <strong>보안 팁:</strong> 정기적으로 비밀번호를 변경하고 2단계 인증을 활성화하여 계정을 보호하세요.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            개인정보 처리
          </CardTitle>
          <CardDescription>
            개인정보 열람 및 처리 기록
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded">
            <p className="text-sm text-gray-700 mb-2">
              모든 개인정보 접근은 감사로그에 기록됩니다.
            </p>
            <p className="text-xs text-gray-600">
              개인정보보호법 준수를 위해 불필요한 개인정보 열람은 자제해 주시기 바랍니다.
            </p>
          </div>

          <Button variant="outline" className="w-full justify-start">
            내 접근 기록 보기
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
