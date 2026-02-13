import { useCallback, useMemo, useState } from "react";
import {
  buildCalendarDraftFromOutcome,
  createStage1CalendarEvent,
  saveStage1Outcome,
} from "../components/local-center/v2/stage1/stage1OutcomeApi";
import type {
  CalendarEventDraft,
  CalendarEventType,
  OutcomeSavePayload,
  OutcomeSaveResponse,
} from "../components/local-center/v2/stage1/stage1Types";

export type CalendarSyncFailure = {
  idempotencyKey: string;
  caseId: string;
  outcomeId: string;
  event: CalendarEventDraft;
  eventType: CalendarEventType;
  title: string;
  scheduledAt: string;
  errorMessage: string;
  retryCount: number;
  recordedAt: string;
};

export type OutcomeSubmitSuccess = {
  outcome: OutcomeSaveResponse;
  calendar: {
    created: Array<{
      idempotencyKey: string;
      eventId: string;
      event: CalendarEventDraft;
    }>;
    failed: CalendarSyncFailure[];
  };
};

type OutcomeSubmitArgs = {
  caseId: string;
  payload: OutcomeSavePayload;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "요청 처리 중 오류가 발생했습니다.";
}

function buildFailureItem(params: {
  idempotencyKey: string;
  caseId: string;
  outcomeId: string;
  event: CalendarEventDraft;
  errorMessage: string;
  retryCount: number;
}): CalendarSyncFailure {
  return {
    idempotencyKey: params.idempotencyKey,
    caseId: params.caseId,
    outcomeId: params.outcomeId,
    event: params.event,
    eventType: params.event.type,
    title: params.event.title,
    scheduledAt: params.event.startAt,
    errorMessage: params.errorMessage,
    retryCount: params.retryCount,
    recordedAt: nowIso(),
  };
}

export { buildCalendarDraftFromOutcome };

export function useOutcomeSubmit() {
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [calendarFailures, setCalendarFailures] = useState<CalendarSyncFailure[]>([]);
  const [retryingKeys, setRetryingKeys] = useState<Record<string, boolean>>({});

  const submit = useCallback(
    async ({ caseId, payload }: OutcomeSubmitArgs): Promise<OutcomeSubmitSuccess | null> => {
      if (isSaving) return null;
      setIsSaving(true);
      setSubmitError(null);

      try {
        const outcome = await saveStage1Outcome(caseId, payload);
        const events =
          outcome.nextAction?.events ??
          buildCalendarDraftFromOutcome({
            caseId,
            outcomeType: payload.outcomeType,
            memo: payload.memo,
            reject: payload.reject,
            noResponse: payload.noResponse,
          });

        const created: OutcomeSubmitSuccess["calendar"]["created"] = [];
        const failed: CalendarSyncFailure[] = [];

        for (let idx = 0; idx < events.length; idx += 1) {
          const event = events[idx];
          const idempotencyKey = `${caseId}:${outcome.outcomeId}:${event.type}:${idx}`;
          try {
            const calendarResponse = await createStage1CalendarEvent({
              idempotencyKey,
              event,
            });
            created.push({
              idempotencyKey,
              eventId: calendarResponse.eventId,
              event,
            });
          } catch (error) {
            failed.push(
              buildFailureItem({
                idempotencyKey,
                caseId,
                outcomeId: outcome.outcomeId,
                event,
                errorMessage: normalizeErrorMessage(error),
                retryCount: 0,
              })
            );
          }
        }

        setCalendarFailures((prev) => {
          const deduped = prev.filter((entry) => !failed.some((nextEntry) => nextEntry.idempotencyKey === entry.idempotencyKey));
          return [...failed, ...deduped];
        });

        return {
          outcome,
          calendar: {
            created,
            failed,
          },
        };
      } catch (error) {
        setSubmitError(normalizeErrorMessage(error));
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving]
  );

  const retryCalendarFailure = useCallback(
    async (idempotencyKey: string): Promise<{ ok: boolean; eventId?: string; failure?: CalendarSyncFailure }> => {
      const target = calendarFailures.find((entry) => entry.idempotencyKey === idempotencyKey);
      if (!target) {
        return { ok: false };
      }

      setRetryingKeys((prev) => ({ ...prev, [idempotencyKey]: true }));
      try {
        const response = await createStage1CalendarEvent({
          idempotencyKey: target.idempotencyKey,
          event: target.event,
        });
        setCalendarFailures((prev) => prev.filter((entry) => entry.idempotencyKey !== idempotencyKey));
        return { ok: true, eventId: response.eventId };
      } catch (error) {
        const updated = buildFailureItem({
          idempotencyKey: target.idempotencyKey,
          caseId: target.caseId,
          outcomeId: target.outcomeId,
          event: target.event,
          errorMessage: normalizeErrorMessage(error),
          retryCount: target.retryCount + 1,
        });
        setCalendarFailures((prev) =>
          prev.map((entry) => (entry.idempotencyKey === idempotencyKey ? updated : entry))
        );
        return { ok: false, failure: updated };
      } finally {
        setRetryingKeys((prev) => {
          const next = { ...prev };
          delete next[idempotencyKey];
          return next;
        });
      }
    },
    [calendarFailures]
  );

  const isRetrying = useMemo(() => {
    const entries = Object.values(retryingKeys);
    return entries.some(Boolean);
  }, [retryingKeys]);

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  return {
    isSaving,
    submitError,
    calendarFailures,
    retryingKeys,
    isRetrying,
    submit,
    retryCalendarFailure,
    clearSubmitError,
  };
}

