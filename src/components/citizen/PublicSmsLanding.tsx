import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, ClipboardList, Phone } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { CitizenMobileApp } from "./CitizenMobileApp";

type PublicLandingStage = "STAGE1" | "STAGE2" | "STAGE3";

type PublicLandingResponse = {
  stage: PublicLandingStage;
  actionType?: string;
  centerName?: string;
  callbackPhone?: string;
  caseAlias?: string;
  cta?: {
    primary?: string;
    secondary?: string;
  };
  checklist?: string[];
  dueDate?: string;
  privacyNotice?: string;
};

const DEFAULT_PRIVACY_NOTICE =
  "문자에는 민감정보가 포함되지 않으며, 본 화면에서도 최소 정보만 표시됩니다.";

function getTokenFromUrl(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("t") || "";
}

function normalizeStage(input?: string): PublicLandingStage {
  if (!input) return "STAGE1";
  if (input.toUpperCase().includes("3")) return "STAGE3";
  if (input.toUpperCase().includes("2")) return "STAGE2";
  return "STAGE1";
}

function buildFallbackLanding(token: string): PublicLandingResponse {
  const normalizedToken = token.toLowerCase();
  const stage: PublicLandingStage = normalizedToken.includes("s3")
    ? "STAGE3"
    : normalizedToken.includes("s2")
      ? "STAGE2"
      : "STAGE1";

  if (stage === "STAGE1") {
    return {
      stage,
      actionType: "BOOKING",
      centerName: "강남구 치매안심센터",
      callbackPhone: "02-555-0199",
      caseAlias: "대상자",
      privacyNotice: DEFAULT_PRIVACY_NOTICE,
    };
  }

  return {
    stage,
    actionType: stage === "STAGE3" ? "FOLLOW_UP_HUB" : "NEXT_STEP_HUB",
    centerName: "강남구 치매안심센터",
    callbackPhone: "02-555-0199",
    caseAlias: "대상자",
    dueDate: stage === "STAGE3" ? "7일 이내 확인 권장" : "3일 이내 확인 권장",
    cta: {
      primary: stage === "STAGE3" ? "추적 일정 확인" : "검사/절차 일정 확인",
      secondary: "전화 문의",
    },
    checklist:
      stage === "STAGE3"
        ? ["추적관리 일정 확인", "필요 시 보호자 동행 여부 선택", "문의 사항 정리 후 연락"]
        : ["검사/절차 단계 확인", "가능 일정 선택", "필요 서류/준비사항 확인"],
    privacyNotice: DEFAULT_PRIVACY_NOTICE,
  };
}

function StageHub({
  token,
  data,
}: {
  token: string;
  data: PublicLandingResponse;
}) {
  const [completed, setCompleted] = useState(false);
  const centerName = data.centerName || "치매안심센터";
  const callbackPhone = data.callbackPhone || "02-555-0199";
  const checklist = data.checklist || [];

  const handleComplete = async () => {
    try {
      await fetch("/api/public/sms/landing/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          actionType: data.actionType || "HUB_ACTION",
          status: "ACTION_COMPLETED",
        }),
      });
    } catch {
      // 백엔드 미연동 환경에서도 UI 완료 처리는 유지
    } finally {
      setCompleted(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4">
      <div className="mx-auto max-w-xl space-y-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge className="bg-blue-600 text-white border-blue-500">
                {data.stage === "STAGE2" ? "Stage2 허브" : "Stage3 허브"}
              </Badge>
              {completed && (
                <Badge className="bg-emerald-600 text-white border-emerald-500">
                  ACTION_COMPLETED
                </Badge>
              )}
            </div>
            <CardTitle className="text-slate-900">{centerName} 안내</CardTitle>
            <CardDescription className="text-slate-700">
              {data.caseAlias || "대상자"}님의 다음 단계를 확인해 주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.dueDate && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                {data.dueDate}
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                해야 할 일
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {checklist.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleComplete} className="w-full">
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {data.cta?.primary || "다음 단계 확인"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = `tel:${callbackPhone}`;
                  }
                }}
              >
                <Phone className="h-4 w-4 mr-1.5" />
                {data.cta?.secondary || "전화 문의"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <p>{data.privacyNotice || DEFAULT_PRIVACY_NOTICE}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function PublicSmsLanding() {
  const token = useMemo(() => getTokenFromUrl(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PublicLandingResponse | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!token) {
        if (!active) return;
        setError("유효한 링크 토큰이 없습니다.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/public/sms/landing?t=${encodeURIComponent(token)}`);
        if (!response.ok) {
          throw new Error(`landing api error: ${response.status}`);
        }
        const data = (await response.json()) as PublicLandingResponse;
        if (!active) return;
        setPayload({
          ...data,
          stage: normalizeStage(data.stage),
        });
        setError(null);
      } catch {
        if (!active) return;
        setPayload(buildFallbackLanding(token));
        setError(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-sm text-slate-600">
            문자 링크를 확인하고 있습니다...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">접속 오류</CardTitle>
            <CardDescription>문자 링크가 유효하지 않거나 만료되었습니다.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">{error || "다시 시도해 주세요."}</CardContent>
        </Card>
      </div>
    );
  }

  if (payload.stage === "STAGE1") {
    return <CitizenMobileApp inviteToken={token} />;
  }

  return <StageHub token={token} data={payload} />;
}
