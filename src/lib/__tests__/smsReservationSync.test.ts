import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listSmsReservationSyncEvents,
  matchSmsReservationSyncEvent,
  normalizePhoneForSync,
  rememberSmsTokenCaseLink,
  resolveCaseIdBySmsToken,
  SMS_RESERVATION_SYNC_STORAGE_KEY,
  upsertSmsReservationSyncEvent,
} from "../smsReservationSync";

describe("smsReservationSync", () => {
  const createStorage = () => {
    const storage = new Map<string, string>();
    return {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    };
  };

  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createStorage() });
    window.localStorage.removeItem(SMS_RESERVATION_SYNC_STORAGE_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("upsert duplicates by reservationId/status/updatedAt and keeps latest first", () => {
    upsertSmsReservationSyncEvent({
      source: "SMS",
      caseId: "CASE-1",
      phone: "010-1111-2222",
      reservationId: "R-1",
      status: "RESERVED",
      createdAt: "2026-02-20T10:00:00.000Z",
      updatedAt: "2026-02-20T10:00:00.000Z",
      createdBy: "CITIZEN",
      programName: "센터 예약",
    });

    upsertSmsReservationSyncEvent({
      source: "SMS",
      caseId: "CASE-1",
      phone: "010-1111-2222",
      reservationId: "R-1",
      status: "RESERVED",
      createdAt: "2026-02-20T10:00:00.000Z",
      updatedAt: "2026-02-20T10:00:00.000Z",
      createdBy: "CITIZEN",
      programName: "센터 예약(중복)",
    });

    upsertSmsReservationSyncEvent({
      source: "SMS",
      caseId: "CASE-1",
      phone: "010-1111-2222",
      reservationId: "R-2",
      status: "CHANGED",
      createdAt: "2026-02-20T10:01:00.000Z",
      updatedAt: "2026-02-20T10:01:00.000Z",
      createdBy: "CITIZEN",
      programName: "센터 예약 변경",
    });

    const events = listSmsReservationSyncEvents();
    expect(events).toHaveLength(2);
    expect(events[0]?.reservationId).toBe("R-2");
    expect(events[1]?.reservationId).toBe("R-1");
  });

  it("matches by caseId first, then normalized phone", () => {
    const event = upsertSmsReservationSyncEvent({
      source: "SMS",
      caseId: "CASE-9",
      phone: "010-1234-5678",
      reservationId: "R-9",
      status: "RESERVED",
      createdAt: "2026-02-20T11:00:00.000Z",
      updatedAt: "2026-02-20T11:00:00.000Z",
      createdBy: "CITIZEN",
      programName: "센터 예약",
    });
    expect(event).not.toBeNull();
    if (!event) return;

    expect(
      matchSmsReservationSyncEvent(event, {
        caseId: "CASE-9",
        phoneCandidates: ["01099990000"],
      }),
    ).toBe(true);

    expect(
      matchSmsReservationSyncEvent(event, {
        caseId: "CASE-X",
        phoneCandidates: ["01012345678"],
      }),
    ).toBe(true);

    expect(
      matchSmsReservationSyncEvent(event, {
        caseId: "CASE-X",
        phoneCandidates: ["01000000000"],
      }),
    ).toBe(false);
  });

  it("normalizes phone numbers", () => {
    expect(normalizePhoneForSync("010-1234-5678")).toBe("01012345678");
    expect(normalizePhoneForSync("+82 10 1234 5678")).toBe("821012345678");
    expect(normalizePhoneForSync(null)).toBe("");
  });

  it("matches masked candidates by last four digits", () => {
    const event = upsertSmsReservationSyncEvent({
      source: "SMS",
      phone: "010-9934-7788",
      reservationId: "R-LAST4",
      status: "RESERVED",
      createdAt: "2026-02-20T12:00:00.000Z",
      updatedAt: "2026-02-20T12:00:00.000Z",
      createdBy: "CITIZEN",
    });
    expect(event).not.toBeNull();
    if (!event) return;

    expect(matchSmsReservationSyncEvent(event, { caseId: "CASE-X", phoneCandidates: ["010-****-7788"] })).toBe(true);
    expect(matchSmsReservationSyncEvent(event, { caseId: "CASE-X", phoneCandidates: ["010-****-0099"] })).toBe(false);
  });

  it("stores and resolves token-case mapping", () => {
    rememberSmsTokenCaseLink({ token: "tmp-token-abc", caseId: "CASE-2026-175", sentAt: "2026-02-20T13:00:00.000Z" });
    expect(resolveCaseIdBySmsToken("tmp-token-abc")).toBe("CASE-2026-175");
    expect(resolveCaseIdBySmsToken("tmp-token-missing")).toBeUndefined();
  });
});
