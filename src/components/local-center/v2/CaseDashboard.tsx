import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Search,
  Filter,
  Download,
  Users,
  Phone,
  Calendar,
  MessageSquare,
  ExternalLink,
  AlertCircle,
  Clock,
  UserCheck,
  History,
  ArrowUpDown,
} from "lucide-react";
import { cn, type StageType } from "./shared";
import {
  ALERT_FILTER_TABS,
  CASE_RECORDS,
  maskName,
  maskPhone,
  matchesAlertFilter,
  resolveInitialCaseFilter,
  toAgeBand,
  type CaseAlertFilter,
  type CaseRecord,
  type StageFilter,
} from "./caseRecords";

const STAGE_FILTER_OPTIONS: { label: string; value: StageFilter }[] = [
  { label: "전체 Stage", value: "all" },
  { label: "Stage 1", value: "Stage 1" },
  { label: "Stage 2", value: "Stage 2" },
  { label: "Stage 3", value: "Stage 3" },
];

function stageBadgeTone(stage: StageType) {
  if (stage === "Stage 1") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (stage === "Stage 2") return "bg-blue-50 text-blue-700 border-blue-100";
  return "bg-purple-50 text-purple-700 border-purple-100";
}

function statusBadgeTone(status: CaseRecord["status"]) {
  if (status === "임박") return "bg-red-50 text-red-600";
  if (status === "지연") return "bg-orange-50 text-orange-600";
  if (status === "완료") return "bg-gray-100 text-gray-500";
  return "bg-blue-50 text-blue-600";
}

function qualityBadgeTone(quality: CaseRecord["quality"]) {
  if (quality === "양호") return "bg-emerald-50 text-emerald-600 border-emerald-100";
  if (quality === "주의") return "bg-orange-50 text-orange-500 border-orange-100";
  return "bg-red-50 text-red-500 border-red-100";
}

function riskDotTone(risk: CaseRecord["risk"]) {
  if (risk === "고") return "bg-red-500";
  if (risk === "중") return "bg-orange-500";
  return "bg-emerald-500";
}

export function CaseDashboard({ onSelectCase, initialFilter }: {
  onSelectCase: (id: string, stage: StageType) => void,
  initialFilter: string | null,
}) {
  const [hoveredCase, setHoveredCase] = useState<CaseRecord | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<CaseAlertFilter>("전체");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortDescending, setSortDescending] = useState(true);

  useEffect(() => {
    const resolved = resolveInitialCaseFilter(initialFilter);
    setActiveFilterTab(resolved.alertFilter);
    setStageFilter(resolved.stageFilter);
  }, [initialFilter]);

  const filteredCases = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return CASE_RECORDS
      .filter((item) => (stageFilter === "all" ? true : item.stage === stageFilter))
      .filter((item) => matchesAlertFilter(item, activeFilterTab))
      .filter((item) => {
        if (!q) return true;
        const searchBlob = [
          item.id,
          item.profile.name,
          item.profile.phone,
          item.profile.guardianPhone ?? "",
          item.manager,
          item.path,
          item.action,
          item.stage,
        ]
          .join(" ")
          .toLowerCase();
        return searchBlob.includes(q);
      })
      .sort((a, b) =>
        sortDescending ? b.updated.localeCompare(a.updated) : a.updated.localeCompare(b.updated)
      );
  }, [activeFilterTab, searchKeyword, sortDescending, stageFilter]);

  const summary = useMemo(() => {
    const target = filteredCases;
    return [
      { label: "총 케이스 수", value: target.length.toLocaleString(), color: "text-gray-900", icon: Users },
      {
        label: "진행중",
        value: target.filter((c) => c.status === "진행중").length.toLocaleString(),
        color: "text-blue-600",
        icon: Clock,
      },
      {
        label: "SLA 임박/위반",
        value: target.filter((c) => c.status === "임박" || c.status === "지연").length.toLocaleString(),
        color: "text-red-600",
        icon: AlertCircle,
      },
      {
        label: "재평가 필요",
        value: target.filter((c) => c.alertTags.includes("재평가 필요")).length.toLocaleString(),
        color: "text-orange-600",
        icon: Calendar,
      },
      {
        label: "데이터 품질 경고",
        value: target.filter((c) => c.quality === "경고").length.toLocaleString(),
        color: "text-amber-600",
        icon: AlertCircle,
      },
    ];
  }, [filteredCases]);

  const hasActiveFilter = activeFilterTab !== "전체" || stageFilter !== "all" || searchKeyword.trim().length > 0;

  const resetFilters = () => {
    setActiveFilterTab("전체");
    setStageFilter("all");
    setSearchKeyword("");
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* 1) 상단 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {summary.map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</p>
              <p className={cn("text-xl font-bold mt-1", item.color)}>{item.value}</p>
            </div>
            <div className={cn("p-2 rounded-lg bg-gray-50", item.color.replace("text-", "text-"))}>
              <item.icon size={20} className="opacity-20" />
            </div>
          </div>
        ))}
      </div>

<div className="flex-1 flex flex-col min-h-0">
        {/* 2) 케이스 리스트 테이블 (전체 너비) */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                {ALERT_FILTER_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveFilterTab(tab)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all",
                      activeFilterTab === tab ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 mr-1">
                  <span className="text-[10px] font-bold text-gray-400">데이터 정렬: </span>
                  <button
                    onClick={() => setSortDescending((prev) => !prev)}
                    className="flex items-center gap-1 text-[10px] font-bold text-gray-600 bg-white px-2 py-1 border border-gray-200 rounded"
                  >
                    최근 업데이트 <ArrowUpDown size={10} />
                  </button>
                </div>
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200" title="내보내기">
                  <Download size={16} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-white border border-gray-200 rounded px-2 py-1">
                <Filter size={10} /> Stage
              </span>
              {STAGE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStageFilter(option.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors",
                    stageFilter === option.value
                      ? "border-[#163b6f] bg-[#163b6f] text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {option.label}
                </button>
              ))}
              <div className="ml-auto flex w-full md:w-[280px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
                <Search size={14} className="text-gray-400" />
                <input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="케이스ID/이름/전화번호 검색"
                  className="w-full bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400"
                />
              </div>
              {hasActiveFilter && (
                <button
                  onClick={resetFilters}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  필터 초기화
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto relative">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-20 shadow-sm">
                <tr className="bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 border-b border-gray-100">케이스 키</th>
                  <th className="px-4 py-3 border-b border-gray-100">개인정보</th>
                  <th className="px-4 py-3 border-b border-gray-100">Stage</th>
                  <th className="px-4 py-3 border-b border-gray-100">위험 신호 / 관리 경로</th>
                  <th className="px-4 py-3 border-b border-gray-100">상태</th>
                  <th className="px-4 py-3 border-b border-gray-100">담당자</th>
                  <th className="px-4 py-3 border-b border-gray-100">데이터 품질</th>
                  <th className="px-4 py-3 border-b border-gray-100 w-[100px]">퀵 액션</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredCases.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-xs text-gray-400">
                      조건에 맞는 케이스가 없습니다. 필터를 조정해 주세요.
                    </td>
                  </tr>
                )}
                {filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    data-case-id={c.id}
                    className={cn(
                      "cursor-pointer transition-colors group border-b border-gray-50 last:border-0 relative",
                      hoveredCase?.id === c.id ? "bg-blue-50/60" : "hover:bg-gray-50/70"
                    )}
                    onClick={() => onSelectCase(c.id, c.stage)}
                    onMouseEnter={() => {
                      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                      hoverTimerRef.current = setTimeout(() => setHoveredCase(c), 120);
                    }}
                    onMouseLeave={() => {
                      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                      /* popover 안에서 마우스가 나갈 때 약간의 딜레이 */
                      hoverTimerRef.current = setTimeout(() => setHoveredCase(null), 200);
                    }}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-mono font-medium text-gray-900 group-hover:text-blue-600">{c.id}</span>
                        <span className="text-[10px] text-gray-400">{c.updated}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.stage === "Stage 1" ? (
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-gray-700">연령대 {toAgeBand(c.profile.age)}</p>
                          <p className="text-[11px] text-gray-500">본인 {maskPhone(c.profile.phone)}</p>
                          {c.profile.guardianPhone && (
                            <p className="text-[11px] text-gray-500">보호자 {maskPhone(c.profile.guardianPhone)}</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-gray-700">
                            {maskName(c.profile.name)} · {c.profile.age}세
                          </p>
                          <p className="text-[11px] text-gray-500">연락처 {maskPhone(c.profile.phone)}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", stageBadgeTone(c.stage))}>
                        {c.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", riskDotTone(c.risk))}></div>
                        <span className="font-medium text-gray-700">{c.path}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", statusBadgeTone(c.status))}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{c.manager}</td>
                    <td className="px-4 py-3.5">
                      <span className={cn("text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-full border", qualityBadgeTone(c.quality))}>
                        {c.quality === "양호" ? <UserCheck size={10} /> : <AlertCircle size={10} />}
                        {c.quality}
                      </span>
                    </td>
                    {/* 퀵 액션 인라인 – 호버 시에만 표시 */}
                    <td className="px-2 py-3.5">
                      <div className={cn(
                        "flex items-center gap-1 transition-opacity",
                        hoveredCase?.id === c.id ? "opacity-100" : "opacity-0 pointer-events-none"
                      )}>
                        <button
                          title="전화"
                          onClick={(e) => { e.stopPropagation(); }}
                          className="p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Phone size={14} />
                        </button>
                        <button
                          title="안내 발송"
                          onClick={(e) => { e.stopPropagation(); }}
                          className="p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          title="예약 생성"
                          onClick={(e) => { e.stopPropagation(); }}
                          className="p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Calendar size={14} />
                        </button>
                        <button
                          title="연계 요청"
                          onClick={(e) => { e.stopPropagation(); }}
                          className="p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 호버 팝오버: 선택된 행 우측에 상세 퀵 액션 표시 */}
            {hoveredCase && (
              <div
                ref={popoverRef}
                className="fixed z-50 w-64 bg-white rounded-xl border border-gray-200 shadow-2xl p-4 animate-in fade-in-0 slide-in-from-left-2 duration-150"
                style={{
                  top: (() => {
                    const row = document.querySelector(`tr[data-case-id="${hoveredCase.id}"]`);
                    if (!row) return 200;
                    const rect = row.getBoundingClientRect();
                    const popoverH = 260;
                    const y = rect.top + rect.height / 2 - popoverH / 2;
                    return Math.max(80, Math.min(y, window.innerHeight - popoverH - 20));
                  })(),
                  right: 24,
                }}
                onMouseEnter={() => {
                  if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                }}
                onMouseLeave={() => {
                  hoverTimerRef.current = setTimeout(() => setHoveredCase(null), 150);
                }}
              >
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">퀵 액션</p>
                  <p className="text-sm font-bold text-blue-600 mt-0.5">{hoveredCase.id}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {hoveredCase.stage === "Stage 1"
                      ? `연령대 ${toAgeBand(hoveredCase.profile.age)}`
                      : `${maskName(hoveredCase.profile.name)} · ${hoveredCase.profile.age}세`}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    권장: <span className="font-bold text-orange-600">{hoveredCase.action}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {[
                    { icon: Phone, label: "전화", color: "text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100" },
                    { icon: MessageSquare, label: "안내 발송", color: "text-blue-600 bg-blue-50 border-blue-100 hover:bg-blue-100" },
                    { icon: Calendar, label: "예약 생성", color: "text-orange-600 bg-orange-50 border-orange-100 hover:bg-orange-100" },
                    { icon: ExternalLink, label: "연계 요청", color: "text-purple-600 bg-purple-50 border-purple-100 hover:bg-purple-100" },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={(e) => { e.stopPropagation(); }}
                      className={cn("flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-colors", btn.color)}
                    >
                      <btn.icon size={13} />
                      {btn.label}
                    </button>
                  ))}
                </div>

                <button
                  className={cn(
                    "w-full py-2 text-white text-[11px] font-bold rounded-lg transition-all",
                    hoveredCase.quality === "경고" ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                  )}
                  disabled={hoveredCase.quality === "경고"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hoveredCase.quality !== "경고") {
                      onSelectCase(hoveredCase.id, hoveredCase.stage);
                    }
                  }}
                >
                  {hoveredCase.quality === "경고" ? "품질 미달 — 액션 비활성" : `${hoveredCase.action} 실행`}
                </button>
                {hoveredCase.quality === "경고" && (
                  <p className="text-[9px] text-red-500 mt-1 text-center">필수 검사 항목 누락</p>
                )}
                <div className="mt-2 flex items-center justify-center gap-1 text-[9px] text-gray-400">
                  <History size={10} /> 감사 로그 자동 기록
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-gray-50 text-[10px] text-gray-500 border-t border-gray-100 flex items-center justify-between">
            <span>필터 결과: 1 - {filteredCases.length} of {CASE_RECORDS.length}</span>
            <div className="flex items-center gap-4">
              <span className="italic">행에 마우스를 올리면 퀵 액션이 표시됩니다. 클릭 시 상세화면으로 이동합니다.</span>
              <div className="flex gap-1">
                <button className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-400 cursor-not-allowed">1</button>
                <button className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50">2</button>
                <button className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50">...</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
