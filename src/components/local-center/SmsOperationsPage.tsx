import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  History,
  Link2,
  MessageSquare,
  Phone,
  Send,
  User,
  UserRoundCheck,
} from "lucide-react";
import {
  getCaseRecordById,
  maskPhone,
  toAgeBand,
} from "./v2/caseRecords";

type SmsCategory = "CONTACT" | "BOOKING" | "REMINDER";
type SmsTemplateId =
  | "CONTACT_PRIMARY"
  | "CONTACT_GUARDIAN_OPTION"
  | "BOOKING_PRIMARY"
  | "BOOKING_CHANNEL_OPTION"
  | "REMINDER_FIRST"
  | "REMINDER_FINAL";

type Recipient = "citizen" | "guardian";
type SendMode = "NOW" | "SCHEDULE";
type SendStatus = "SENT" | "SCHEDULED" | "FAILED";

type SmsTemplate = {
  id: SmsTemplateId;
  category: SmsCategory;
  label: string;
  hint: string;
  build: (params: {
    centerName: string;
    link: string;
    bookingLink: string;
    centerPhone: string;
  }) => string;
};

type SmsHistoryEntry = {
  id: string;
  at: string;
  recipient: Recipient;
  templateLabel: string;
  status: SendStatus;
};

const SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: "CONTACT_PRIMARY",
    category: "CONTACT",
    label: "1차 접촉 문자",
    hint: "대상자 최초 안내",
    build: ({ centerName, link, centerPhone }) =>
      `[치매안심센터:${centerName}] 인지건강 확인을 위한 안내입니다. 의료진 확인 전 단계이며 확인 절차(상담/선별검사)가 필요할 수 있습니다. 안내 확인 및 희망 연락시간 선택: ${link} / 문의: ${centerPhone}`,
  },
  {
    id: "CONTACT_GUARDIAN_OPTION",
    category: "CONTACT",
    label: "1차 접촉 문자 (보호자 옵션)",
    hint: "보호자 연락처 선택 입력 유도",
    build: ({ centerName, link, centerPhone }) =>
      `[치매안심센터:${centerName}] 안내 확인 후 본인 응답이 어렵다면 보호자 연락처(선택)를 남길 수 있습니다. 안내 확인/연락시간 선택: ${link} / 문의: ${centerPhone}`,
  },
  {
    id: "BOOKING_PRIMARY",
    category: "BOOKING",
    label: "1차 예약안내",
    hint: "선별검사/상담 예약 유도",
    build: ({ centerName, bookingLink, centerPhone }) =>
      `[치매안심센터:${centerName}] 인지 선별검사/상담 예약 안내드립니다. 가능한 날짜·시간을 선택해주세요. 예약/변경: ${bookingLink} / 문의: ${centerPhone}`,
  },
  {
    id: "BOOKING_CHANNEL_OPTION",
    category: "BOOKING",
    label: "1차 예약안내 (방문/전화 선택)",
    hint: "진행 방식 선택 안내",
    build: ({ centerName, bookingLink }) =>
      `[치매안심센터:${centerName}] 상담/선별검사는 방문 또는 전화로 진행될 수 있습니다. 희망 방식을 선택해 예약해주세요. ${bookingLink}`,
  },
  {
    id: "REMINDER_FIRST",
    category: "REMINDER",
    label: "1차 리마인더",
    hint: "미확인/미응답 1차 안내",
    build: ({ centerName, link, centerPhone }) =>
      `[치매안심센터:${centerName}] 이전에 안내드린 인지건강 확인 링크가 아직 미확인 상태입니다. 원치 않으시면 수신거부 가능하며, 확인은 아래 링크에서 가능합니다. ${link} / 문의: ${centerPhone}`,
  },
  {
    id: "REMINDER_FINAL",
    category: "REMINDER",
    label: "최종 리마인더",
    hint: "최종 안내",
    build: ({ centerName, link, centerPhone }) =>
      `[치매안심센터:${centerName}] 확인이 없어 마지막으로 안내드립니다. 필요 시 아래 링크에서 확인/예약할 수 있습니다. ${link} / 문의: ${centerPhone}`,
  },
];

const CATEGORY_META: Record<SmsCategory, { label: string; tone: string }> = {
  CONTACT: { label: "1차 접촉문자", tone: "border-blue-200 bg-blue-50 text-blue-800" },
  BOOKING: { label: "예약안내", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  REMINDER: { label: "리마인더", tone: "border-amber-200 bg-amber-50 text-amber-800" },
};

function formatDateTime(isoLike?: string) {
  if (!isoLike) return "-";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function sendSmsApi(payload: {
  case_id: string;
  template_id: string;
  citizen_phone: string;
  message: string;
  channel: "sms";
  dedupe_key: string;
}) {
  const envAny = import.meta.env as Record<string, string | undefined>;
  const basePathRaw = (envAny.VITE_BASE_PATH || "/neuro-shield/").trim();
  const normalizedBasePath = basePathRaw
    ? `/${basePathRaw.replace(/^\/+|\/+$/g, "")}/`
    : "/neuro-shield/";
  const basePrefix = normalizedBasePath === "/" ? "" : normalizedBasePath.replace(/\/$/, "");
  const explicitApiBase = (envAny.VITE_SMS_API_BASE_URL || envAny.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");

  const endpointCandidates = [
    "/api/outreach/send-sms",
    basePrefix ? `${basePrefix}/api/outreach/send-sms` : "",
    typeof window !== "undefined" ? `${window.location.origin}/api/outreach/send-sms` : "",
    typeof window !== "undefined" && basePrefix ? `${window.location.origin}${basePrefix}/api/outreach/send-sms` : "",
    explicitApiBase ? `${explicitApiBase}/api/outreach/send-sms` : "",
    "http://localhost:4120/api/outreach/send-sms",
  ];
  const endpoints = Array.from(new Set(endpointCandidates.filter((item) => item.length > 0)));

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // fallback to next endpoint
    }
  }

  return false;
}

export function SmsOperationsPage({
  caseId,
  onBack,
}: {
  caseId: string;
  onBack: () => void;
}) {
  const caseRecord = useMemo(() => getCaseRecordById(caseId), [caseId]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<SmsTemplateId>("CONTACT_PRIMARY");
  const [recipient, setRecipient] = useState<Recipient>("citizen");
  const [mode, setMode] = useState<SendMode>("NOW");
  const [scheduledAt, setScheduledAt] = useState("");
  const [centerName, setCenterName] = useState("강남구 치매안심센터");
  const [centerPhone, setCenterPhone] = useState(
    (
      (import.meta.env.VITE_STAGE1_CENTER_PHONE as string | undefined) ??
      (import.meta.env.VITE_SMS_CENTER_PHONE as string | undefined) ??
      (import.meta.env.VITE_CENTER_PHONE as string | undefined) ??
      "02-1234-5678"
    ).trim() || "02-1234-5678",
  );
  const [link, setLink] = useState("https://neuro-shield.local/check");
  const [bookingLink, setBookingLink] = useState("https://neuro-shield.local/booking");
  const [history, setHistory] = useState<SmsHistoryEntry[]>([]);
  const [sending, setSending] = useState(false);

  const selectedTemplate =
    SMS_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? SMS_TEMPLATES[0];

  const preview = selectedTemplate.build({
    centerName,
    link,
    bookingLink,
    centerPhone,
  });

  const groupedTemplates = useMemo(() => {
    const byCategory: Record<SmsCategory, SmsTemplate[]> = {
      CONTACT: [],
      BOOKING: [],
      REMINDER: [],
    };
    for (const template of SMS_TEMPLATES) {
      byCategory[template.category].push(template);
    }
    return byCategory;
  }, []);

  const recipientPhone =
    recipient === "guardian"
      ? caseRecord?.profile.guardianPhone
      : caseRecord?.profile.phone;

  const recipientDisabled = recipient === "guardian" && !caseRecord?.profile.guardianPhone;
  const sendDisabled =
    sending ||
    !recipientPhone ||
    (mode === "SCHEDULE" && !scheduledAt);

  const handleSend = async () => {
    if (!recipientPhone) return;

    setSending(true);
    const now = new Date().toISOString();
    let status: SendStatus = mode === "NOW" ? "SENT" : "SCHEDULED";

    if (mode === "NOW") {
      const ok = await sendSmsApi({
        case_id: caseId,
        template_id: selectedTemplate.id,
        citizen_phone: recipientPhone,
        message: preview,
        channel: "sms",
        dedupe_key: `${caseId}-${selectedTemplate.id}-${recipient}-${Date.now()}`,
      });
      status = ok ? "SENT" : "FAILED";
    }

    setHistory((prev) => [
      {
        id: `${Date.now()}`,
        at: mode === "SCHEDULE" ? new Date(scheduledAt).toISOString() : now,
        recipient,
        templateLabel: selectedTemplate.label,
        status,
      },
      ...prev,
    ]);
    setSending(false);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft size={14} /> 뒤로
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">문자/연계 운영</h2>
              <p className="text-xs text-gray-500">CASE ID: {caseId}</p>
            </div>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
            Stage1 문자 운영 전용
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase">식별 키</p>
              <p className="mt-1 text-sm font-bold text-gray-900">{caseRecord?.id ?? caseId}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase">연령대</p>
              <p className="mt-1 text-sm font-bold text-gray-900">
                {caseRecord ? toAgeBand(caseRecord.profile.age) : "-"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase">본인 연락처</p>
              <p className="mt-1 text-sm font-bold text-gray-900">
                {caseRecord ? maskPhone(caseRecord.profile.phone) : "-"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase">보호자 연락처</p>
              <p className="mt-1 text-sm font-bold text-gray-900">
                {caseRecord?.profile.guardianPhone ? maskPhone(caseRecord.profile.guardianPhone) : "미등록"}
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="xl:col-span-8 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare size={15} className="text-gray-500" />
                템플릿 선택
              </h3>
              <div className="mt-3 space-y-3">
                {(Object.keys(groupedTemplates) as SmsCategory[]).map((category) => (
                  <div key={category} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-bold text-gray-700">{CATEGORY_META[category].label}</p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {groupedTemplates[category].map((template) => (
                        <button
                          key={template.id}
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            selectedTemplateId === template.id
                              ? "border-blue-300 bg-blue-50"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <p className="text-xs font-semibold text-gray-900">{template.label}</p>
                          <p className="mt-0.5 text-[11px] text-gray-500">{template.hint}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Link2 size={15} className="text-gray-500" />
                스크립트 변수
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-xs">
                  <span className="text-gray-500">센터명</span>
                  <input
                    value={centerName}
                    onChange={(e) => setCenterName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-200 px-2 py-2 text-xs outline-none focus:border-blue-400"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-gray-500">센터 전화</span>
                  <input
                    value={centerPhone}
                    onChange={(e) => setCenterPhone(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-200 px-2 py-2 text-xs outline-none focus:border-blue-400"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-gray-500">안내 링크</span>
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-200 px-2 py-2 text-xs outline-none focus:border-blue-400"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-gray-500">예약 링크</span>
                  <input
                    value={bookingLink}
                    onChange={(e) => setBookingLink(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-200 px-2 py-2 text-xs outline-none focus:border-blue-400"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">문자 미리보기</h3>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_META[selectedTemplate.category].tone}`}>
                  {CATEGORY_META[selectedTemplate.category].label}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm leading-relaxed text-gray-800">
                {preview}
              </p>
              <p className="mt-2 text-[11px] text-gray-500">문자 길이: {preview.length}자</p>
            </div>
          </section>

          <aside className="xl:col-span-4 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Send size={15} className="text-gray-500" />
                발송 실행
              </h3>
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                  <input
                    type="radio"
                    checked={recipient === "citizen"}
                    onChange={() => setRecipient("citizen")}
                  />
                  <User size={12} className="text-gray-500" />
                  본인 ({caseRecord ? maskPhone(caseRecord.profile.phone) : "-"})
                </label>
                <label
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    recipientDisabled ? "border-dashed border-gray-200 bg-gray-50 text-gray-400" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    checked={recipient === "guardian"}
                    onChange={() => setRecipient("guardian")}
                    disabled={recipientDisabled}
                  />
                  <UserRoundCheck size={12} className="text-gray-500" />
                  보호자 ({caseRecord?.profile.guardianPhone ? maskPhone(caseRecord.profile.guardianPhone) : "미등록"})
                </label>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-[11px] font-semibold">
                <button
                  onClick={() => setMode("NOW")}
                  className={`rounded-md px-2 py-1 ${mode === "NOW" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
                >
                  즉시 발송
                </button>
                <button
                  onClick={() => setMode("SCHEDULE")}
                  className={`rounded-md px-2 py-1 ${mode === "SCHEDULE" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
                >
                  예약 발송
                </button>
              </div>

              {mode === "SCHEDULE" ? (
                <label className="mt-3 block text-xs text-gray-500">
                  예약 시각
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-200 px-2 py-2 text-xs outline-none focus:border-blue-400"
                  />
                </label>
              ) : null}

              <button
                onClick={handleSend}
                disabled={sendDisabled}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#163b6f] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {sending ? "처리 중..." : mode === "NOW" ? "문자 발송" : "예약 등록"}
              </button>

              {!recipientPhone ? (
                <p className="mt-2 text-[11px] text-red-600">수신 가능한 연락처가 없습니다.</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <History size={15} className="text-gray-500" />
                발송 이력
              </h3>
              <div className="mt-3 space-y-2">
                {history.length === 0 ? (
                  <p className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    발송 이력이 없습니다.
                  </p>
                ) : (
                  history.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-800">{entry.templateLabel}</p>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            entry.status === "SENT"
                              ? "bg-emerald-100 text-emerald-700"
                              : entry.status === "SCHEDULED"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {entry.status === "SENT" ? "발송" : entry.status === "SCHEDULED" ? "예약" : "실패"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {entry.recipient === "citizen" ? "본인" : "보호자"} · {formatDateTime(entry.at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1">
                <CalendarClock size={13} />
                운영 참고
              </h4>
              <ul className="mt-2 space-y-1 text-[11px] text-blue-800">
                <li>1차 접촉문자: 최초 안내 및 연락 시간 수집</li>
                <li>예약안내: 상담/선별검사 예약 전환</li>
                <li>리마인더: 미확인·미응답 재접촉</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
