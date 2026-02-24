/* ═══════════════════════════════════════════════════════════════════
   caseData.ts — 기초센터 공유 타입 + 더미 데이터 생성
   - Case 확장 타입 (2차 검사, 접촉/상담 상태, 예약, 운영메모, SMS이력)
   - 50건 더미 케이스 (현실적 분포)
   - Calendar Appointment 확장 타입
═══════════════════════════════════════════════════════════════════ */

// ─── 기본 Enum/Union 타입 ───
export type RiskLevel = 'high' | 'medium' | 'low';
export type CaseStatus = 'not_contacted' | 'contacted' | 'consultation_complete' | 'appointment_scheduled';
export type TaskPriority = 'urgent' | 'today' | 'normal';

// ─── 신규 확장 타입 ───
export type SecondExamStatus = 'NONE' | 'SCHEDULED' | 'DONE' | 'RESULT_CONFIRMED';
export type SecondExamType = 'MRI' | 'PET' | 'BLOOD' | 'ETC';
export type ContactStatus = 'UNREACHED' | 'REACHED';
export type ConsultStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
export type ReservationType = 'CENTER_SCREEN' | 'PUBLIC_HEALTH' | 'HOSPITAL_REFERRAL';

export interface Reservation {
  type: ReservationType;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  reasonText: string;
  locationText: string;
}

export interface AutoMemo {
  lastUpdatedAt: string;
  lines: string[];
}

export interface SmsHistoryEntry {
  sentAt: string;
  templateId: string;
  previewText: string;
  to: string; // masked
  result: 'SUCCESS' | 'FAIL';
}

// ─── 통합 Case 인터페이스 ───
export interface Case {
  id: string;
  patientName: string;
  age: number;
  gender: string;
  riskLevel: RiskLevel;
  lastContact: string | null;
  status: CaseStatus;
  counselor: string;
  isFavorite: boolean;
  phone: string;
  registeredDate: string;

  riskScore: number;

  // 확장 필드
  secondExamStatus: SecondExamStatus;
  secondExamType?: SecondExamType;
  contactStatus: ContactStatus;
  consultStatus: ConsultStatus;
  reservation: Reservation | null;
  autoMemo: AutoMemo;
  smsHistory: SmsHistoryEntry[];

  // 보호자 연락처 (시민 예약 시 입력, 선택 사항)
  guardianPhone?: string;
}

// ─── 확장 Appointment ───
export type AppointmentStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'reminder_sent';

export interface Appointment {
  id: string;
  caseId: string;
  patientName: string;
  patientAge: number;
  date: string;
  time: string;
  type: string;
  reservationType?: ReservationType;
  reasonText?: string;
  status: AppointmentStatus;
  riskLevel: RiskLevel;
  counselor: string;
  phone: string;
  reminderSent?: boolean;
  notes?: string;
  // 확장: 연결된 케이스 요약
  caseContactStatus?: ContactStatus;
  caseConsultStatus?: ConsultStatus;
  caseSecondExamStatus?: SecondExamStatus;
  autoMemoRecent?: string[];
}

// ─── Task ───
export interface Task {
  id: string;
  caseId: string;
  patientName: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  type: string;
}

// ═══ 더미 데이터 생성 유틸 ═══
function seeded(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

function pick<T>(arr: T[], seed: string): T {
  return arr[Math.floor(seeded(seed) * arr.length)];
}

function dateStr(baseYear: number, baseMonth: number, dayOffset: number): string {
  const d = new Date(baseYear, baseMonth - 1, 1 + dayOffset);
  return d.toISOString().split('T')[0];
}

// ─── 이름/상담사 풀 ───
const NAMES = [
  '김종팔', '박덕기', '이옥자', '최종덕', '한만복', '윤갑순', '문칠성', '강복녀',
  '조두만', '안삼순', '양봉식', '차옥분', '고복동', '노영팔', '류덕순', '배만수',
  '신갑순', '전영자', '황칠복', '우순덕', '남복남', '임춘덕', '하금자', '오달수',
  '서복자', '정만덕', '권칠순', '송영복', '백두팔', '유덕남', '주분이', '장복례',
  '추종식', '도옥례', '피만복', '성길동', '맹덕자', '탁복순', '빈종남', '감만녀',
  '봉칠남', '채영덕', '설갑자', '복현자', '사만수', '금순덕', '국종복', '좌옥남',
  '석복순', '어진덕',
];
const COUNSELORS = ['김순자', '최덕기', '박종덕', '이옥자'];
const EXAM_TYPES: SecondExamType[] = ['MRI', 'PET', 'BLOOD', 'ETC'];
const RESERVATION_TYPES: ReservationType[] = ['CENTER_SCREEN', 'PUBLIC_HEALTH', 'HOSPITAL_REFERRAL'];
const RESERVATION_REASONS = [
  '인지기능 저하 의심, 정밀검사 필요',
  '가족 요청에 의한 추가 검사',
  '1차 선별검사 경계 수준, 재검 필요',
  'MMSE 점수 하락 추세',
  '일상생활 수행능력 저하 관찰',
  '우울 증상 동반, 종합평가 필요',
  '치매 가족력 존재, 조기 선별',
  '약물 반응 평가를 위한 재검',
];
const LOCATIONS = [
  '강남구 치매안심센터', '서초구 보건소', '삼성서울병원 신경과', '분당서울대병원',
  '강남세브란스 노인의학', '서울아산병원 뇌과학', '중앙대학교병원', '건국대병원',
];

function generateAutoMemoLines(c: {
  contactStatus: ContactStatus;
  consultStatus: ConsultStatus;
  secondExamStatus: SecondExamStatus;
  secondExamType?: SecondExamType;
  reservation: Reservation | null;
  smsHistory: SmsHistoryEntry[];
}, seed: string): string[] {
  const lines: string[] = [];
  const base = dateStr(2026, 1, Math.floor(seeded(`${seed}-reg`) * 20) + 5);

  lines.push(`케이스 등록: ${base}`);

  if (c.smsHistory.length > 0) {
    c.smsHistory.forEach((s, i) => {
      lines.push(`문자 발송(${s.templateId}): ${s.sentAt} → ${s.result === 'SUCCESS' ? '성공' : '실패'}`);
    });
  }

  if (c.contactStatus === 'REACHED') {
    const contactDate = dateStr(2026, 1, Math.floor(seeded(`${seed}-cont`) * 25) + 10);
    lines.push(`접촉 완료: ${contactDate} ${String(9 + Math.floor(seeded(`${seed}-ch`) * 8)).padStart(2, '0')}:${String(Math.floor(seeded(`${seed}-cm`) * 60)).padStart(2, '0')}`);
  }

  if (c.consultStatus === 'IN_PROGRESS') {
    lines.push(`상담 진행중: ${dateStr(2026, 1, Math.floor(seeded(`${seed}-cip`) * 25) + 15)} (1차)`);
  } else if (c.consultStatus === 'DONE') {
    lines.push(`상담 완료: ${dateStr(2026, 1, Math.floor(seeded(`${seed}-cd`) * 20) + 18)} (1차)`);
  }

  if (c.reservation) {
    const typeLabel = c.reservation.type === 'CENTER_SCREEN' ? '센터 선별검사' : c.reservation.type === 'PUBLIC_HEALTH' ? '보건소 안내' : '의료기관 의뢰';
    lines.push(`예약 확정: ${c.reservation.date} ${c.reservation.time} ${typeLabel} / 사유: ${c.reservation.reasonText.slice(0, 20)}…`);
  }

  if (c.secondExamStatus === 'SCHEDULED') {
    lines.push(`2차 검사 예약: ${dateStr(2026, 2, Math.floor(seeded(`${seed}-se`) * 20) + 5)} (${c.secondExamType || 'MRI'})`);
  } else if (c.secondExamStatus === 'DONE') {
    lines.push(`2차 검사 완료: ${dateStr(2026, 2, Math.floor(seeded(`${seed}-sed`) * 15) + 1)}`);
  } else if (c.secondExamStatus === 'RESULT_CONFIRMED') {
    lines.push(`2차 검사 완료: ${dateStr(2026, 1, Math.floor(seeded(`${seed}-sedc`) * 15) + 20)}`);
    lines.push(`2차 검사 결과 확인 완료: ${dateStr(2026, 2, Math.floor(seeded(`${seed}-serc`) * 10) + 1)}`);
  }

  // 일부 케이스에 이탈 위험 메모 추가
  if (seeded(`${seed}-churn`) < 0.12) {
    lines.push(`⚠ 연속 미응답(3회): 이탈 위험 모니터링 필요`);
    lines.push(`⚠ 예약 노쇼 1회: ${dateStr(2026, 1, Math.floor(seeded(`${seed}-ns`) * 20) + 10)}`);
  }

  return lines;
}

// ═══ 50건 케이스 생성 ═══
export function generateCases(): Case[] {
  return NAMES.map((name, idx) => {
    const id = `CASE-2026-${String(idx + 1).padStart(3, '0')}`;
    const s = `${id}-seed`;
    const sv = seeded(s);

    // 위험도 분포: high 25%, medium 45%, low 30%
    const riskLevel: RiskLevel = sv < 0.25 ? 'high' : sv < 0.70 ? 'medium' : 'low';

    // 접촉 상태: UNREACHED 28%
    const contactStatus: ContactStatus = seeded(`${s}-cs`) < 0.28 ? 'UNREACHED' : 'REACHED';

    // 상담 상태: 미접촉이면 NOT_STARTED, 접촉이면 분포
    let consultStatus: ConsultStatus = 'NOT_STARTED';
    if (contactStatus === 'REACHED') {
      const csv = seeded(`${s}-cons`);
      consultStatus = csv < 0.15 ? 'NOT_STARTED' : csv < 0.45 ? 'IN_PROGRESS' : 'DONE';
    }

    // CaseStatus 매핑
    let status: CaseStatus = 'not_contacted';
    if (contactStatus === 'REACHED') {
      if (consultStatus === 'DONE') {
        status = seeded(`${s}-apt`) < 0.55 ? 'appointment_scheduled' : 'consultation_complete';
      } else {
        status = 'contacted';
      }
    }

    // 2차 검사: NONE 65%, SCHEDULED 15%, DONE 12%, RESULT_CONFIRMED 8%
    let secondExamStatus: SecondExamStatus = 'NONE';
    const sev = seeded(`${s}-se`);
    if (consultStatus === 'DONE') {
      secondExamStatus = sev < 0.35 ? 'NONE' : sev < 0.60 ? 'SCHEDULED' : sev < 0.82 ? 'DONE' : 'RESULT_CONFIRMED';
    } else if (consultStatus === 'IN_PROGRESS' && sev > 0.85) {
      secondExamStatus = 'SCHEDULED';
    }
    const secondExamType = secondExamStatus !== 'NONE' ? pick(EXAM_TYPES, `${s}-set`) : undefined;

    // 예약: 전체의 35% 정도
    let reservation: Reservation | null = null;
    if (seeded(`${s}-res`) < 0.35 && contactStatus === 'REACHED') {
      reservation = {
        type: pick(RESERVATION_TYPES, `${s}-rt`),
        date: dateStr(2026, 2, Math.floor(seeded(`${s}-rd`) * 25) + 3),
        time: `${String(9 + Math.floor(seeded(`${s}-rh`) * 8)).padStart(2, '0')}:${seeded(`${s}-rm`) < 0.5 ? '00' : '30'}`,
        reasonText: pick(RESERVATION_REASONS, `${s}-rr`),
        locationText: pick(LOCATIONS, `${s}-rl`),
      };
    }

    // SMS 히스토리
    const smsHistory: SmsHistoryEntry[] = [];
    const smsCount = Math.floor(seeded(`${s}-sms`) * 4);
    for (let i = 0; i < smsCount; i++) {
      const templates = ['접촉 요청', '예약 안내', '센터 방문 유도', '검사 결과 안내'];
      const tpl = pick(templates, `${s}-sms-${i}`);
      smsHistory.push({
        sentAt: `${dateStr(2026, 1, Math.floor(seeded(`${s}-smsd-${i}`) * 30) + 1)} ${String(9 + Math.floor(seeded(`${s}-smsh-${i}`) * 9)).padStart(2, '0')}:${String(Math.floor(seeded(`${s}-smsm-${i}`) * 60)).padStart(2, '0')}`,
        templateId: tpl,
        previewText: `[치매안심센터] ${tpl} 안내 메시지입니다.`,
        to: `010-****-${String(1000 + idx * 100 + i).slice(-4)}`,
        result: seeded(`${s}-smsr-${i}`) < 0.85 ? 'SUCCESS' : 'FAIL',
      });
    }

    const age = 60 + Math.floor(seeded(`${s}-age`) * 25);
    const gender = seeded(`${s}-gen`) < 0.55 ? '여성' : '남성';
    const lastContact = contactStatus === 'REACHED'
      ? dateStr(2026, 1, Math.floor(seeded(`${s}-lc`) * 30) + 1)
      : null;

    const autoMemoData = { contactStatus, consultStatus, secondExamStatus, secondExamType, reservation, smsHistory };
    const memoLines = generateAutoMemoLines(autoMemoData, s);

    return {
      id,
      patientName: name,
      age,
      gender,
      riskLevel,
      riskScore: riskLevel === 'high' ? 65 + Math.floor(seeded(`${s}-rs`) * 30) : riskLevel === 'medium' ? 35 + Math.floor(seeded(`${s}-rs`) * 30) : 5 + Math.floor(seeded(`${s}-rs`) * 30),
      lastContact,
      status,
      counselor: pick(COUNSELORS, `${s}-coun`),
      isFavorite: seeded(`${s}-fav`) < 0.15,
      phone: `010-${String(1000 + Math.floor(seeded(`${s}-p1`) * 9000)).padStart(4, '0')}-${String(1000 + Math.floor(seeded(`${s}-p2`) * 9000)).padStart(4, '0')}`,
      registeredDate: dateStr(2026, 1, Math.floor(seeded(`${s}-reg`) * 20) + 1),
      secondExamStatus,
      secondExamType,
      contactStatus,
      consultStatus,
      reservation,
      autoMemo: {
        lastUpdatedAt: memoLines.length > 0
          ? dateStr(2026, 2, Math.floor(seeded(`${s}-mu`) * 5) + 1)
          : dateStr(2026, 1, 15),
        lines: memoLines,
      },
      smsHistory,
      // 약 30% 케이스에 보호자 연락처 존재 (시민 예약 시 입력)
      guardianPhone: seeded(`${s}-gp`) < 0.30
        ? `010-${String(2000 + Math.floor(seeded(`${s}-gp1`) * 8000)).padStart(4, '0')}-${String(1000 + Math.floor(seeded(`${s}-gp2`) * 9000)).padStart(4, '0')}`
        : undefined,
    };
  });
}

// ═══ 캘린더 예약 생성 (케이스 기반) ═══
export function generateAppointments(cases: Case[]): Appointment[] {
  const apts: Appointment[] = [];
  let aptIdx = 0;

  cases.forEach(c => {
    if (!c.reservation) return;
    aptIdx++;
    const typeLabel = c.reservation.type === 'CENTER_SCREEN' ? '센터 선별검사'
      : c.reservation.type === 'PUBLIC_HEALTH' ? '보건소 안내' : '의료기관 의뢰';

    apts.push({
      id: `APT-${String(aptIdx).padStart(3, '0')}`,
      caseId: c.id,
      patientName: c.patientName,
      patientAge: c.age,
      date: c.reservation.date,
      time: c.reservation.time,
      type: typeLabel,
      reservationType: c.reservation.type,
      reasonText: c.reservation.reasonText,
      status: seeded(`${c.id}-aptst`) < 0.3 ? 'confirmed'
        : seeded(`${c.id}-aptst`) < 0.55 ? 'reminder_sent'
        : seeded(`${c.id}-aptst`) < 0.75 ? 'pending'
        : 'completed',
      riskLevel: c.riskLevel,
      counselor: c.counselor,
      phone: c.phone,
      reminderSent: seeded(`${c.id}-rem`) < 0.6,
      notes: c.reservation.reasonText,
      caseContactStatus: c.contactStatus,
      caseConsultStatus: c.consultStatus,
      caseSecondExamStatus: c.secondExamStatus,
      autoMemoRecent: c.autoMemo.lines.slice(-3),
    });
  });

  // 2차 검사 예약도 추가
  cases.forEach(c => {
    if (c.secondExamStatus !== 'SCHEDULED') return;
    aptIdx++;
    apts.push({
      id: `APT-${String(aptIdx).padStart(3, '0')}`,
      caseId: c.id,
      patientName: c.patientName,
      patientAge: c.age,
      date: dateStr(2026, 2, Math.floor(seeded(`${c.id}-se-apt`) * 20) + 5),
      time: `${String(9 + Math.floor(seeded(`${c.id}-se-h`) * 8)).padStart(2, '0')}:00`,
      type: `2차 검사 (${c.secondExamType || 'MRI'})`,
      status: 'confirmed',
      riskLevel: c.riskLevel,
      counselor: c.counselor,
      phone: c.phone,
      reminderSent: false,
      notes: `2차 검사 (${c.secondExamType}) 예약`,
      caseContactStatus: c.contactStatus,
      caseConsultStatus: c.consultStatus,
      caseSecondExamStatus: c.secondExamStatus,
      autoMemoRecent: c.autoMemo.lines.slice(-3),
    });
  });

  return apts;
}

// ═══ 태스크 생성 (케이스 기반) ═══
export function generateTasks(cases: Case[]): Task[] {
  const tasks: Task[] = [];
  let taskIdx = 0;

  cases.forEach(c => {
    // 미접촉 고위험 → 긴급
    if (c.contactStatus === 'UNREACHED' && c.riskLevel === 'high') {
      taskIdx++;
      tasks.push({
        id: `TASK-${String(taskIdx).padStart(3, '0')}`,
        caseId: c.id,
        patientName: c.patientName,
        title: '긴급 초기 접촉 필요',
        description: '고위험군 미접촉 케이스, 즉시 연락 시도 필요',
        priority: 'urgent',
        dueDate: dateStr(2026, 2, 6),
        type: '초기 접촉',
      });
    }
    // 미접촉 보통 → 오늘
    else if (c.contactStatus === 'UNREACHED') {
      taskIdx++;
      tasks.push({
        id: `TASK-${String(taskIdx).padStart(3, '0')}`,
        caseId: c.id,
        patientName: c.patientName,
        title: '초기 접촉 시도',
        description: '미접촉 케이스, 전화 상담 시도',
        priority: 'today',
        dueDate: dateStr(2026, 2, 6),
        type: '초기 접촉',
      });
    }
    // 예약 있는데 2차 미진행 → 일반
    else if (c.reservation && c.secondExamStatus === 'NONE' && c.consultStatus === 'DONE') {
      taskIdx++;
      tasks.push({
        id: `TASK-${String(taskIdx).padStart(3, '0')}`,
        caseId: c.id,
        patientName: c.patientName,
        title: '2차 검사 일정 조율',
        description: '상담 완료 후 2차 검사 일정 확인 필요',
        priority: 'normal',
        dueDate: dateStr(2026, 2, 8),
        type: '후속 조치',
      });
    }
    // 예약 확인
    else if (c.reservation && seeded(`${c.id}-taskres`) < 0.4) {
      taskIdx++;
      tasks.push({
        id: `TASK-${String(taskIdx).padStart(3, '0')}`,
        caseId: c.id,
        patientName: c.patientName,
        title: '예약 확인 전화',
        description: `${c.reservation.date} 예약 확인 필요`,
        priority: seeded(`${c.id}-taskp`) < 0.3 ? 'today' : 'normal',
        dueDate: dateStr(2026, 2, 6),
        type: '예약 확인',
      });
    }
  });

  return tasks.slice(0, 20); // 최대 20개
}

// ═══ 라벨/포맷 헬퍼 ═══
export const SECOND_EXAM_LABELS: Record<SecondExamStatus, string> = {
  NONE: '미진행',
  SCHEDULED: '예약완료',
  DONE: '검사완료',
  RESULT_CONFIRMED: '결과확인완료',
};

export const SECOND_EXAM_COLORS: Record<SecondExamStatus, string> = {
  NONE: 'bg-gray-100 text-gray-600',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  DONE: 'bg-emerald-100 text-emerald-700',
  RESULT_CONFIRMED: 'bg-purple-100 text-purple-700',
};

export const EXAM_TYPE_LABELS: Record<SecondExamType, string> = {
  MRI: 'MRI',
  PET: 'PET',
  BLOOD: '혈액',
  ETC: '기타',
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  UNREACHED: '미접촉',
  REACHED: '접촉완료',
};

export const CONSULT_STATUS_LABELS: Record<ConsultStatus, string> = {
  NOT_STARTED: '미시작',
  IN_PROGRESS: '진행중',
  DONE: '완료',
};

export const RESERVATION_TYPE_LABELS: Record<ReservationType, string> = {
  CENTER_SCREEN: '센터 선별검사',
  PUBLIC_HEALTH: '보건소 안내',
  HOSPITAL_REFERRAL: '의료기관 의뢰',
};

export function getAgeRangeLabel(age: number): string {
  if (age >= 80) return '80세 이상';
  if (age >= 75) return '75~79세';
  if (age >= 70) return '70~74세';
  if (age >= 65) return '65~69세';
  if (age >= 60) return '60~64세';
  return '60세 미만';
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})-(\d{4})-(\d{4})/, '$1-****-$3');
}
