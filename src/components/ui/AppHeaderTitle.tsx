import React from 'react';
import { Home } from 'lucide-react';

/* ── 라우트별 매핑 상수 ─────────────────────────────── */
export const HEADER_TITLE_MAP = {
  /* 중앙센터 */
  'national-dashboard': { title: '중앙 운영 대시보드', subtitle: 'Neuro-Shield 중앙관리 시스템' },
  'model-apply':        { title: '모델 적용 센터',   subtitle: 'Neuro-Shield 중앙관리 시스템' },
  'model-governance':   { title: '모델/규칙 변경 관리', subtitle: 'Neuro-Shield 중앙관리 시스템' },
  'quality-monitoring': { title: '데이터&모델 품질', subtitle: 'Neuro-Shield 중앙관리 시스템' },
  'compliance-audit':   { title: '규정 준수 및 감사', subtitle: 'Neuro-Shield 중앙관리 시스템' },
  'kpi-dictionary':     { title: 'KPI 사전',        subtitle: 'Neuro-Shield 중앙관리 시스템' },
  'settings':           { title: '설정',            subtitle: 'Neuro-Shield 중앙관리 시스템' },

  /* 광역센터 */
  'overview':       { title: '광역 운영 대시보드', subtitle: 'Neuro-Shield 광역센터 운영 시스템' },
  'cause':          { title: '병목·원인 분석',    subtitle: 'Neuro-Shield 광역센터 운영 시스템' },
  'interventions':  { title: '개입·조치 관리',    subtitle: 'Neuro-Shield 광역센터 운영 시스템' },
  'reports':        { title: '보고서',            subtitle: 'Neuro-Shield 광역센터 운영 시스템' },
  'regional-settings': { title: '설정',           subtitle: 'Neuro-Shield 광역센터 운영 시스템' },

  /* 기초센터 (v1) */
  'dashboard': { title: '케이스 관리',   subtitle: 'Neuro-Shield 치매안심센터 케이스 시스템' },
  'calendar':  { title: '일정 캘린더',   subtitle: 'Neuro-Shield 치매안심센터 케이스 시스템' },
  'audit-log': { title: '감사 로그',     subtitle: 'Neuro-Shield 치매안심센터 케이스 시스템' },

  /* 기초센터 (v2) */
  'main':  { title: '센터 운영 대시보드',   subtitle: 'Neuro-Shield 치매안심센터 운영 시스템' },
  'cases': { title: '케이스 대시보드', subtitle: 'Neuro-Shield 치매안심센터 운영 시스템' },
} as const;

/* ── Props ──────────────────────────────────────────── */
export interface AppHeaderTitleProps {
  /** 현재 페이지 타이틀 (굵게) */
  title: string;
  /** 서비스 서브타이틀 (작게, 회색) */
  subtitle: string;
  /** 좌측 아이콘 — ReactNode 또는 lucide 컴포넌트 */
  icon?: React.ReactNode;
  /** 아이콘 배경 색상 클래스 (기본: from-blue-600 to-blue-700) */
  iconBg?: string;
}

/**
 * 공용 헤더 좌상단 타이틀
 * ┌──────┬──────────────────────┐
 * │ ICON │ **title**            │
 * │      │ subtitle (small)     │
 * └──────┴──────────────────────┘
 */
export function AppHeaderTitle({
  title,
  subtitle,
  icon,
  iconBg = 'from-blue-600 to-blue-700',
}: AppHeaderTitleProps) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {/* 아이콘 박스 */}
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br ${iconBg} shadow-sm shrink-0`}
        aria-hidden="true"
      >
        {icon ?? <Home className="h-4 w-4 text-white" />}
      </div>

      {/* 2줄 텍스트 */}
      <div className="min-w-0">
        <h2
          className="text-[15px] font-bold text-slate-800 leading-[1.1] whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {title}
        </h2>
        <p
          className="text-[10px] font-medium text-slate-400 leading-[1.1] mt-[2px] whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
