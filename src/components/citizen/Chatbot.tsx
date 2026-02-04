import React, { useState } from 'react';
import { MobileContainer } from '../MobileContainer';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ArrowLeft, Send, Bot, User } from 'lucide-react';
import { AlertCard } from '../AlertCard';

interface ChatbotProps {
  onBack: () => void;
}

interface Message {
  id: number;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export function Chatbot({ onBack }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'bot',
      content: '안녕하세요! 정신건강 지원 서비스 챗봇입니다. 자주 묻는 질문과 서비스 안내를 도와드립니다.',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');

  const quickQuestions = [
    '상담 예약은 어떻게 하나요?',
    '상담 비용이 있나요?',
    '예약 변경 방법',
    '긴급 상담 전화번호',
  ];

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Simple bot response (in real app, this would be AI-powered)
    setTimeout(() => {
      const botResponse = getBotResponse(inputValue);
      const botMessage: Message = {
        id: messages.length + 2,
        type: 'bot',
        content: botResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 500);

    setInputValue('');
  };

  const getBotResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('예약') || lowerQuery.includes('신청')) {
      return '상담 예약은 메인 화면의 "상담 예약하기" 버튼을 눌러 진행하실 수 있습니다. 동의 → 기관 선택 → 날짜/시간 선택 → 정보 입력 순으로 간단하게 예약하실 수 있습니다.';
    }

    if (lowerQuery.includes('비용') || lowerQuery.includes('무료') || lowerQuery.includes('돈')) {
      return '모든 상담 서비스는 무료로 제공됩니다. 정신건강복지센터는 국가 및 지방자치단체의 지원으로 운영되어 이용자에게 비용이 발생하지 않습니다.';
    }

    if (lowerQuery.includes('변경') || lowerQuery.includes('취소')) {
      return '예약 변경이나 취소는 문의/지원 메뉴를 통해 요청하실 수 있습니다. 가능하면 예약 시간 1일 전까지 변경해주시면 감사하겠습니다.';
    }

    if (lowerQuery.includes('긴급') || lowerQuery.includes('응급') || lowerQuery.includes('위급')) {
      return '긴급한 상황이시라면 24시간 상담 전화 1577-0199로 즉시 연락주세요. 전문 상담사가 도움을 드리겠습니다.';
    }

    if (lowerQuery.includes('시간') || lowerQuery.includes('운영')) {
      return '센터는 평일 09:00 - 18:00에 운영됩니다. 긴급한 경우 1577-0199로 24시간 상담이 가능합니다.';
    }

    return '죄송합니다. 정확한 답변을 드리기 어렵습니다. 자주 묻는 질문(FAQ)을 확인하시거나, 전화 상담(1577-0199)을 이용해주세요. 전문 상담이 필요하신 경우 상담 예약을 진행해주세요.';
  };

  const handleQuickQuestion = (question: string) => {
    setInputValue(question);
  };

  return (
    <MobileContainer
      footer={
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="메시지를 입력하세요..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              className="bg-input-background"
            />
            <Button
              onClick={handleSend}
              className="bg-[#2563eb] hover:bg-[#1d4ed8]"
              disabled={!inputValue.trim()}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-[600px]">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 pb-4 border-b bg-white sticky top-0 z-10">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2>챗봇 상담</h2>
          </div>
          <div className="w-10 h-10 bg-[#2563eb] rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Warning */}
        <div className="p-4 bg-yellow-50">
          <AlertCard
            type="warning"
            message="이 챗봇은 FAQ와 서비스 안내만 제공합니다. 의료 상담이나 진단은 제공하지 않습니다."
          />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.type === 'bot' ? 'bg-[#2563eb]' : 'bg-gray-300'
                }`}
              >
                {message.type === 'bot' ? (
                  <Bot className="w-5 h-5 text-white" />
                ) : (
                  <User className="w-5 h-5 text-gray-600" />
                )}
              </div>
              <div
                className={`flex-1 max-w-[80%] ${message.type === 'user' ? 'text-right' : ''}`}
              >
                <div
                  className={`inline-block p-3 rounded-lg ${
                    message.type === 'bot'
                      ? 'bg-gray-100 text-gray-900'
                      : 'bg-[#2563eb] text-white'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Questions */}
        {messages.length <= 2 && (
          <div className="p-4 border-t bg-gray-50">
            <p className="text-sm text-muted-foreground mb-2">자주 묻는 질문</p>
            <div className="grid grid-cols-2 gap-2">
              {quickQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickQuestion(question)}
                  className="text-xs h-auto py-2 whitespace-normal"
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </MobileContainer>
  );
}
