import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Home,
  Phone,
  Plus,
} from "lucide-react";
import { cn } from "./shared";

type ViewMode = "month" | "week" | "day";
type ScheduleType = "연락" | "예약" | "방문" | "의뢰";
type ScheduleStatus = "예정" | "대기" | "지연" | "완료";

type ScheduleItem = {
  id: string;
  caseId: string;
  date: string;
  time: string;
  type: ScheduleType;
  status: ScheduleStatus;
  title: string;
  assignee: string;
  location?: string;
  reminderSent?: boolean;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function dayDiff(from: Date, to: Date) {
  const fromTs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toTs = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((toTs - fromTs) / (24 * 60 * 60 * 1000));
}

function typeMeta(type: ScheduleType) {
  if (type === "연락") return { icon: Phone, chip: "bg-blue-500 text-white" };
  if (type === "예약") return { icon: CalendarIcon, chip: "bg-emerald-500 text-white" };
  if (type === "방문") return { icon: Home, chip: "bg-violet-500 text-white" };
  return { icon: ExternalLink, chip: "bg-cyan-600 text-white" };
}

function statusTone(status: ScheduleStatus) {
  if (status === "지연") return "text-red-600 bg-red-50 border-red-100";
  if (status === "대기") return "text-amber-700 bg-amber-50 border-amber-100";
  if (status === "완료") return "text-gray-600 bg-gray-50 border-gray-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-100";
}

export function CalendarView() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [baseMonth, setBaseMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  const today = new Date();
  const todayKey = dateKey(today);

  const schedules = useMemo<ScheduleItem[]>(() => {
    const mk = (offset: number, time: string, item: Omit<ScheduleItem, "date" | "time">): ScheduleItem => {
      const target = new Date(today);
      target.setDate(today.getDate() + offset);
      return { ...item, date: dateKey(target), time };
    };
    return [
      mk(0, "09:30", {
        id: "SCH-001",
        caseId: "CASE-2026-001",
        type: "연락",
        status: "예정",
        title: "1차 접촉 재시도",
        assignee: "이동욱",
      }),
      mk(0, "14:00", {
        id: "SCH-002",
        caseId: "CASE-2026-011",
        type: "예약",
        status: "지연",
        title: "선별검사 예약 재확인",
        assignee: "서지윤",
        reminderSent: false,
      }),
      mk(1, "10:20", {
        id: "SCH-003",
        caseId: "CASE-2026-015",
        type: "연락",
        status: "대기",
        title: "미응답 리마인더 발송 확인",
        assignee: "이동욱",
      }),
      mk(2, "11:00", {
        id: "SCH-004",
        caseId: "CASE-2026-003",
        type: "방문",
        status: "예정",
        title: "가정 방문 상담",
        assignee: "김성실",
        location: "강남구 역삼동",
      }),
      mk(2, "16:30", {
        id: "SCH-005",
        caseId: "CASE-2026-014",
        type: "의뢰",
        status: "예정",
        title: "연계 요청서 전송",
        assignee: "한수민",
      }),
      mk(3, "13:40", {
        id: "SCH-006",
        caseId: "CASE-2026-008",
        type: "예약",
        status: "예정",
        title: "예약 확정 안내",
        assignee: "최유리",
      }),
      mk(-1, "15:10", {
        id: "SCH-007",
        caseId: "CASE-2026-010",
        type: "연락",
        status: "완료",
        title: "1차 접촉 안내 완료",
        assignee: "박민지",
        reminderSent: true,
      }),
      mk(-2, "10:00", {
        id: "SCH-008",
        caseId: "CASE-2026-005",
        type: "의뢰",
        status: "지연",
        title: "의뢰기관 일정 재조율",
        assignee: "오민석",
      }),
    ];
  }, [today]);

  const monthCells = useMemo(() => {
    const year = baseMonth.getFullYear();
    const month = baseMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<number | null> = [];

    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [baseMonth]);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of schedules) {
      const arr = map.get(item.date) ?? [];
      arr.push(item);
      map.set(item.date, arr);
    }
    for (const entries of map.values()) {
      entries.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [schedules]);

  const remindersDue = useMemo(() => {
    return schedules.filter((item) => {
      if (item.status !== "예정" && item.status !== "대기") return false;
      if (item.reminderSent) return false;
      const diff = dayDiff(today, parseDateKey(item.date));
      return diff >= 0 && diff <= 3;
    });
  }, [schedules, today]);

  const todaySchedules = schedulesByDate.get(todayKey) ?? [];
  const selectedSchedules = schedulesByDate.get(selectedDate) ?? [];
  const delayedSchedules = schedules.filter((item) => item.status === "지연");

  const monthLabel = `${baseMonth.getFullYear()}년 ${baseMonth.getMonth() + 1}월`;
  const monthShift = (offset: number) => {
    setBaseMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  return (
    <div className="space-y-5">
      {remindersDue.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-700" />
              <p className="text-sm font-semibold text-amber-900">리마인더 발송 대기 {remindersDue.length}건</p>
            </div>
            <button className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800">
              리마인더 큐 보기
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr,320px]">
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <header className="border-b border-gray-100 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">{monthLabel}</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => monthShift(-1)}
                    className="rounded border border-gray-200 p-1 text-gray-600 hover:bg-gray-50"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => monthShift(1)}
                    className="rounded border border-gray-200 p-1 text-gray-600 hover:bg-gray-50"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
                <button
                  onClick={() => {
                    const now = new Date();
                    setBaseMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                    setSelectedDate(dateKey(now));
                  }}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                >
                  오늘
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-1 text-[11px] font-semibold">
                  {(["month", "week", "day"] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        "rounded-md px-2.5 py-1",
                        viewMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                      )}
                    >
                      {mode === "month" ? "월" : mode === "week" ? "주" : "일"}
                    </button>
                  ))}
                </div>
                <button className="inline-flex items-center gap-1 rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white">
                  <Plus size={13} />
                  일정 생성
                </button>
              </div>
            </div>
          </header>

          <div className="px-3 pb-3 pt-2">
            <div className="grid grid-cols-7 border-b border-gray-100 pb-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 pt-2">
              {monthCells.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="min-h-[110px] rounded-lg border border-transparent bg-gray-50/40" />;
                }

                const key = `${baseMonth.getFullYear()}-${pad(baseMonth.getMonth() + 1)}-${pad(day)}`;
                const dayItems = schedulesByDate.get(key) ?? [];
                const isToday = key === todayKey;
                const isSelected = key === selectedDate;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(key)}
                    className={cn(
                      "min-h-[110px] rounded-lg border p-2 text-left transition-colors",
                      isSelected ? "border-blue-300 bg-blue-50" : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50",
                      isToday && !isSelected ? "border-emerald-300" : ""
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                          isToday ? "bg-emerald-500 text-white" : "text-gray-600"
                        )}
                      >
                        {day}
                      </span>
                      <span className="text-[10px] text-gray-400">{dayItems.length ? `${dayItems.length}건` : ""}</span>
                    </div>
                    <div className="space-y-1">
                      {dayItems.slice(0, 3).map((item) => {
                        const meta = typeMeta(item.type);
                        const Icon = meta.icon;
                        return (
                          <div key={item.id} className={cn("flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold", meta.chip)}>
                            <Icon size={9} />
                            <span className="truncate">{item.time} {item.caseId}</span>
                          </div>
                        );
                      })}
                      {dayItems.length > 3 ? (
                        <p className="text-[10px] text-gray-500">+{dayItems.length - 3}건</p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
              {(["연락", "예약", "방문", "의뢰"] as ScheduleType[]).map((type) => {
                const meta = typeMeta(type);
                const Icon = meta.icon;
                return (
                  <div key={type} className="inline-flex items-center gap-1 rounded border border-gray-100 bg-gray-50 px-2 py-1 text-gray-600">
                    <Icon size={11} />
                    {type}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Clock3 size={14} className="text-blue-600" />
              오늘의 일정
            </h3>
            <div className="mt-3 space-y-2">
              {todaySchedules.length === 0 ? (
                <p className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  오늘 일정이 없습니다.
                </p>
              ) : (
                todaySchedules.map((item) => (
                  <div key={item.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-800">{item.time} · {item.title}</p>
                      <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", statusTone(item.status))}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">{item.caseId} · {item.assignee}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-bold text-red-800 flex items-center gap-2">
              <AlertCircle size={14} />
              지연 일정
            </h3>
            <div className="mt-3 space-y-2">
              {delayedSchedules.map((item) => (
                <div key={item.id} className="rounded-md border border-red-100 bg-white px-3 py-2 text-xs">
                  <p className="font-semibold text-gray-900">{item.caseId}</p>
                  <p className="mt-0.5 text-red-700">{item.title}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{item.date} {item.time}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900">선택 날짜 상세</h3>
            <p className="mt-1 text-[11px] text-gray-500">{selectedDate}</p>
            <div className="mt-3 space-y-2">
              {selectedSchedules.length === 0 ? (
                <p className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  선택 날짜 일정이 없습니다.
                </p>
              ) : (
                selectedSchedules.map((item) => (
                  <article key={item.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-900">{item.time} · {item.type}</p>
                    <p className="mt-1 text-gray-700">{item.title}</p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {item.caseId} · 담당 {item.assignee}
                      {item.location ? ` · ${item.location}` : ""}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
