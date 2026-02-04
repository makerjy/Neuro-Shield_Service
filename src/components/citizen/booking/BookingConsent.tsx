import React, { useState } from 'react';
import { MobileContainer } from '../../MobileContainer';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { AlertCard } from '../../AlertCard';
import { ArrowLeft, Shield, Lock, FileText } from 'lucide-react';

interface BookingConsentProps {
  onNext: () => void;
  onBack: () => void;
}

export function BookingConsent({ onNext, onBack }: BookingConsentProps) {
  const [consents, setConsents] = useState({
    privacy: false,
    terms: false,
    sms: false,
  });

  const allConsented = consents.privacy && consents.terms && consents.sms;

  const toggleConsent = (key: keyof typeof consents) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <MobileContainer
      footer={
        <div className="p-4">
          <Button
            onClick={onNext}
            disabled={!allConsented}
            className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            다음 단계로
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2>상담 예약</h2>
            <p className="text-sm text-muted-foreground">1단계: 동의</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2">
          <div className="flex-1 h-2 bg-[#2563eb] rounded-full" />
          <div className="flex-1 h-2 bg-gray-200 rounded-full" />
          <div className="flex-1 h-2 bg-gray-200 rounded-full" />
          <div className="flex-1 h-2 bg-gray-200 rounded-full" />
        </div>

        {/* Info */}
        <AlertCard
          type="info"
          title="안전한 상담 서비스"
          message="모든 상담 내용은 안전하게 보호되며, 귀하의 동의 없이 제3자에게 공유되지 않습니다."
        />

        {/* Consent Items */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#2563eb] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="privacy"
                    checked={consents.privacy}
                    onCheckedChange={() => toggleConsent('privacy')}
                  />
                  <label htmlFor="privacy" className="cursor-pointer">
                    개인정보 수집 및 이용 동의 (필수)
                  </label>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  상담 서비스 제공을 위해 필요한 최소한의 개인정보를 수집합니다.
                </p>
                <button className="text-sm text-[#2563eb] hover:underline ml-6 mt-1">
                  자세히 보기
                </button>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#2563eb] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="terms"
                    checked={consents.terms}
                    onCheckedChange={() => toggleConsent('terms')}
                  />
                  <label htmlFor="terms" className="cursor-pointer">
                    서비스 이용약관 동의 (필수)
                  </label>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  상담 서비스 이용에 관한 권리와 의무사항에 동의합니다.
                </p>
                <button className="text-sm text-[#2563eb] hover:underline ml-6 mt-1">
                  자세히 보기
                </button>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#2563eb] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="sms"
                    checked={consents.sms}
                    onCheckedChange={() => toggleConsent('sms')}
                  />
                  <label htmlFor="sms" className="cursor-pointer">
                    SMS 알림 수신 동의 (필수)
                  </label>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  예약 확인, 일정 변경 등 중요한 안내를 문자로 받습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        <AlertCard
          type="warning"
          message="의료 상담이나 진단은 제공되지 않습니다. 정신건강 지원 및 필요 시 전문기관 연계를 도와드립니다."
        />
      </div>
    </MobileContainer>
  );
}
