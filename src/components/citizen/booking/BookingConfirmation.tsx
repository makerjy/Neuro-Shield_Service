import React from 'react';
import { MobileContainer } from '../../MobileContainer';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { AlertCard } from '../../AlertCard';
import { CheckCircle, Calendar, Clock, Building2, User, Phone } from 'lucide-react';

interface BookingConfirmationProps {
  bookingData: {
    organizationType: string;
    date: Date;
    time: string;
    name: string;
    phone: string;
    age: string;
    note?: string;
  };
  onComplete: () => void;
}

export function BookingConfirmation({ bookingData, onComplete }: BookingConfirmationProps) {
  const orgTypeLabel =
    bookingData.organizationType === 'local'
      ? '기초 정신건강복지센터'
      : '광역 정신건강복지센터';

  const formattedDate = bookingData.date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <MobileContainer
      footer={
        <div className="p-4">
          <Button onClick={onComplete} className="w-full bg-[#2563eb] hover:bg-[#1d4ed8]">
            확인
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        {/* Success Icon */}
        <div className="text-center py-6">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl mb-2">예약이 완료되었습니다</h2>
          <p className="text-muted-foreground">
            곧 문자 메시지로 예약 확인을 보내드리겠습니다
          </p>
        </div>

        {/* Booking Details */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="pb-2 border-b">예약 정보</h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">기관</p>
                  <p>{orgTypeLabel}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">날짜</p>
                  <p>{formattedDate}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">시간</p>
                  <p>{bookingData.time}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">이름</p>
                  <p>{bookingData.name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">연락처</p>
                  <p>{bookingData.phone}</p>
                </div>
              </div>

              {bookingData.note && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">상담 희망 내용</p>
                  <p className="text-sm">{bookingData.note}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Important Notes */}
        <div className="space-y-3">
          <AlertCard
            type="success"
            title="예약 확인"
            message="예약 확인 문자를 보내드렸습니다. 예약 시간 1일 전에 안내 문자를 다시 보내드립니다."
          />

          <AlertCard
            type="info"
            title="변경 및 취소"
            message="예약 변경이나 취소가 필요하시면 문의/지원 메뉴를 이용해주세요."
          />
        </div>

        {/* Additional Info */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <h4 className="text-sm">상담 준비 안내</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 상담 시간 10분 전까지 도착해주세요</li>
            <li>• 신분증을 지참해주세요</li>
            <li>• 편안한 마음으로 방문해주세요</li>
          </ul>
        </div>

        {/* Emergency Contact */}
        <div className="text-center text-sm text-muted-foreground border-t pt-4">
          <p>긴급한 경우 24시간 상담 가능</p>
          <p className="text-[#2563eb] mt-1">1577-0199</p>
        </div>
      </div>
    </MobileContainer>
  );
}
