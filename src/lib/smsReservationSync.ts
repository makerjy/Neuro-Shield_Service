export type SmsReservationStatus = "RESERVED" | "CANCELLED" | "CHANGED" | "NO_SHOW";

export type SmsReservationActor = "CITIZEN" | "STAFF" | "AGENT" | "SYSTEM";

export type SmsReservationOption = {
  key: string;
  label: string;
  value: string;
};

export type SmsReservationSyncEvent = {
  eventId: string;
  source: "SMS";
  caseId?: string;
  phone?: string;
  reservationId?: string;
  status: SmsReservationStatus;
  programType?: string;
  programName?: string;
  scheduledAt?: string;
  locationName?: string;
  options?: SmsReservationOption[];
  createdAt: string;
  updatedAt: string;
  createdBy: SmsReservationActor;
  lastSmsSentAt?: string;
  note?: string;
};

export const SMS_RESERVATION_SYNC_STORAGE_KEY = "neuro-shield:sms-reservation-sync:v1";
export const SMS_TOKEN_CASE_MAP_STORAGE_KEY = "neuro-shield:sms-token-case-map:v1";

const MAX_SYNC_EVENTS = 200;
const MAX_TOKEN_MAPPINGS = 400;

type SmsTokenCaseMapping = {
  token: string;
  caseId: string;
  sentAt: string;
  updatedAt: string;
};

function safeParseArray(raw: string | null): SmsReservationSyncEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SmsReservationSyncEvent => Boolean(item) && typeof item === "object");
  } catch {
    return [];
  }
}

function safeParseTokenMappings(raw: string | null): SmsTokenCaseMapping[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SmsTokenCaseMapping =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as SmsTokenCaseMapping).token === "string" &&
        typeof (item as SmsTokenCaseMapping).caseId === "string",
    );
  } catch {
    return [];
  }
}

export function listSmsReservationSyncEvents(): SmsReservationSyncEvent[] {
  if (typeof window === "undefined") return [];
  return safeParseArray(window.localStorage.getItem(SMS_RESERVATION_SYNC_STORAGE_KEY)).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function upsertSmsReservationSyncEvent(event: Omit<SmsReservationSyncEvent, "eventId" | "updatedAt"> & { eventId?: string; updatedAt?: string }) {
  if (typeof window === "undefined") return null;
  const updatedAt = event.updatedAt ?? new Date().toISOString();
  const eventId = event.eventId ?? `sms-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const normalized: SmsReservationSyncEvent = {
    ...event,
    source: "SMS",
    eventId,
    updatedAt,
  };
  const current = listSmsReservationSyncEvents();
  const key = `${normalized.reservationId ?? normalized.eventId}:${normalized.status}:${normalized.updatedAt}`;
  const deduped = current.filter(
    (item) => `${item.reservationId ?? item.eventId}:${item.status}:${item.updatedAt}` !== key,
  );
  const next = [normalized, ...deduped].slice(0, MAX_SYNC_EVENTS);
  window.localStorage.setItem(SMS_RESERVATION_SYNC_STORAGE_KEY, JSON.stringify(next));
  return normalized;
}

export function normalizePhoneForSync(input?: string | null) {
  if (!input) return "";
  return input.replace(/\D/g, "");
}

export function rememberSmsTokenCaseLink(params: { token?: string | null; caseId?: string | null; sentAt?: string }) {
  const token = (params.token ?? "").trim();
  const caseId = (params.caseId ?? "").trim();
  if (!token || !caseId) return null;
  if (typeof window === "undefined") return null;

  const now = new Date().toISOString();
  const current = safeParseTokenMappings(window.localStorage.getItem(SMS_TOKEN_CASE_MAP_STORAGE_KEY));
  const deduped = current.filter((item) => item.token !== token);
  const nextEntry: SmsTokenCaseMapping = {
    token,
    caseId,
    sentAt: params.sentAt ?? now,
    updatedAt: now,
  };
  const next = [nextEntry, ...deduped].slice(0, MAX_TOKEN_MAPPINGS);
  window.localStorage.setItem(SMS_TOKEN_CASE_MAP_STORAGE_KEY, JSON.stringify(next));
  return nextEntry;
}

export function resolveCaseIdBySmsToken(token?: string | null) {
  const safeToken = (token ?? "").trim();
  if (!safeToken) return undefined;
  if (typeof window === "undefined") return undefined;
  const mappings = safeParseTokenMappings(window.localStorage.getItem(SMS_TOKEN_CASE_MAP_STORAGE_KEY));
  return mappings.find((item) => item.token === safeToken)?.caseId;
}

export function matchSmsReservationSyncEvent(
  event: SmsReservationSyncEvent,
  params: {
    caseId?: string;
    phoneCandidates?: Array<string | undefined | null>;
  },
) {
  const eventCaseId = (event.caseId ?? "").trim();
  const targetCaseId = (params.caseId ?? "").trim();
  if (eventCaseId && targetCaseId && eventCaseId === targetCaseId) return true;

  const eventPhone = normalizePhoneForSync(event.phone);
  if (!eventPhone) return false;
  return (params.phoneCandidates ?? []).some((candidate) => {
    const normalizedCandidate = normalizePhoneForSync(candidate);
    if (!normalizedCandidate) return false;
    if (normalizedCandidate === eventPhone) return true;
    if (normalizedCandidate.length >= 4 && eventPhone.endsWith(normalizedCandidate.slice(-4))) return true;
    return false;
  });
}
