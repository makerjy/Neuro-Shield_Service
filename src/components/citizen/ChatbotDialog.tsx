import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface Citation {
  title?: string;
  snippet?: string;
}

interface ChatApiResponse {
  conversation_id?: string;
  assistant_message?: string;
  citations?: Citation[];
}

interface ChatbotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatbotDialog({ open, onOpenChange }: ChatbotDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: '안녕하세요! 치매안심센터 상담봇입니다. 무엇을 도와드릴까요?',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Knowledge base for RAG
  const knowledgeBase = {
    '왜 연락': '국가건강검진 결과 및 생활습관 설문조사를 바탕으로 치매 예방을 위한 무료 선별검사 대상자로 선정되셨습니다. 조기 발견과 예방을 위해 무료로 제공되는 서비스입니다.',
    '비용': '모든 선별검사와 상담 서비스는 정부 지원으로 완전히 무료입니다. 추가 비용이 전혀 발생하지 않습니다.',
    '서비스': '인지기능 선별검사, 전문 상담사와의 1:1 상담, 생활습관 개선 프로그램, 필요시 전문 의료기관 연계 등의 서비스를 받으실 수 있습니다.',
    '개인정보': '모든 개인정보는 개인정보보호법에 따라 엄격하게 관리되며, 동의하신 목적 외에는 절대 사용되지 않습니다. 원하시면 언제든 삭제를 요청하실 수 있습니다.',
    '예약': '예약은 홈 화면의 "상담 예약하기" 버튼을 통해 진행하실 수 있습니다. 원하시는 센터와 날짜, 시간을 선택하실 수 있습니다.',
    '시간': '검사는 약 30분 정도 소요되며, 상담 시간을 포함하면 1시간 정도 예상하시면 됩니다.',
    '준비물': '신분증만 지참하시면 됩니다. 편안한 복장으로 방문해 주세요.',
    '가족': '네, 가족분과 함께 오셔도 됩니다. 오히려 가족분이 동반하시면 더 정확한 상담이 가능합니다.',
    '주차': '센터에 무료 주차 공간이 마련되어 있습니다. 대중교통 이용도 편리합니다.',
    '결과': '검사 후 즉시 결과를 확인하실 수 있으며, 필요한 경우 추가 검사나 의료기관 연계를 안내해 드립니다.',
    '치매': '상담봇은 진단을 할 수 없습니다. 정확한 평가는 치매안심센터 선별검사 또는 의료진 상담이 필요합니다. 예약 절차를 안내해드릴 수 있어요.',
  };

  const quickQuestions = [
    '왜 연락을 받았나요?',
    '비용이 드나요?',
    '어떤 서비스를 받을 수 있나요?',
    '예약은 어떻게 하나요?',
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getBotResponse = (userMessage: string): string => {
    const normalizedMessage = userMessage.toLowerCase().replace(/\s+/g, '');
    
    for (const [keyword, response] of Object.entries(knowledgeBase)) {
      if (normalizedMessage.includes(keyword.replace(/\s+/g, ''))) {
        return response;
      }
    }

    // Default response
    return '죄송합니다. 해당 질문에 대한 답변을 찾지 못했습니다. 자주 묻는 질문을 참고하시거나, 센터로 직접 문의해 주세요. (전화: 02-1234-5678)';
  };

  const requestRagAnswer = async (userMessage: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/outreach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_message: userMessage,
          conversation_id: conversationId || undefined,
          context: { current_view: 'citizen_portal' },
        }),
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as ChatApiResponse;
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
      const message = String(data.assistant_message || '').trim();
      if (!message) {
        return null;
      }
      const citations = (data.citations || [])
        .map((item) => [item.title, item.snippet].filter(Boolean).join(': '))
        .filter(Boolean)
        .slice(0, 2);
      if (!citations.length) {
        return message;
      }
      return `${message}\n\n참고: ${citations.join(' | ')}`;
    } catch {
      return null;
    }
  };

  const sendUserMessage = async (rawMessage: string) => {
    const userText = rawMessage.trim();
    if (!userText || isSending) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);
    const ragAnswer = await requestRagAnswer(userText);
    const finalAnswer = ragAnswer || getBotResponse(userText);
    const botResponse: Message = {
      id: (Date.now() + 1).toString(),
      type: 'bot',
      content: finalAnswer,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, botResponse]);
    setIsSending(false);
  };

  const handleSendMessage = () => {
    void sendUserMessage(inputValue);
  };

  const handleQuickQuestion = (question: string) => {
    void sendUserMessage(question);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] max-h-[90dvh] !grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-full">
              <Bot className="h-5 w-5 text-blue-600" />
            </div>
            AI 상담봇
          </DialogTitle>
        </DialogHeader>

        <div ref={scrollRef} className="min-h-0 overflow-y-auto overscroll-contain p-6">
          <div className="space-y-4 pb-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {messages.length === 1 && (
            <div className="mt-6">
              <p className="text-sm text-gray-600 mb-3">자주 묻는 질문:</p>
              <div className="grid grid-cols-2 gap-2">
                {quickQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickQuestion(question)}
                    className="p-3 text-left text-sm border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="질문을 입력하세요..."
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isSending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * 서비스 관련 질문에 대해서만 답변 가능합니다
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
