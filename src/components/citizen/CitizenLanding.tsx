import React from 'react';
import { MobileContainer } from '../MobileContainer';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Calendar, MessageCircle, HelpCircle, Phone } from 'lucide-react';

interface CitizenLandingProps {
  onBooking: () => void;
  onLater: () => void;
  onFAQ: () => void;
  onSupport: () => void;
}

export function CitizenLanding({ onBooking, onLater, onFAQ, onSupport }: CitizenLandingProps) {
  return (
    <MobileContainer>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#2563eb] rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">NS</span>
            </div>
          </div>
          <h1 className="text-2xl">안녕하세요</h1>
          <p className="text-muted-foreground">
            정신건강 지원 서비스에 오신 것을 환영합니다
          </p>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h3 className="text-blue-900 mb-2">무료 상담 서비스</h3>
            <p className="text-sm text-blue-700">
              전문 상담사와의 1:1 상담을 통해 필요한 도움을 받으실 수 있습니다. 
              모든 상담 내용은 안전하게 보호됩니다.
            </p>
          </CardContent>
        </Card>

        {/* Main Actions */}
        <div className="space-y-3">
          <Button
            onClick={onBooking}
            className="w-full h-auto py-4 bg-[#2563eb] hover:bg-[#1d4ed8] flex items-start"
          >
            <Calendar className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-left flex-1">
              <div>상담 예약하기</div>
              <div className="text-xs opacity-90 font-normal">
                편한 시간에 상담을 예약하세요
              </div>
            </div>
          </Button>

          <Button
            onClick={onLater}
            variant="outline"
            className="w-full h-auto py-4 flex items-start"
          >
            <Phone className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-left flex-1">
              <div>나중에 연락주세요</div>
              <div className="text-xs opacity-70 font-normal">
                2주 후 안내 문자를 보내드립니다
              </div>
            </div>
          </Button>
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={onFAQ}
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
          >
            <HelpCircle className="w-6 h-6" />
            <span className="text-sm">자주 묻는 질문</span>
          </Button>

          <Button
            onClick={onSupport}
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-sm">문의 / 지원</span>
          </Button>
        </div>

        {/* Footer Info */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>평일 09:00 - 18:00 운영</p>
          <p>긴급한 경우 1577-0199 (24시간)</p>
        </div>
      </div>
    </MobileContainer>
  );
}
