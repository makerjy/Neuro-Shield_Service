import React from 'react';
import { MobileContainer } from '../MobileContainer';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ArrowLeft, Phone, MessageSquare, Edit, XCircle, MapPin, Clock } from 'lucide-react';

interface SupportProps {
  onBack: () => void;
  onEditInfo: () => void;
  onStopContact: () => void;
}

export function Support({ onBack, onEditInfo, onStopContact }: SupportProps) {
  return (
    <MobileContainer>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2>문의 / 지원</h2>
        </div>

        {/* Contact Center */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h3 className="text-blue-900 mb-3">센터 연락처</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#2563eb] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-700 mb-1">일반 상담</p>
                  <a
                    href="tel:1577-0199"
                    className="text-[#2563eb] hover:underline"
                  >
                    1577-0199
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#2563eb] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-700 mb-1">운영 시간</p>
                  <p className="text-sm">평일 09:00 - 18:00</p>
                  <p className="text-sm text-blue-600">긴급 상담: 24시간 운영</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-[#2563eb] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-700 mb-1">이메일</p>
                  <a
                    href="mailto:support@neuroshield.kr"
                    className="text-[#2563eb] hover:underline text-sm"
                  >
                    support@neuroshield.kr
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-sm text-muted-foreground">빠른 메뉴</h3>

          <Button
            onClick={onEditInfo}
            variant="outline"
            className="w-full h-auto py-4 flex items-start justify-start"
          >
            <Edit className="w-5 h-5 mr-3 text-[#2563eb] flex-shrink-0 mt-0.5" />
            <div className="text-left flex-1">
              <div>정보 수정 요청</div>
              <div className="text-xs text-muted-foreground font-normal">
                연락처, 주소 등 개인정보 변경
              </div>
            </div>
          </Button>

          <Button
            onClick={onStopContact}
            variant="outline"
            className="w-full h-auto py-4 flex items-start justify-start border-red-200 hover:bg-red-50"
          >
            <XCircle className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-left flex-1">
              <div className="text-red-600">연락 중단 요청</div>
              <div className="text-xs text-muted-foreground font-normal">
                SMS 및 연락 받지 않기
              </div>
            </div>
          </Button>
        </div>

        {/* Regional Centers */}
        <div>
          <h3 className="mb-3">지역별 센터 찾기</h3>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-4">
                <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="mb-2">가까운 센터 찾기</h4>
                  <p className="text-sm text-muted-foreground">
                    거주지 기준으로 가장 가까운 정신건강복지센터를 안내해드립니다.
                  </p>
                </div>
              </div>
              <Button variant="outline" className="w-full">
                내 지역 센터 찾기
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Common Questions */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <h4 className="text-sm">자주 하는 문의</h4>
          <div className="space-y-2">
            <button className="text-sm text-left w-full p-2 hover:bg-white rounded transition-colors">
              • 예약 변경은 어떻게 하나요?
            </button>
            <button className="text-sm text-left w-full p-2 hover:bg-white rounded transition-colors">
              • 예약을 취소하고 싶어요
            </button>
            <button className="text-sm text-left w-full p-2 hover:bg-white rounded transition-colors">
              • 연락처가 변경되었어요
            </button>
            <button className="text-sm text-left w-full p-2 hover:bg-white rounded transition-colors">
              • 상담 시간을 확인하고 싶어요
            </button>
          </div>
        </div>

        {/* Emergency Info */}
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <h4 className="text-red-900 mb-2">긴급 상황 시</h4>
            <p className="text-sm text-red-700 mb-3">
              즉각적인 도움이 필요하신 경우 아래 번호로 연락주세요.
            </p>
            <div className="space-y-2">
              <a
                href="tel:1577-0199"
                className="block text-center py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                긴급 상담 전화: 1577-0199
              </a>
              <p className="text-xs text-red-600 text-center">24시간 운영</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileContainer>
  );
}
