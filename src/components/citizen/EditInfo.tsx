import React, { useState } from 'react';
import { MobileContainer } from '../MobileContainer';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { AlertCard } from '../AlertCard';

interface EditInfoProps {
  onBack: () => void;
  onSubmit: () => void;
}

export function EditInfo({ onBack, onSubmit }: EditInfoProps) {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '홍길동',
    phone: '010-1234-5678',
    email: '',
    address: '',
    reason: '',
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      onSubmit();
    }, 2000);
  };

  return (
    <MobileContainer
      footer={
        !submitted && (
          <div className="p-4 space-y-2">
            <Button onClick={handleSubmit} className="w-full bg-[#2563eb] hover:bg-[#1d4ed8]">
              수정 요청하기
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
          {!submitted && (
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2>정보 수정 요청</h2>
        </div>

        {submitted ? (
          <div className="space-y-6 py-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3>요청이 접수되었습니다</h3>
              <p className="text-muted-foreground">
                담당자 확인 후 1-2일 내로 변경 처리됩니다.
              </p>
            </div>
            <AlertCard
              type="info"
              message="확인이 필요한 경우 등록하신 연락처로 연락드릴 수 있습니다."
            />
            <Button onClick={onSubmit} className="w-full bg-[#2563eb] hover:bg-[#1d4ed8]">
              확인
            </Button>
          </div>
        ) : (
          <>
            <AlertCard
              type="info"
              message="변경하실 정보를 입력해주세요. 담당자가 확인 후 처리해드립니다."
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="bg-input-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">연락처</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="bg-input-background"
                />
                <p className="text-xs text-muted-foreground">
                  * SMS 수신 번호가 변경됩니다
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">이메일 (선택)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="bg-input-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">주소 (선택)</Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="주소를 입력하세요"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="bg-input-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">변경 사유 (선택)</Label>
                <Textarea
                  id="reason"
                  placeholder="변경 사유를 간단히 적어주세요"
                  value={formData.reason}
                  onChange={(e) => updateField('reason', e.target.value)}
                  className="bg-input-background min-h-[80px]"
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm mb-2">안내 사항</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 변경 요청 처리에는 1-2일이 소요됩니다</li>
                <li>• 중요한 정보 변경 시 본인 확인이 필요할 수 있습니다</li>
                <li>• 긴급한 경우 1577-0199로 전화주세요</li>
              </ul>
            </div>

            <AlertCard
              type="warning"
              message="정보 변경 시 기존 예약 일정은 유지됩니다. 예약 변경은 별도로 문의해주세요."
            />
          </>
        )}
      </div>
    </MobileContainer>
  );
}
