import React, { useState } from 'react';
import { MobileContainer } from '../../MobileContainer';
import { Button } from '../../ui/button';
import { ArrowLeft, Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '../../ui/calendar';

interface BookingDateTimeProps {
  onNext: (date: Date, time: string) => void;
  onBack: () => void;
}

export function BookingDateTime({ onNext, onBack }: BookingDateTimeProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>('');

  const timeSlots = [
    '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  const availableSlots = selectedDate ? timeSlots : [];

  const canProceed = selectedDate && selectedTime;

  return (
    <MobileContainer
      footer={
        <div className="p-4">
          <Button
            onClick={() => selectedDate && onNext(selectedDate, selectedTime)}
            disabled={!canProceed}
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
            <p className="text-sm text-muted-foreground">3단계: 날짜 및 시간 선택</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2">
          <div className="flex-1 h-2 bg-[#2563eb] rounded-full" />
          <div className="flex-1 h-2 bg-[#2563eb] rounded-full" />
          <div className="flex-1 h-2 bg-[#2563eb] rounded-full" />
          <div className="flex-1 h-2 bg-gray-200 rounded-full" />
        </div>

        {/* Calendar */}
        <div>
          <h3 className="mb-3">날짜 선택</h3>
          <div className="border rounded-lg p-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
              className="rounded-md"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            * 주말 및 공휴일은 선택할 수 없습니다
          </p>
        </div>

        {/* Time Slots */}
        {selectedDate && (
          <div>
            <h3 className="mb-3">시간 선택</h3>
            <div className="grid grid-cols-4 gap-2">
              {availableSlots.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? 'default' : 'outline'}
                  className={
                    selectedTime === time
                      ? 'bg-[#2563eb] hover:bg-[#1d4ed8]'
                      : ''
                  }
                  onClick={() => setSelectedTime(time)}
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Selected Info */}
        {selectedDate && selectedTime && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CalendarIcon className="w-5 h-5 text-[#2563eb] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-blue-900 mb-1">선택한 일정</h4>
                <p className="text-sm text-blue-700">
                  {selectedDate.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}{' '}
                  {selectedTime}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileContainer>
  );
}
