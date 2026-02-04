import React, { useState } from 'react';
import { MobileContainer } from '../MobileContainer';
import { Button } from '../ui/button';
import { ArrowLeft, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';

interface FAQProps {
  onBack: () => void;
}

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

export function FAQ({ onBack }: FAQProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const faqData: FAQItem[] = [
    {
      id: 1,
      category: '서비스 이용',
      question: '상담 서비스는 무료인가요?',
      answer: '네, 모든 상담 서비스는 무료로 제공됩니다. 정신건강복지센터의 모든 서비스는 국가 및 지방자치단체의 지원으로 운영되어 이용자에게 비용이 발생하지 않습니다.',
    },
    {
      id: 2,
      category: '서비스 이용',
      question: '상담 내용이 외부에 공개되나요?',
      answer: '아니요, 모든 상담 내용은 엄격하게 비밀이 보장됩니다. 귀하의 동의 없이는 어떠한 정보도 제3자에게 공개되지 않으며, 관련 법령에 따라 철저히 보호됩니다.',
    },
    {
      id: 3,
      category: '예약',
      question: '예약을 취소하거나 변경할 수 있나요?',
      answer: '네, 가능합니다. 문의/지원 메뉴를 통해 예약 변경이나 취소를 요청하실 수 있습니다. 가능한 예약 시간 1일 전까지 변경해주시면 감사하겠습니다.',
    },
    {
      id: 4,
      category: '예약',
      question: '당일 예약이 가능한가요?',
      answer: '센터의 상황에 따라 다를 수 있습니다. 긴급한 경우 1577-0199로 전화주시면 가능한 빠른 시간 내에 상담을 도와드리겠습니다.',
    },
    {
      id: 5,
      category: '상담',
      question: '상담은 몇 번까지 받을 수 있나요?',
      answer: '상담 횟수에 제한은 없습니다. 필요에 따라 지속적으로 상담을 받으실 수 있으며, 상담사와 함께 상담 계획을 수립하게 됩니다.',
    },
    {
      id: 6,
      category: '상담',
      question: '가족이나 친구의 상담도 신청할 수 있나요?',
      answer: '본인이 직접 신청하는 것이 원칙이지만, 가족이나 지인의 도움이 필요한 경우 함께 방문하시거나 대리 신청도 가능합니다. 자세한 사항은 센터에 문의해주세요.',
    },
    {
      id: 7,
      category: '기타',
      question: '의료 진단이나 처방을 받을 수 있나요?',
      answer: '정신건강복지센터는 의료기관이 아니므로 진단이나 처방은 제공하지 않습니다. 하지만 필요한 경우 적절한 의료기관으로 연계해 드립니다.',
    },
    {
      id: 8,
      category: '기타',
      question: '챗봇으로 상담받을 수 있나요?',
      answer: '챗봇은 FAQ와 서비스 안내만 제공합니다. 의료 상담이나 전문적인 정신건강 상담은 제공하지 않으므로, 전문 상담이 필요하신 경우 예약을 통해 상담사와 만나주세요.',
    },
  ];

  const filteredFAQs = faqData.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <MobileContainer>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2>자주 묻는 질문</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="질문을 검색하세요"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-input-background"
          />
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((faq) => (
              <Card key={faq.id}>
                <CardContent className="p-0">
                  <button
                    onClick={() => toggleExpand(faq.id)}
                    className="w-full p-4 text-left flex items-start gap-3"
                  >
                    <div className="flex-1">
                      <span className="text-xs text-[#2563eb] mb-1 block">
                        {faq.category}
                      </span>
                      <h4>{faq.question}</h4>
                    </div>
                    {expandedId === faq.id ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                  {expandedId === faq.id && (
                    <div className="px-4 pb-4 border-t">
                      <p className="text-sm text-muted-foreground pt-3">{faq.answer}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">검색 결과가 없습니다</p>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-blue-900 mb-2">추가 문의</h4>
          <p className="text-sm text-blue-700 mb-3">
            궁금하신 사항이 해결되지 않으셨나요?
          </p>
          <Button
            onClick={onBack}
            variant="outline"
            className="w-full border-[#2563eb] text-[#2563eb] hover:bg-blue-100"
          >
            문의하기
          </Button>
        </div>
      </div>
    </MobileContainer>
  );
}
