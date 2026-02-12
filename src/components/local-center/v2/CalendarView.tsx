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
  Trash2,
} from "lucide-react";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
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
  notes?: string;
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
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCaseId, setNewCaseId] = useState("");
  const [newDate, setNewDate] = useState(() => dateKey(new Date()));
  const [newTime, setNewTime] = useState("09:00");
  const [newType, setNewType] = useState<ScheduleType>("연락");
  const [newStatus, setNewStatus] = useState<ScheduleStatus>("예정");
  const [newAssignee, setNewAssignee] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const today = new Date();
  const todayKey = dateKey(today);

  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => {
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
        notes: "보호자 통화 후 시간 재조율 필요",
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
        notes: "방문 전 30분 사전 연락",
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
        notes: "의뢰 병원 대기 슬롯 확인 필요",
      }),
    ];
  });

  const selectedSchedule = useMemo(
    () => schedules.find((item) => item.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId]
  );

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

  const openCreateDialog = () => {
    setNewTitle("");
    setNewCaseId("");
    setNewDate(selectedDate);
    setNewTime("09:00");
    setNewType("연락");
    setNewStatus("예정");
    setNewAssignee("");
    setNewLocation("");
    setNewNotes("");
    setCreateOpen(true);
  };

  const openDetailsDialog = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setDetailsOpen(true);
  };

  const handleCreateSchedule = () => {
    if (!newTitle.trim() || !newCaseId.trim() || !newDate || !newTime || !newAssignee.trim()) {
      window.alert("필수 항목(일정명, 케이스 ID, 날짜, 시간, 담당자)을 입력해주세요.");
      return;
    }

    const created: ScheduleItem = {
      id: `SCH-${Date.now()}`,
      caseId: newCaseId.trim(),
      date: newDate,
      time: newTime,
      type: newType,
      status: newStatus,
      title: newTitle.trim(),
      assignee: newAssignee.trim(),
      location: newLocation.trim() || undefined,
      notes: newNotes.trim() || undefined,
      reminderSent: false,
    };

    setSchedules((prev) => [created, ...prev]);
    setSelectedDate(newDate);
    setCreateOpen(false);
  };

  const handleDeleteSchedule = () => {
    if (!selectedSchedule) return;
    const confirmed = window.confirm("선택한 일정을 삭제하시겠습니까?");
    if (!confirmed) return;
    setSchedules((prev) => prev.filter((item) => item.id !== selectedSchedule.id));
    setDetailsOpen(false);
    setSelectedScheduleId(null);
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="xl:col-span-8 rounded-xl border border-gray-200 bg-white shadow-sm">
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
                <button
                  onClick={openCreateDialog}
                  className="inline-flex items-center gap-1 rounded-md bg-[#163b6f] px-3 py-1.5 text-xs font-semibold text-white"
                >
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
                  return <div key={`empty-${idx}`} className="min-h-[90px] rounded-lg border border-transparent bg-gray-50/40" />;
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
                      "min-h-[90px] rounded-lg border p-2 text-left transition-colors",
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
                      {dayItems.slice(0, 2).map((item) => {
                        const meta = typeMeta(item.type);
                        const Icon = meta.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              openDetailsDialog(item.id);
                            }}
                            className={cn(
                              "flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-90",
                              meta.chip
                            )}
                          >
                            <Icon size={9} />
                            <span className="truncate">{item.time} {item.caseId}</span>
                          </button>
                        );
                      })}
                      {dayItems.length > 2 ? (
                        <p className="text-[10px] text-gray-500">+{dayItems.length - 2}건</p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-[11px] md:grid-cols-4">
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

        <aside className="space-y-4 xl:col-span-4 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-132px)] xl:overflow-y-auto xl:pr-1">
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
                  <button
                    key={item.id}
                    onClick={() => openDetailsDialog(item.id)}
                    className="w-full rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-left text-xs transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-800">{item.time} · {item.title}</p>
                      <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", statusTone(item.status))}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">{item.caseId} · {item.assignee}</p>
                  </button>
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
                <button
                  key={item.id}
                  onClick={() => openDetailsDialog(item.id)}
                  className="w-full rounded-md border border-red-100 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-red-200 hover:bg-red-50"
                >
                  <p className="font-semibold text-gray-900">{item.caseId}</p>
                  <p className="mt-0.5 text-red-700">{item.title}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{item.date} {item.time}</p>
                </button>
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
                  <button
                    key={item.id}
                    onClick={() => openDetailsDialog(item.id)}
                    className="w-full rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-left text-xs transition-colors hover:border-gray-200 hover:bg-white"
                  >
                    <p className="font-semibold text-gray-900">{item.time} · {item.type}</p>
                    <p className="mt-1 text-gray-700">{item.title}</p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {item.caseId} · 담당 {item.assignee}
                      {item.location ? ` · ${item.location}` : ""}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>일정 생성</DialogTitle>
            <DialogDescription>필수 항목을 입력해 일정을 등록합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>일정명</Label>
              <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className="mt-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>케이스 ID</Label>
                <Input value={newCaseId} onChange={(event) => setNewCaseId(event.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>담당자</Label>
                <Input value={newAssignee} onChange={(event) => setNewAssignee(event.target.value)} className="mt-2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>일정 날짜</Label>
                <Input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>일정 시간</Label>
                <Input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} className="mt-2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>일정 유형</Label>
                <select
                  value={newType}
                  onChange={(event) => setNewType(event.target.value as ScheduleType)}
                  className="mt-2 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {(["연락", "예약", "방문", "의뢰"] as ScheduleType[]).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>진행 상태</Label>
                <select
                  value={newStatus}
                  onChange={(event) => setNewStatus(event.target.value as ScheduleStatus)}
                  className="mt-2 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {(["예정", "대기", "지연", "완료"] as ScheduleStatus[]).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>위치(선택)</Label>
              <Input value={newLocation} onChange={(event) => setNewLocation(event.target.value)} className="mt-2" />
            </div>
            <div>
              <Label>메모(선택)</Label>
              <Textarea
                value={newNotes}
                onChange={(event) => setNewNotes(event.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreateSchedule}>등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>일정 상세</DialogTitle>
            <DialogDescription>일정 정보 확인 및 관리</DialogDescription>
          </DialogHeader>

          {selectedSchedule ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-bold text-gray-900">{selectedSchedule.title}</p>
                <p className="mt-1 text-xs text-gray-600">{selectedSchedule.caseId} · 담당 {selectedSchedule.assignee}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">일정 일시</p>
                  <p className="mt-1 font-semibold text-gray-900">{selectedSchedule.date} {selectedSchedule.time}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">일정 유형</p>
                  <p className="mt-1 font-semibold text-gray-900">{selectedSchedule.type}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">상태</p>
                  <span className={cn("mt-1 inline-flex rounded border px-2 py-0.5 text-xs font-semibold", statusTone(selectedSchedule.status))}>
                    {selectedSchedule.status}
                  </span>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">위치</p>
                  <p className="mt-1 font-semibold text-gray-900">{selectedSchedule.location ?? "-"}</p>
                </div>
              </div>

              {selectedSchedule.notes ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-700">메모</p>
                  <p className="mt-1 text-sm text-blue-900">{selectedSchedule.notes}</p>
                </div>
              ) : null}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>닫기</Button>
                <Button variant="destructive" onClick={handleDeleteSchedule}>
                  <Trash2 size={14} className="mr-1" />
                  일정 삭제
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
