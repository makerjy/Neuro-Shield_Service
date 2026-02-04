import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { AlertCard } from '../AlertCard';

interface LoginFormProps {
  onLogin: (email: string, password: string) => void;
  onSignupClick: () => void;
}

export function LoginForm({ onLogin, onSignupClick }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    onLogin(email, password);
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
          <CardTitle className="text-2xl">Neuro-Shield</CardTitle>
          <CardDescription>정신건강 위기관리 통합 시스템</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <AlertCard type="error" message={error} />}
            
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-input-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-input-background"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-primary hover:underline">
                비밀번호 찾기
              </button>
            </div>

            <Button type="submit" className="w-full bg-[#2563eb] hover:bg-[#1d4ed8]">
              로그인
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">계정이 없으신가요? </span>
              <button
                type="button"
                onClick={onSignupClick}
                className="text-primary hover:underline"
              >
                회원가입
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
