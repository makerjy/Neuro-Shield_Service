import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  BellRing,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  ExternalLink,
  Filter,
  Home,
  MessageSquare,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Stethoscope,
  Trash2,
  User,
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
import {
  CONTACT_STATUS_LABELS,
  CONSULT_STATUS_LABELS,
  RESERVATION_TYPE_LABELS,
  SECOND_EXAM_LABELS,
  generateAppointments,
  generateCases,
  maskPhone,
  type AppointmentStatus,
  type ContactStatus,
  type ConsultStatus,
  type ReservationType,
  type RiskLevel,
  type SecondExamStatus,
} from "../caseData";

type ViewMode = "month" | "week" | "day";
type ScheduleType = "연락" | "예약" | "방문" | "의뢰" | "검사";
type ScheduleStatus = "예정" | "대기" | "지연" | "완료" | "취소";
type PriorityLevel = "긴급" | "높음" | "보통";
type ReminderChannel = "SMS" | "전화" | "앱";
type FormMode = "create" | "edit";

type ScheduleItem = {
  id: string;
  caseId: string;
  patientName: string;
  patientAge: number;
  date: string;
  time: string;
  durationMinutes: number;
  type: ScheduleType;
  status: ScheduleStatus;
  priority: PriorityLevel;
  riskLevel: RiskLevel;
  title: string;
  assignee: string;
  location?: string;
  reservationType?: ReservationType;
  contactStatus?: ContactStatus;
  consultStatus?: ConsultStatus;
  secondExamStatus?: SecondExamStatus;
  phone?: string;
  guardianPhone?: string;
  reminderSent: boolean;
  reminderChannel: ReminderChannel;
  followUpRequired: boolean;
  reasonText?: string;
  notes?: string;
  autoMemoRecent?: string[];
};

type ScheduleFormState = {
  title: string;
  caseId: string;
  patientName: string;
  patientAge: string;
  date: string;
  time: string;
  durationMinutes: string;
  type: ScheduleType;
  status: ScheduleStatus;
  priority: PriorityLevel;
  riskLevel: RiskLevel;
  assignee: string;
  location: string;
  reservationType: ReservationType | "";
  contactStatus: ContactStatus | "";
  consultStatus: ConsultStatus | "";
  secondExamStatus: SecondExamStatus | "";
  phone: string;
  guardianPhone: string;
  reminderSent: boolean;
  reminderChannel: ReminderChannel;
  followUpRequired: boolean;
  reasonText: string;
  notes: string;
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

function shiftDate(baseDate: Date, offsetDays: number) {
  const moved = new Date(baseDate);
  moved.setDate(baseDate.getDate() + offsetDays);
  return moved;
}

function dayDiff(from: Date, to: Date) {
  const fromTs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toTs = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((toTs - fromTs) / (24 * 60 * 60 * 1000));
}

function mapAppointmentStatus(status: AppointmentStatus): ScheduleStatus {
  if (status === "pending") return "대기";
  if (status === "completed") return "완료";
  if (status === "cancelled") return "취소";
  return "예정";
}

function mapScheduleType(label: string): ScheduleType {
  if (label.includes("2차 검사")) return "검사";
  if (label.includes("의뢰")) return "의뢰";
  if (label.includes("방문")) return "방문";
  if (label.includes("연락")) return "연락";
  return "예약";
}

function inferPriority(riskLevel: RiskLevel, status: ScheduleStatus): PriorityLevel {
  if (status === "지연" || riskLevel === "high") return "긴급";
  if (riskLevel === "medium") return "높음";
  return "보통";
}

function typeMeta(type: ScheduleType) {
  if (type === "연락") return { icon: Phone, chip: "bg-blue-500 text-white" };
  if (type === "예약") return { icon: CalendarIcon, chip: "bg-emerald-500 text-white" };
  if (type === "방문") return { icon: Home, chip: "bg-violet-500 text-white" };
  if (type === "검사") return { icon: Stethoscope, chip: "bg-indigo-600 text-white" };
  return { icon: ExternalLink, chip: "bg-cyan-600 text-white" };
}

function statusTone(status: ScheduleStatus) {
  if (status === "지연") return "text-red-700 bg-red-50 border-red-100";
  if (status === "대기") return "text-amber-700 bg-amber-50 border-amber-100";
  if (status === "완료") return "text-gray-600 bg-gray-50 border-gray-200";
  if (status === "취소") return "text-slate-600 bg-slate-100 border-slate-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-100";
}

function priorityTone(priority: PriorityLevel) {
  if (priority === "긴급") return "text-red-700 bg-red-50 border-red-100";
  if (priority === "높음") return "text-orange-700 bg-orange-50 border-orange-100";
  return "text-blue-700 bg-blue-50 border-blue-100";
}

function riskMeta(riskLevel: RiskLevel) {
  if (riskLevel === "high") return { label: "고위험", tone: "text-red-700 bg-red-50 border-red-100" };
  if (riskLevel === "medium") return { label: "중위험", tone: "text-amber-700 bg-amber-50 border-amber-100" };
  return { label: "저위험", tone: "text-emerald-700 bg-emerald-50 border-emerald-100" };
}

function emptyForm(baseDate: string): ScheduleFormState {
  return {
    title: "",
    caseId: "",
    patientName: "",
    patientAge: "70",
    date: baseDate,
    time: "09:00",
    durationMinutes: "30",
    type: "연락",
    status: "예정",
    priority: "보통",
    riskLevel: "medium",
    assignee: "",
    location: "",
    reservationType: "",
    contactStatus: "",
    consultStatus: "",
    secondExamStatus: "",
    phone: "",
    guardianPhone: "",
    reminderSent: false,
    reminderChannel: "SMS",
    followUpRequired: false,
    reasonText: "",
    notes: "",
  };
}

function toForm(schedule: ScheduleItem): ScheduleFormState {
  return {
    title: schedule.title,
    caseId: schedule.caseId,
    patientName: schedule.patientName,
    patientAge: String(schedule.patientAge || 70),
    date: schedule.date,
    time: schedule.time,
    durationMinutes: String(schedule.durationMinutes || 30),
    type: schedule.type,
    status: schedule.status,
    priority: schedule.priority,
    riskLevel: schedule.riskLevel,
    assignee: schedule.assignee,
    location: schedule.location ?? "",
    reservationType: schedule.reservationType ?? "",
    contactStatus: schedule.contactStatus ?? "",
    consultStatus: schedule.consultStatus ?? "",
    secondExamStatus: schedule.secondExamStatus ?? "",
    phone: schedule.phone ?? "",
    guardianPhone: schedule.guardianPhone ?? "",
    reminderSent: schedule.reminderSent,
    reminderChannel: schedule.reminderChannel,
    followUpRequired: schedule.followUpRequired,
    reasonText: schedule.reasonText ?? "",
    notes: schedule.notes ?? "",
  };
}

function buildInitialSchedules(referenceDate: Date): ScheduleItem[] {
  const cases = generateCases();
  const appointments = generateAppointments(cases).slice(0, 24);
  const caseById = new Map(cases.map((item) => [item.id, item]));

  const fromAppointments: ScheduleItem[] = appointments.map((apt, index) => {
    const mappedStatus = mapAppointmentStatus(apt.status);
    const scheduleType = mapScheduleType(apt.type);
    const targetDate = dateKey(shiftDate(referenceDate, (index % 17) - 6));
    const fallbackMinute = index % 2 === 0 ? "00" : "30";
    const existingCase = caseById.get(apt.caseId);

    return {
      id: `SCH-APT-${pad(index + 1)}`,
      caseId: apt.caseId,
      patientName: apt.patientName,
      patientAge: apt.patientAge || 0,
      date: targetDate,
      time: apt.time || `${pad(9 + (index % 8))}:${fallbackMinute}`,
      durationMinutes: scheduleType === "검사" ? 60 : 30,
      type: scheduleType,
      status: mappedStatus,
      priority: inferPriority(apt.riskLevel, mappedStatus),
      riskLevel: apt.riskLevel,
      title: apt.type,
      assignee: apt.counselor,
      location: existingCase?.reservation?.locationText,
      reservationType: apt.reservationType,
      contactStatus: apt.caseContactStatus,
      consultStatus: apt.caseConsultStatus,
      secondExamStatus: apt.caseSecondExamStatus,
      phone: apt.phone,
      guardianPhone: existingCase?.guardianPhone,
      reminderSent: apt.status === "reminder_sent" || Boolean(apt.reminderSent),
      reminderChannel: "SMS",
      followUpRequired: mappedStatus === "지연" || apt.riskLevel === "high",
      reasonText: apt.reasonText,
      notes: apt.notes,
      autoMemoRecent: apt.autoMemoRecent,
    };
  });

  const outreachCases = cases
    .filter((item) => item.contactStatus === "UNREACHED")
    .slice(0, 8)
    .map((item, index) => {
      const status: ScheduleStatus = index % 4 === 0 ? "지연" : index % 3 === 0 ? "대기" : "예정";
      return {
        id: `SCH-CALL-${pad(index + 1)}`,
        caseId: item.id,
        patientName: item.patientName,
        patientAge: item.age,
        date: dateKey(shiftDate(referenceDate, (index % 9) - 2)),
        time: `${pad(10 + (index % 6))}:${index % 2 === 0 ? "00" : "30"}`,
        durationMinutes: 20,
        type: "연락",
        status,
        priority: inferPriority(item.riskLevel, status),
        riskLevel: item.riskLevel,
        title: "초기 접촉 재시도",
        assignee: item.counselor,
        contactStatus: item.contactStatus,
        consultStatus: item.consultStatus,
        secondExamStatus: item.secondExamStatus,
        phone: item.phone,
        guardianPhone: item.guardianPhone,
        reminderSent: false,
        reminderChannel: "전화",
        followUpRequired: true,
        reasonText: "연속 미응답 케이스 접촉 필요",
        notes: "3회 이상 미응답 시 방문 전환 검토",
        autoMemoRecent: item.autoMemo.lines.slice(-3),
      } satisfies ScheduleItem;
    });

  const visitAndReferral = cases
    .filter((item) => item.consultStatus !== "NOT_STARTED")
    .slice(0, 8)
    .map((item, index) => {
      const isVisit = index % 2 === 0;
      const status: ScheduleStatus = index % 5 === 0 ? "지연" : "예정";
      return {
        id: `SCH-SVC-${pad(index + 1)}`,
        caseId: item.id,
        patientName: item.patientName,
        patientAge: item.age,
        date: dateKey(shiftDate(referenceDate, index + 1)),
        time: `${pad(9 + (index % 7))}:${index % 3 === 0 ? "00" : "30"}`,
        durationMinutes: isVisit ? 50 : 40,
        type: isVisit ? "방문" : "의뢰",
        status,
        priority: inferPriority(item.riskLevel, status),
        riskLevel: item.riskLevel,
        title: isVisit ? "가정 방문 상담" : "연계 기관 의뢰 진행",
        assignee: item.counselor,
        location: isVisit ? item.reservation?.locationText ?? "현장 방문 위치 확인 필요" : "연계 병원/보건소",
        reservationType: item.reservation?.type,
        contactStatus: item.contactStatus,
        consultStatus: item.consultStatus,
        secondExamStatus: item.secondExamStatus,
        phone: item.phone,
        guardianPhone: item.guardianPhone,
        reminderSent: index % 3 === 0,
        reminderChannel: isVisit ? "전화" : "SMS",
        followUpRequired: item.secondExamStatus === "SCHEDULED" || status === "지연",
        reasonText: item.reservation?.reasonText ?? "상담 후속 조치 연계",
        notes: item.autoMemo.lines.slice(-2).join(" / "),
        autoMemoRecent: item.autoMemo.lines.slice(-3),
      } satisfies ScheduleItem;
    });

  return [...fromAppointments, ...outreachCases, ...visitAndReferral].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  );
}

export function CalendarView() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [baseMonth, setBaseMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ScheduleFormState>(() => emptyForm(dateKey(new Date())));

  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | "전체">("전체");
  const [typeFilter, setTypeFilter] = useState<ScheduleType | "전체">("전체");
  const [assigneeFilter, setAssigneeFilter] = useState("전체");

  const today = new Date();
  const todayKey = dateKey(today);

  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => buildInitialSchedules(today));

  const selectedSchedule = useMemo(
    () => schedules.find((item) => item.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId]
  );

  const assigneeOptions = useMemo(() => {
    return Array.from(new Set(schedules.map((item) => item.assignee))).sort((a, b) => a.localeCompare(b, "ko"));
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return schedules.filter((item) => {
      if (statusFilter !== "전체" && item.status !== statusFilter) return false;
      if (typeFilter !== "전체" && item.type !== typeFilter) return false;
      if (assigneeFilter !== "전체" && item.assignee !== assigneeFilter) return false;
      if (!keyword) return true;

      const haystack = [
        item.caseId,
        item.patientName,
        item.title,
        item.assignee,
        item.location,
        item.reasonText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [schedules, searchKeyword, statusFilter, typeFilter, assigneeFilter]);

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
    for (const item of filteredSchedules) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [filteredSchedules]);

  const remindersDue = useMemo(() => {
    return filteredSchedules.filter((item) => {
      if (item.status !== "예정" && item.status !== "대기") return false;
      if (item.reminderSent) return false;
      const diff = dayDiff(today, parseDateKey(item.date));
      return diff >= 0 && diff <= 3;
    });
  }, [filteredSchedules, today]);

  const delayedSchedules = filteredSchedules.filter((item) => item.status === "지연");
  const highRiskSchedules = filteredSchedules.filter((item) => item.riskLevel === "high");
  const todaySchedules = schedulesByDate.get(todayKey) ?? [];
  const selectedSchedules = schedulesByDate.get(selectedDate) ?? [];

  const timelineDates = useMemo(() => {
    if (viewMode === "month") return [];
    if (viewMode === "day") return [selectedDate];

    const pivot = parseDateKey(selectedDate);
    const sunday = new Date(pivot);
    sunday.setDate(pivot.getDate() - pivot.getDay());
    return Array.from({ length: 7 }).map((_, index) => dateKey(shiftDate(sunday, index)));
  }, [viewMode, selectedDate]);

  const monthLabel = `${baseMonth.getFullYear()}년 ${baseMonth.getMonth() + 1}월`;
  const monthShift = (offset: number) => {
    setBaseMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const resetFilters = () => {
    setSearchKeyword("");
    setStatusFilter("전체");
    setTypeFilter("전체");
    setAssigneeFilter("전체");
  };

  const openCreateDialog = () => {
    setFormMode("create");
    setEditingScheduleId(null);
    setFormState(emptyForm(selectedDate));
    setFormOpen(true);
  };

  const openDetailsDialog = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setDetailsOpen(true);
  };

  const openEditDialog = () => {
    if (!selectedSchedule) return;
    setFormMode("edit");
    setEditingScheduleId(selectedSchedule.id);
    setFormState(toForm(selectedSchedule));
    setDetailsOpen(false);
    setFormOpen(true);
  };

  const onFormChange = <K extends keyof ScheduleFormState>(key: K, value: ScheduleFormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitForm = () => {
    if (
      !formState.title.trim() ||
      !formState.caseId.trim() ||
      !formState.patientName.trim() ||
      !formState.date ||
      !formState.time ||
      !formState.assignee.trim()
    ) {
      window.alert("필수 항목(일정명, 케이스 ID, 대상자명, 날짜, 시간, 담당자)을 입력해주세요.");
      return;
    }

    const parsedAge = Number(formState.patientAge);
    const parsedDuration = Number(formState.durationMinutes);
    const notes = formState.notes.trim();
    const scheduleId = formMode === "create" ? `SCH-${Date.now()}` : editingScheduleId ?? `SCH-${Date.now()}`;

    const nextSchedule: ScheduleItem = {
      id: scheduleId,
      caseId: formState.caseId.trim(),
      patientName: formState.patientName.trim(),
      patientAge: Number.isFinite(parsedAge) && parsedAge > 0 ? Math.round(parsedAge) : 0,
      date: formState.date,
      time: formState.time,
      durationMinutes: Number.isFinite(parsedDuration) && parsedDuration > 0 ? Math.round(parsedDuration) : 30,
      type: formState.type,
      status: formState.status,
      priority: formState.priority,
      riskLevel: formState.riskLevel,
      title: formState.title.trim(),
      assignee: formState.assignee.trim(),
      location: formState.location.trim() || undefined,
      reservationType: formState.reservationType || undefined,
      contactStatus: formState.contactStatus || undefined,
      consultStatus: formState.consultStatus || undefined,
      secondExamStatus: formState.secondExamStatus || undefined,
      phone: formState.phone.trim() || undefined,
      guardianPhone: formState.guardianPhone.trim() || undefined,
      reminderSent: formState.reminderSent,
      reminderChannel: formState.reminderChannel,
      followUpRequired: formState.followUpRequired,
      reasonText: formState.reasonText.trim() || undefined,
      notes: notes || undefined,
      autoMemoRecent: notes
        ? notes
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 3)
            .map((line) => `운영메모: ${line}`)
        : undefined,
    };

    if (formMode === "create") {
      setSchedules((prev) => [nextSchedule, ...prev]);
    } else {
      setSchedules((prev) => prev.map((item) => (item.id === scheduleId ? nextSchedule : item)));
      setSelectedScheduleId(scheduleId);
      setDetailsOpen(true);
    }

    const focused = parseDateKey(nextSchedule.date);
    setSelectedDate(nextSchedule.date);
    setBaseMonth(new Date(focused.getFullYear(), focused.getMonth(), 1));
    setFormOpen(false);
    setEditingScheduleId(null);
  };

  const handleDeleteSchedule = () => {
    if (!selectedSchedule) return;
    const confirmed = window.confirm("선택한 일정을 삭제하시겠습니까?");
    if (!confirmed) return;
    setSchedules((prev) => prev.filter((item) => item.id !== selectedSchedule.id));
    setSelectedScheduleId(null);
    setDetailsOpen(false);
  };

  return (
    <div className="space-y-5">
      {remindersDue.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BellRing size={16} className="text-amber-700" />
              <p className="text-sm font-semibold text-amber-900">
                리마인더 발송 대기 {remindersDue.length}건
              </p>
            </div>
            <span className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800">
              3일 이내 예정/대기 일정
            </span>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-gray-500">표시 중 일정</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{filteredSchedules.length}</p>
          <p className="mt-1 text-[11px] text-gray-500">전체 {schedules.length}건 중</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-[11px] font-semibold text-blue-700">오늘 일정</p>
          <p className="mt-1 text-2xl font-bold text-blue-900">{todaySchedules.length}</p>
          <p className="mt-1 text-[11px] text-blue-700">오늘 기준 업무 큐</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-[11px] font-semibold text-red-700">지연 일정</p>
          <p className="mt-1 text-2xl font-bold text-red-900">{delayedSchedules.length}</p>
          <p className="mt-1 text-[11px] text-red-700">SLA 점검 필요</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-[11px] font-semibold text-orange-700">고위험 연계</p>
          <p className="mt-1 text-2xl font-bold text-orange-900">{highRiskSchedules.length}</p>
          <p className="mt-1 text-[11px] text-orange-700">우선순위 상향 대상</p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label className="text-xs text-gray-600">검색</Label>
            <div className="relative mt-1.5">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                className="pl-8"
                placeholder="케이스 ID, 대상자명, 일정명, 담당자"
              />
            </div>
          </div>

          <div className="w-[150px]">
            <Label className="text-xs text-gray-600">상태</Label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ScheduleStatus | "전체")}
              className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            >
              {(["전체", "예정", "대기", "지연", "완료", "취소"] as const).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[150px]">
            <Label className="text-xs text-gray-600">유형</Label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as ScheduleType | "전체")}
              className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            >
              {(["전체", "연락", "예약", "방문", "의뢰", "검사"] as const).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[150px]">
            <Label className="text-xs text-gray-600">담당자</Label>
            <select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="전체">전체</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" onClick={resetFilters} className="h-9">
            <Filter size={14} className="mr-1" />
            필터 초기화
          </Button>
        </div>
      </section>

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
            {viewMode === "month" ? (
              <>
                <div className="grid grid-cols-7 border-b border-gray-100 pb-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 pt-2">
                  {monthCells.map((day, index) => {
                    if (!day) {
                      return (
                        <div
                          key={`empty-${index}`}
                          className="min-h-[92px] rounded-lg border border-transparent bg-gray-50/40"
                        />
                      );
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
                          "min-h-[92px] rounded-lg border p-2 text-left transition-colors",
                          isSelected
                            ? "border-blue-300 bg-blue-50"
                            : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50",
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
                              <button
                                key={item.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDetailsDialog(item.id);
                                }}
                                className={cn(
                                  "flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-90",
                                  meta.chip,
                                  item.riskLevel === "high" ? "ring-1 ring-red-300" : ""
                                )}
                              >
                                <Icon size={9} />
                                <span className="truncate">{item.time} {item.patientName}</span>
                              </button>
                            );
                          })}
                          {dayItems.length > 3 ? <p className="text-[10px] text-gray-500">+{dayItems.length - 3}건</p> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-[11px] md:grid-cols-5">
                  {(["연락", "예약", "방문", "의뢰", "검사"] as ScheduleType[]).map((type) => {
                    const meta = typeMeta(type);
                    const Icon = meta.icon;
                    return (
                      <div
                        key={type}
                        className="inline-flex items-center gap-1 rounded border border-gray-100 bg-gray-50 px-2 py-1 text-gray-600"
                      >
                        <Icon size={11} />
                        {type}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-3 pt-2">
                {timelineDates.map((dayKey) => {
                  const dayItems = schedulesByDate.get(dayKey) ?? [];
                  const label = parseDateKey(dayKey).toLocaleDateString("ko-KR", {
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  });

                  return (
                    <section key={dayKey} className="rounded-lg border border-gray-200">
                      <header className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                        <button
                          onClick={() => setSelectedDate(dayKey)}
                          className={cn(
                            "text-sm font-semibold",
                            dayKey === selectedDate ? "text-blue-700" : "text-gray-800"
                          )}
                        >
                          {label}
                        </button>
                        <span className="text-[11px] text-gray-500">{dayItems.length}건</span>
                      </header>
                      <div className="space-y-2 p-2">
                        {dayItems.length === 0 ? (
                          <p className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                            등록된 일정이 없습니다.
                          </p>
                        ) : (
                          dayItems.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => openDetailsDialog(item.id)}
                              className="w-full rounded-md border border-gray-100 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-gray-900">{item.time} · {item.title}</p>
                                <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", statusTone(item.status))}>
                                  {item.status}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-gray-600">
                                {item.caseId} · {item.patientName} · 담당 {item.assignee}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4 xl:col-span-4 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-132px)] xl:overflow-y-auto xl:pr-1">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-800">{item.time} · {item.title}</p>
                      <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", priorityTone(item.priority))}>
                        {item.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">{item.caseId} · {item.patientName}</p>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-red-800">
              <AlertCircle size={14} />
              지연 일정
            </h3>
            <div className="mt-3 space-y-2">
              {delayedSchedules.length === 0 ? (
                <p className="rounded-md border border-red-100 bg-white px-3 py-2 text-xs text-red-700">
                  지연 일정이 없습니다.
                </p>
              ) : (
                delayedSchedules.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openDetailsDialog(item.id)}
                    className="w-full rounded-md border border-red-100 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-red-200 hover:bg-red-50"
                  >
                    <p className="font-semibold text-gray-900">{item.caseId} · {item.patientName}</p>
                    <p className="mt-0.5 text-red-700">{item.title}</p>
                    <p className="mt-1 text-[11px] text-gray-500">{item.date} {item.time}</p>
                  </button>
                ))
              )}
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
                selectedSchedules.map((item) => {
                  const risk = riskMeta(item.riskLevel);
                  return (
                    <button
                      key={item.id}
                      onClick={() => openDetailsDialog(item.id)}
                      className="w-full rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-left text-xs transition-colors hover:border-gray-200 hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">{item.time} · {item.type}</p>
                        <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", risk.tone)}>
                          {risk.label}
                        </span>
                      </div>
                      <p className="mt-1 text-gray-700">{item.title}</p>
                      <p className="mt-1 text-[11px] text-gray-500">{item.caseId} · 담당 {item.assignee}</p>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </aside>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "일정 생성" : "일정 수정"}</DialogTitle>
            <DialogDescription>
              v1 캘린더 엔진의 케이스 컨텍스트를 반영해 일정 정보를 상세하게 관리합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>일정명 *</Label>
                <Input
                  value={formState.title}
                  onChange={(event) => onFormChange("title", event.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>케이스 ID *</Label>
                <Input
                  value={formState.caseId}
                  onChange={(event) => onFormChange("caseId", event.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>대상자명 *</Label>
                <Input
                  value={formState.patientName}
                  onChange={(event) => onFormChange("patientName", event.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>연령</Label>
                <Input
                  type="number"
                  min={0}
                  value={formState.patientAge}
                  onChange={(event) => onFormChange("patientAge", event.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <Label>날짜 *</Label>
                <Input
                  type="date"
                  value={formState.date}
                  onChange={(event) => onFormChange("date", event.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>시간 *</Label>
                <Input
                  type="time"
                  value={formState.time}
                  onChange={(event) => onFormChange("time", event.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>소요(분)</Label>
                <Input
                  type="number"
                  min={10}
                  step={10}
                  value={formState.durationMinutes}
                  onChange={(event) => onFormChange("durationMinutes", event.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>담당자 *</Label>
                <Input
                  value={formState.assignee}
                  onChange={(event) => onFormChange("assignee", event.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <Label>일정 유형</Label>
                <select
                  value={formState.type}
                  onChange={(event) => onFormChange("type", event.target.value as ScheduleType)}
                  className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {(["연락", "예약", "방문", "의뢰", "검사"] as ScheduleType[]).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>상태</Label>
                <select
                  value={formState.status}
                  onChange={(event) => onFormChange("status", event.target.value as ScheduleStatus)}
                  className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {(["예정", "대기", "지연", "완료", "취소"] as ScheduleStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>우선순위</Label>
                <select
                  value={formState.priority}
                  onChange={(event) => onFormChange("priority", event.target.value as PriorityLevel)}
                  className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {(["긴급", "높음", "보통"] as PriorityLevel[]).map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>위험도</Label>
                <select
                  value={formState.riskLevel}
                  onChange={(event) => onFormChange("riskLevel", event.target.value as RiskLevel)}
                  className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="high">고위험</option>
                  <option value="medium">중위험</option>
                  <option value="low">저위험</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>예약 구분(v1 연동)</Label>
                <select
                  value={formState.reservationType}
                  onChange={(event) => onFormChange("reservationType", event.target.value as ReservationType | "")}
                  className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">선택 안함</option>
                  {(Object.keys(RESERVATION_TYPE_LABELS) as ReservationType[]).map((type) => (
                    <option key={type} value={type}>
                      {RESERVATION_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>위치</Label>
                <Input
                  value={formState.location}
                  onChange={(event) => onFormChange("location", event.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>연락처</Label>
                <Input
                  value={formState.phone}
                  onChange={(event) => onFormChange("phone", event.target.value)}
                  className="mt-1.5"
                  placeholder="010-1234-5678"
                />
              </div>
              <div>
                <Label>보호자 연락처</Label>
                <Input
                  value={formState.guardianPhone}
                  onChange={(event) => onFormChange("guardianPhone", event.target.value)}
                  className="mt-1.5"
                  placeholder="010-8765-4321"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label>접촉 상태(v1)</Label>
                <select
                  value={formState.contactStatus}
                  onChange={(event) => onFormChange("contactStatus", event.target.value as ContactStatus | "")}
                  className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">선택 안함</option>
                  {(Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {CONTACT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>상담 상태(v1)</Label>
                <select
                  value={formState.consultStatus}
                  onChange={(event) => onFormChange("consultStatus", event.target.value as ConsultStatus | "")}
                  className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">선택 안함</option>
                  {(Object.keys(CONSULT_STATUS_LABELS) as ConsultStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {CONSULT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>2차 검사(v1)</Label>
                <select
                  value={formState.secondExamStatus}
                  onChange={(event) => onFormChange("secondExamStatus", event.target.value as SecondExamStatus | "")}
                  className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">선택 안함</option>
                  {(Object.keys(SECOND_EXAM_LABELS) as SecondExamStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {SECOND_EXAM_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>리마인더 채널</Label>
                <select
                  value={formState.reminderChannel}
                  onChange={(event) => onFormChange("reminderChannel", event.target.value as ReminderChannel)}
                  className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {(["SMS", "전화", "앱"] as ReminderChannel[]).map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-6 pt-7">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formState.reminderSent}
                    onChange={(event) => onFormChange("reminderSent", event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  리마인더 전송 완료
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formState.followUpRequired}
                    onChange={(event) => onFormChange("followUpRequired", event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  후속조치 필요
                </label>
              </div>
            </div>

            <div>
              <Label>예약/업무 사유</Label>
              <Textarea
                value={formState.reasonText}
                onChange={(event) => onFormChange("reasonText", event.target.value)}
                className="mt-1.5"
                rows={2}
              />
            </div>
            <div>
              <Label>운영 메모</Label>
              <Textarea
                value={formState.notes}
                onChange={(event) => onFormChange("notes", event.target.value)}
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSubmitForm}>{formMode === "create" ? "등록" : "수정 저장"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>일정 상세</DialogTitle>
            <DialogDescription>일정 정보 확인 및 수정/삭제</DialogDescription>
          </DialogHeader>

          {selectedSchedule ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-bold text-gray-900">{selectedSchedule.title}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", statusTone(selectedSchedule.status))}>
                      {selectedSchedule.status}
                    </span>
                    <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", priorityTone(selectedSchedule.priority))}>
                      {selectedSchedule.priority}
                    </span>
                    <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold", riskMeta(selectedSchedule.riskLevel).tone)}>
                      {riskMeta(selectedSchedule.riskLevel).label}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-600">{selectedSchedule.caseId} · {selectedSchedule.patientName}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">일정 일시</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selectedSchedule.date} {selectedSchedule.time} ({selectedSchedule.durationMinutes}분)
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">일정 유형</p>
                  <p className="mt-1 font-semibold text-gray-900">{selectedSchedule.type}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">담당자</p>
                  <p className="mt-1 flex items-center gap-1 font-semibold text-gray-900">
                    <User size={13} className="text-gray-400" />
                    {selectedSchedule.assignee}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">리마인더</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selectedSchedule.reminderChannel} · {selectedSchedule.reminderSent ? "전송 완료" : "미전송"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">연락처</p>
                  <p className="mt-1 font-semibold text-gray-900">{selectedSchedule.phone ? maskPhone(selectedSchedule.phone) : "-"}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">보호자 연락처</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selectedSchedule.guardianPhone ? maskPhone(selectedSchedule.guardianPhone) : "-"}
                  </p>
                </div>
              </div>

              {selectedSchedule.location ? (
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">위치</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{selectedSchedule.location}</p>
                </div>
              ) : null}

              {(selectedSchedule.contactStatus || selectedSchedule.consultStatus || selectedSchedule.secondExamStatus) && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <ShieldAlert size={13} />
                    케이스 진행 상태(v1 엔진)
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-700">
                    {selectedSchedule.contactStatus ? (
                      <span>접촉: <strong>{CONTACT_STATUS_LABELS[selectedSchedule.contactStatus]}</strong></span>
                    ) : null}
                    {selectedSchedule.consultStatus ? (
                      <span>상담: <strong>{CONSULT_STATUS_LABELS[selectedSchedule.consultStatus]}</strong></span>
                    ) : null}
                    {selectedSchedule.secondExamStatus ? (
                      <span>2차검사: <strong>{SECOND_EXAM_LABELS[selectedSchedule.secondExamStatus]}</strong></span>
                    ) : null}
                    {selectedSchedule.reservationType ? (
                      <span>예약유형: <strong>{RESERVATION_TYPE_LABELS[selectedSchedule.reservationType]}</strong></span>
                    ) : null}
                  </div>
                </div>
              )}

              {selectedSchedule.reasonText ? (
                <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
                  <p className="text-xs font-semibold text-purple-700">예약/업무 사유</p>
                  <p className="mt-1 text-sm text-purple-900">{selectedSchedule.reasonText}</p>
                </div>
              ) : null}

              {selectedSchedule.autoMemoRecent && selectedSchedule.autoMemoRecent.length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-gray-700">
                    <MessageSquare size={13} />
                    최근 운영 메모
                  </p>
                  <ul className="space-y-1">
                    {selectedSchedule.autoMemoRecent.map((memo, index) => (
                      <li key={`${memo}-${index}`} className="text-xs text-gray-700">
                        • {memo}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {selectedSchedule.notes ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-700">메모</p>
                  <p className="mt-1 text-sm text-blue-900">{selectedSchedule.notes}</p>
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                <span className="text-xs text-gray-600">
                  {selectedSchedule.followUpRequired ? "후속조치 필요 일정입니다." : "후속조치 플래그가 해제된 일정입니다."}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 size={13} />
                  운영 추적 가능
                </span>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                  닫기
                </Button>
                <Button variant="outline" onClick={openEditDialog}>
                  <Edit3 size={14} className="mr-1" />
                  수정
                </Button>
                <Button variant="destructive" onClick={handleDeleteSchedule}>
                  <Trash2 size={14} className="mr-1" />
                  삭제
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
