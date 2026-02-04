import React, { useState } from 'react';
import { MobileContainer } from '../MobileContainer';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { AlertCard } from '../AlertCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface StopContactProps {
  onBack: () => void;
  onConfirm: () => void;
}

export function StopContact({ onBack, onConfirm }: StopContactProps) {
  const [reason, setReason] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleRequest = () => {
    if (!understood) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmStop = () => {
    setShowConfirmDialog(false);
    setSubmitted(true);
    setTimeout(() => {
      onConfirm();
    }, 2000);
  };

  return (
    <>
      <MobileContainer
        footer={
          !submitted && (
            <div className="p-4 space-y-2">
              <Button
                onClick={handleRequest}
                disabled={!understood}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                연락 중단 요청
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
            <h2>연락 중단 요청</h2>
          </div>

          {submitted ? (
            <div className="space-y-6 py-8">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3>요청이 처리되었습니다</h3>
                <p className="text-muted-foreground">
                  향후 SMS 및 연락을 받지 않으시게 됩니다.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-blue-900 mb-2">언제든 다시 이용하실 수 있습니다</h4>
                <p className="text-sm text-blue-700">
                  도움이 필요하신 경우 언제든지 1577-0199로 연락주시거나
                  서비스를 다시 이용하실 수 있습니다.
                </p>
              </div>
              <Button onClick={onConfirm} className="w-full bg-[#2563eb] hover:bg-[#1d4ed8]">
                확인
              </Button>
            </div>
          ) : (
            <>
              {/* Warning */}
              <AlertCard
                type="error"
                title="중요 안내"
                message="연락 중단 시 예약된 상담 일정 안내 및 모든 SMS 연락을 받지 못하게 됩니다."
              />

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">중단 사유 (선택)</Label>
                <Textarea
                  id="reason"
                  placeholder="중단 사유를 알려주시면 서비스 개선에 도움이 됩니다"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="bg-input-background min-h-[100px]"
                />
              </div>

              {/* Effects */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <h4 className="text-red-900">연락 중단 시 영향</h4>
                </div>
                <ul className="text-sm text-red-700 space-y-2 ml-8">
                  <li>• 예약된 상담 일정 안내를 받지 못합니다</li>
                  <li>• 추후 연락 안내 SMS를 받지 못합니다</li>
                  <li>• 중요한 서비스 공지를 받지 못할 수 있습니다</li>
                  <li>• 긴급 상황 시에도 연락이 어려울 수 있습니다</li>
                </ul>
              </div>

              {/* Alternatives */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-blue-900 mb-3">대안을 고려해보세요</h4>
                <div className="space-y-2 text-sm text-blue-700">
                  <p>• <strong>나중에 연락받기:</strong> 일정 기간 후 다시 연락받을 수 있습니다</p>
                  <p>• <strong>정보 수정:</strong> 연락 방법이나 시간대를 변경할 수 있습니다</p>
                  <p>• <strong>예약 취소:</strong> 특정 예약만 취소할 수 있습니다</p>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="understand"
                    checked={understood}
                    onCheckedChange={(checked) => setUnderstood(checked === true)}
                  />
                  <label htmlFor="understand" className="cursor-pointer flex-1">
                    <p className="text-sm">
                      위 내용을 모두 확인했으며, 연락 중단 시 발생하는 영향을 이해했습니다.
                    </p>
                  </label>
                </div>
              </div>

              {/* Emergency Contact */}
              <AlertCard
                type="warning"
                title="긴급 상황 시"
                message="연락 중단 후에도 긴급한 도움이 필요하신 경우 24시간 긴급전화 1577-0199로 연락하실 수 있습니다."
              />

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm mb-2">재개를 원하실 경우</h4>
                <p className="text-sm text-muted-foreground">
                  연락 중단 후에도 언제든지 1577-0199로 연락주시면
                  서비스를 다시 이용하실 수 있습니다.
                </p>
              </div>
            </>
          )}
        </div>
      </MobileContainer>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              정말 연락을 중단하시겠습니까?
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>이 작업은 즉시 처리되며, 모든 예약 안내 및 SMS 연락이 중단됩니다.</p>
              <p className="text-red-600">진행하시겠습니까?</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleConfirmStop}
              className="bg-red-600 hover:bg-red-700"
            >
              연락 중단
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
