import React, { useState } from 'react';
import { MobileContainer } from '../MobileContainer';
import { Button } from '../ui/button';
import { AlertCard } from '../AlertCard';
import { ArrowLeft, Calendar, CheckCircle } from 'lucide-react';

interface LaterContactProps {
  onBack: () => void;
  onConfirm: () => void;
}

export function LaterContact({ onBack, onConfirm }: LaterContactProps) {
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    setConfirmed(true);
    setTimeout(() => {
      onConfirm();
    }, 2000);
  };

  const twoWeeksLater = new Date();
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
  const formattedDate = twoWeeksLater.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <MobileContainer
      footer={
        !confirmed && (
          <div className="p-4 space-y-2">
            <Button onClick={handleConfirm} className="w-full bg-[#2563eb] hover:bg-[#1d4ed8]">
              확인
            </Button>
            <Button onClick={onBack} variant="outline" className="w-full">
              취소
            </Button>
          </div>
        )
      }
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b">
          {!confirmed && (
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2>나중에 연락받기</h2>
        </div>

        {confirmed ? (
          <div className="space-y-6 py-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3>신청이 완료되었습니다</h3>
              <p className="text-muted-foreground">
                {formattedDate}에 안내 문자를 보내드리겠습니다.
              </p>
            </div>
            <AlertCard
              type="info"
              message="언제든지 필요하시면 상담 예약 메뉴를 이용해주세요."
            />
          </div>
        ) : (
          <>
            {/* Info */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-6 h-6 text-[#2563eb] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="mb-2">2주 후 안내 예정</h3>
                  <p className="text-sm text-muted-foreground">
                    약 {formattedDate}경에 문자 메시지로 다시 연락드리겠습니다.
                  </p>
                </div>
              </div>

              <AlertCard
                type="info"
                message="안내 문자를 받으신 후 편한 시간에 상담을 예약하실 수 있습니다."
              />

              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h4 className="text-sm">안내 사항</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 전화번호가 변경되시면 문의 메뉴를 통해 알려주세요</li>
                  <li>• 긴급한 상황이 발생하면 즉시 1577-0199로 연락주세요</li>
                  <li>• 언제든지 상담 예약 메뉴를 통해 먼저 예약하실 수 있습니다</li>
                </ul>
              </div>
            </div>

            <AlertCard
              type="warning"
              title="긴급 상황 시"
              message="즉각적인 도움이 필요하신 경우 24시간 긴급전화 1577-0199로 연락주세요."
            />
          </>
        )}
      </div>
    </MobileContainer>
  );
}
