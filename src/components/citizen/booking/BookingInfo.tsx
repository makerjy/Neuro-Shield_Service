import React, { useState } from 'react';
import { MobileContainer } from '../../MobileContainer';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { AlertCard } from '../../AlertCard';

interface BookingInfoProps {
  onNext: (info: BookingInfoData) => void;
  onBack: () => void;
}

export interface BookingInfoData {
  name: string;
  phone: string;
  age: string;
  note: string;
}

export function BookingInfo({ onNext, onBack }: BookingInfoProps) {
  const [formData, setFormData] = useState<BookingInfoData>({
    name: '',
    phone: '',
    age: '',
    note: '',
  });

  const [errors, setErrors] = useState<Partial<BookingInfoData>>({});

  const updateField = (field: keyof BookingInfoData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Partial<BookingInfoData> = {};

    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = '연락처를 입력해주세요';
    } else if (!/^[0-9-]+$/.test(formData.phone)) {
      newErrors.phone = '올바른 연락처 형식이 아닙니다';
    }

    if (!formData.age.trim()) {
      newErrors.age = '연령대를 입력해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onNext(formData);
    }
  };

  return (
    <MobileContainer
      footer={
        <div className="p-4">
          <Button
            onClick={handleSubmit}
            className="w-full bg-[#2563eb] hover:bg-[#1d4ed8]"
          >
            예약 확인
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
            <p className="text-sm text-muted-foreground">4단계: 정보 입력</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2">
          <div className="flex-1 h-2 bg-[#2563eb] rounded-full" />
          <div className="flex-1 h-2 bg-[#2563eb] rounded-full" />
          <div className="flex-1 h-2 bg-[#2563eb] rounded-full" />
          <div className="flex-1 h-2 bg-[#2563eb] rounded-full" />
        </div>

        {/* Info */}
        <AlertCard
          type="info"
          message="입력하신 정보는 상담 예약 확인 및 연락을 위해서만 사용됩니다."
        />

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">이름 *</Label>
            <Input
              id="name"
              type="text"
              placeholder="이름을 입력하세요"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={`bg-input-background ${errors.name ? 'border-red-500' : ''}`}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">연락처 *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="010-1234-5678"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className={`bg-input-background ${errors.phone ? 'border-red-500' : ''}`}
            />
            {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="age">연령대 *</Label>
            <Input
              id="age"
              type="text"
              placeholder="예: 30대"
              value={formData.age}
              onChange={(e) => updateField('age', e.target.value)}
              className={`bg-input-background ${errors.age ? 'border-red-500' : ''}`}
            />
            {errors.age && <p className="text-sm text-red-500">{errors.age}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">상담 희망 내용 (선택)</Label>
            <Textarea
              id="note"
              placeholder="상담받고 싶은 내용을 간단히 적어주세요 (선택사항)"
              value={formData.note}
              onChange={(e) => updateField('note', e.target.value)}
              className="bg-input-background min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              * 입력하신 내용은 상담 준비에 도움이 됩니다
            </p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm mb-2">개인정보 보호</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 모든 정보는 암호화되어 안전하게 보관됩니다</li>
            <li>• 상담 외 목적으로 사용되지 않습니다</li>
            <li>• 귀하의 동의 없이 제3자에게 제공되지 않습니다</li>
          </ul>
        </div>
      </div>
    </MobileContainer>
  );
}
