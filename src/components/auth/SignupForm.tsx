import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { AlertCard } from '../AlertCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface SignupFormProps {
  onSignup: (data: SignupData) => void;
  onLoginClick: () => void;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  role: string;
  organization: string;
}

export function SignupForm({ onSignup, onLoginClick }: SignupFormProps) {
  const [formData, setFormData] = useState<SignupData>({
    email: '',
    password: '',
    name: '',
    role: '',
    organization: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password || !formData.name || !formData.role) {
      setError('모든 필수 항목을 입력해주세요.');
      return;
    }

    if (formData.password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    onSignup(formData);
  };

  const updateField = (field: keyof SignupData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#2563eb] rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">NS</span>
            </div>
          </div>
          <CardTitle className="text-2xl">회원가입</CardTitle>
          <CardDescription>Neuro-Shield 계정을 만들어주세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <AlertCard type="error" message={error} />}

            <div className="space-y-2">
              <Label htmlFor="name">이름 *</Label>
              <Input
                id="name"
                type="text"
                placeholder="이름을 입력하세요"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="bg-input-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">이메일 *</Label>
              <Input
                id="email"
                type="email"
                placeholder="이메일을 입력하세요"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="bg-input-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">역할 *</Label>
              <Select value={formData.role} onValueChange={(value) => updateField('role', value)}>
                <SelectTrigger className="bg-input-background">
                  <SelectValue placeholder="역할을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citizen">시민</SelectItem>
                  <SelectItem value="counselor">상담사 (기초센터)</SelectItem>
                  <SelectItem value="regional-admin">광역센터 관리자</SelectItem>
                  <SelectItem value="central-admin">중앙 관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">소속 기관</Label>
              <Input
                id="organization"
                type="text"
                placeholder="소속 기관을 입력하세요 (선택)"
                value={formData.organization}
                onChange={(e) => updateField('organization', e.target.value)}
                className="bg-input-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 *</Label>
              <Input
                id="password"
                type="password"
                placeholder="8자 이상 입력하세요"
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="bg-input-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인 *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-input-background"
              />
            </div>

            <Button type="submit" className="w-full bg-[#2563eb] hover:bg-[#1d4ed8]">
              가입하기
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
              <button
                type="button"
                onClick={onLoginClick}
                className="text-primary hover:underline"
              >
                로그인
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
