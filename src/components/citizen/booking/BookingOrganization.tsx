import React, { useState } from 'react';
import { MobileContainer } from '../../MobileContainer';
import { Button } from '../../ui/button';
import { ArrowLeft, Building2, MapPin } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';

interface BookingOrganizationProps {
  onNext: (orgType: string) => void;
  onBack: () => void;
}

export function BookingOrganization({ onNext, onBack }: BookingOrganizationProps) {
  const [selectedType, setSelectedType] = useState<string>('');

  const orgTypes = [
    {
      id: 'local',
      name: '기초 정신건강복지센터',
      description: '지역 구/군 단위 센터 (가까운 곳)',
      icon: Building2,
      locations: '서울시 25개 구, 경기도 31개 시/군',
    },
    {
      id: 'regional',
      name: '광역 정신건강복지센터',
      description: '시/도 단위 센터',
      icon: MapPin,
      locations: '서울, 경기, 인천 등 광역시/도',
    },
  ];

  return (
    <MobileContainer
      footer={
        <div className="p-4">
          <Button
            onClick={() => onNext(selectedType)}
            disabled={!selectedType}
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
            <p className="text-sm text-muted-foreground">2단계: 기관 선택</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2">
          <div className="flex-1 h-2 bg-[#2563eb] rounded-full" />
          <div className="flex-1 h-2 bg-[#2563eb] rounded-full" />
          <div className="flex-1 h-2 bg-gray-200 rounded-full" />
          <div className="flex-1 h-2 bg-gray-200 rounded-full" />
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-900 mb-2">어디서 상담받으실래요?</h3>
          <p className="text-sm text-blue-700">
            가까운 기초센터 또는 광역센터 중 선택하실 수 있습니다.
          </p>
        </div>

        {/* Organization Types */}
        <div className="space-y-3">
          {orgTypes.map((org) => {
            const Icon = org.icon;
            return (
              <Card
                key={org.id}
                className={`cursor-pointer transition-all ${
                  selectedType === org.id
                    ? 'ring-2 ring-[#2563eb] bg-blue-50'
                    : 'hover:border-[#2563eb]'
                }`}
                onClick={() => setSelectedType(org.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        selectedType === org.id
                          ? 'bg-[#2563eb] text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3
                        className={selectedType === org.id ? 'text-[#2563eb]' : ''}
                      >
                        {org.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        {org.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {org.locations}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedType === org.id
                            ? 'border-[#2563eb] bg-[#2563eb]'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedType === org.id && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm mb-2">참고 사항</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 기초센터는 거주지 근처에서 편리하게 이용 가능합니다</li>
            <li>• 광역센터는 전문 서비스가 필요한 경우 이용하실 수 있습니다</li>
            <li>• 상담 후 필요시 다른 기관으로 연계해 드립니다</li>
          </ul>
        </div>
      </div>
    </MobileContainer>
  );
}
