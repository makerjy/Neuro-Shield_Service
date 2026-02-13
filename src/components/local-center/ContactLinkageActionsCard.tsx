import React from "react";
import { Link2, MessageSquare } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface ContactLinkageActionsCardProps {
  stageLabel: string;
  onOpenContact: () => void;
  onOpenLinkage: () => void;
  linkageButtonLabel?: string;
  linkageDescription?: string;
}

export function ContactLinkageActionsCard({
  stageLabel,
  onOpenContact,
  onOpenLinkage,
  linkageButtonLabel = "연계 실행",
  linkageDescription = "프로그램 제공 워크플로우로 이동",
}: ContactLinkageActionsCardProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-2 px-4 py-4">
        <Button
          type="button"
          className="h-11 w-full gap-2 bg-[#15386a] text-sm font-semibold text-white hover:bg-[#102b4e]"
          onClick={onOpenContact}
        >
          <MessageSquare className="h-4 w-4" />
          상담/문자 실행 ({stageLabel})
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full gap-2 border-[#15386a]/30 text-sm font-semibold text-[#15386a] hover:bg-[#15386a]/5"
          onClick={onOpenLinkage}
        >
          <Link2 className="h-4 w-4" />
          {linkageButtonLabel}
        </Button>
        <p className="text-center text-[11px] text-slate-500">접촉 · 예약안내 · 리마인더 문자 발송</p>
        <p className="text-center text-[11px] text-slate-500">{linkageDescription}</p>
      </CardContent>
    </Card>
  );
}
