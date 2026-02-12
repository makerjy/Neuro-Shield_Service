/* ═══════════════════════════════════════════════════════════════════════════
   CaseDetailPrograms — 프로그램 제공(행정 실행) 통합 UI
   Stage2/Stage3 케이스 상세 화면에서 사용하는 전체 프로그램 관리 컴포넌트
   - ProgramPickerPanel (대주제→중주제→소분류 Drill-down)
   - SelectedProgramCards (선택 프로그램 + 행정 실행 필드)
   - ProgramExecutionDrawer (상세 입력/수정 Drawer)
   - ProgramRecommendationPanel (우측 고정, Rule/RAG 추천)
   - ProgramAuditTimeline (감사 로그 타임라인)
═══════════════════════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search, Star, StarOff, ChevronDown, ChevronRight, Check, X,
  Plus, FileText, Clock, MapPin, Phone, User, CalendarDays, MessageSquare,
  Bookmark, BookmarkCheck, ExternalLink, AlertCircle, History, Sparkles,
  ChevronUp, Filter, Package, Heart, Home, Shield, Users, Info,
} from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { cn } from "../../ui/utils";
import type {
  TopCategory, ProgramTaxonomyItem, SelectedProgramItem,
  ExecutionMode, ExecutionStatus, OrgLink, AuditEvent,
  RecommendationItem, StageContext,
} from "./programTypes";
import {
  PROGRAM_CATALOG, TOP_CATEGORIES, TOP_CATEGORY_META,
  getMidCategories, getSubItems, searchPrograms,
} from "./programCatalog";
import { getCombinedRecommendations } from "./recommendationEngine";
import { createAuditEvent, AUDIT_TYPE_LABEL } from "./auditUtils";

/* ═══════════════════════════════════════════════════════════════
   PROPS
═══════════════════════════════════════════════════════════════ */
interface CaseDetailProgramsProps {
  caseId: string;
  stage: 2 | 3;
  resultLabel: "정상" | "MCI" | "치매";
  mciSeverity?: "양호" | "중등" | "중증";
  riskTags?: string[];
  /** 담당자 정보 */
  actorId?: string;
  actorName?: string;
  /** 읽기 전용(다른 Stage에서 열람 시) */
  readOnly?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   상수
═══════════════════════════════════════════════════════════════ */
const EXECUTION_MODES: ExecutionMode[] = ["연계", "예약", "안내", "교육", "방문"];
const EXECUTION_STATUSES: ExecutionStatus[] = ["예정", "진행", "완료", "보류"];

const STATUS_COLORS: Record<ExecutionStatus, string> = {
  "예정": "bg-blue-100 text-blue-700",
  "진행": "bg-amber-100 text-amber-700",
  "완료": "bg-green-100 text-green-700",
  "보류": "bg-gray-100 text-gray-500",
};

function addDaysYmd(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const TOP_ICONS: Record<TopCategory, React.ReactNode> = {
  "건강":    <Heart className="h-4 w-4" />,
  "일상생활": <Home className="h-4 w-4" />,
  "안전":    <Shield className="h-4 w-4" />,
  "가족":    <Users className="h-4 w-4" />,
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export function CaseDetailPrograms({
  caseId, stage, resultLabel, mciSeverity, riskTags = [],
  actorId = "OP-001", actorName = "이상담",
  readOnly = false,
}: CaseDetailProgramsProps) {

  /* ── 상태 관리 ── */
  const [selectedItems, setSelectedItems] = useState<SelectedProgramItem[]>([]);
  const [checkedCodes, setCheckedCodes] = useState<Set<string>>(new Set());
  const [pinnedCodes, setPinnedCodes] = useState<Set<string>>(new Set());
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTop, setActiveTop] = useState<TopCategory>("건강");
  const [expandedMids, setExpandedMids] = useState<Set<string>>(new Set());
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [drawerItem, setDrawerItem] = useState<SelectedProgramItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [heldRecoCodes, setHeldRecoCodes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"picker" | "selected" | "audit">("picker");

  /* ── 추천 ── */
  const stageCtx = useMemo<StageContext>(() => ({
    stage, resultLabel, mciSeverity, riskTags,
  }), [stage, resultLabel, mciSeverity, riskTags]);

  const recommendations = useMemo(
    () => getCombinedRecommendations(stageCtx),
    [stageCtx],
  );

  /* ── 감사 이벤트 기록 ── */
  const addAudit = useCallback((
    type: AuditEvent["type"],
    payload: Record<string, unknown>,
    sourceMeta?: AuditEvent["sourceMeta"],
  ) => {
    const ev = createAuditEvent(caseId, actorId, actorName, type, payload, sourceMeta);
    setAuditLog(prev => [ev, ...prev]);
  }, [caseId, actorId, actorName]);

  /* ── 프로그램 선택/해제 ── */
  const toggleCheck = useCallback((code: string) => {
    setCheckedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        // 선택 목록에서도 제거
        setSelectedItems(si => si.filter(s => s.code !== code));
        addAudit("REMOVE_SELECTED", { code });
      } else {
        next.add(code);
        // 선택 목록에 추가
        const cat = PROGRAM_CATALOG.find(p => p.code === code);
        if (cat) {
          const newItem: SelectedProgramItem = {
            code: cat.code, label: cat.label, top: cat.top, mid: cat.mid,
            mode: "안내", dueDate: "", assigneeId: actorId, assigneeName: actorName,
            notes: "", status: "예정", addedAt: new Date().toISOString(), addedSource: "manual",
          };
          setSelectedItems(si => [...si, newItem]);
          addAudit("ADD_SELECTED", { code, label: cat.label });
        }
      }
      return next;
    });
  }, [actorId, actorName, addAudit]);

  /* ── 추천에서 추가 ── */
  const addFromReco = useCallback((reco: RecommendationItem) => {
    if (checkedCodes.has(reco.code)) return;
    setCheckedCodes(prev => new Set(prev).add(reco.code));
    const newItem: SelectedProgramItem = {
      code: reco.code, label: reco.label, top: reco.top, mid: reco.mid,
      mode: "안내", dueDate: "", assigneeId: actorId, assigneeName: actorName,
      notes: "", status: "예정", addedAt: new Date().toISOString(), addedSource: reco.source,
    };
    setSelectedItems(si => [...si, newItem]);
    addAudit("ADD_FROM_RECO", { code: reco.code, label: reco.label, source: reco.source },
      { source: reco.source, code: reco.code });
  }, [checkedCodes, actorId, actorName, addAudit]);

  /* ── 핀 토글 ── */
  const togglePin = useCallback((code: string) => {
    setPinnedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) { next.delete(code); addAudit("UNPIN", { code }); }
      else { next.add(code); addAudit("PIN", { code }); }
      return next;
    });
  }, [addAudit]);

  const addTopRecommendations = useCallback(() => {
    if (readOnly) return;
    const candidates = recommendations.filter((reco) => !checkedCodes.has(reco.code)).slice(0, 3);
    if (candidates.length === 0) return;
    for (const reco of candidates) {
      addFromReco(reco);
    }
  }, [addFromReco, checkedCodes, recommendations, readOnly]);

  const applyExecutionPlanPreset = useCallback(() => {
    if (readOnly) return;
    setSelectedItems((prev) =>
      prev.map((item, index) => {
        const mode: ExecutionMode =
          stage === 2
            ? resultLabel === "정상"
              ? "안내"
              : resultLabel === "MCI"
                ? index % 2 === 0
                  ? "연계"
                  : "교육"
                : "예약"
            : index % 3 === 0
              ? "방문"
              : index % 3 === 1
                ? "연계"
                : "교육";
        const status: ExecutionStatus = item.status === "완료" ? "완료" : "예정";
        const dueDate = item.dueDate || addDaysYmd(stage === 2 ? 3 + index : 2 + index);
        return { ...item, mode, status, dueDate };
      }),
    );
    addAudit("STATUS_CHANGE", {
      reason: "실행계획 자동 배치",
      stage,
      resultLabel,
    });
  }, [addAudit, readOnly, resultLabel, stage]);

  const selectedByRecoCount = useMemo(
    () => selectedItems.filter((item) => item.addedSource && item.addedSource !== "manual").length,
    [selectedItems],
  );
  const completedCount = useMemo(
    () => selectedItems.filter((item) => item.status === "완료").length,
    [selectedItems],
  );
  const inProgressCount = useMemo(
    () => selectedItems.filter((item) => item.status === "진행").length,
    [selectedItems],
  );
  const pendingDueUnsetCount = useMemo(
    () => selectedItems.filter((item) => item.status !== "완료" && !item.dueDate).length,
    [selectedItems],
  );
  const recommendationCoverage = useMemo(() => {
    if (recommendations.length === 0) return 0;
    const covered = recommendations.filter((reco) => checkedCodes.has(reco.code)).length;
    return Math.round((covered / recommendations.length) * 100);
  }, [checkedCodes, recommendations]);

  const stagePlaybook = useMemo(() => {
    if (stage === 2) {
      return [
        "1) 분류 확인 후 추천 프로그램 선택",
        "2) 실행 모드/담당자/기한 설정",
        "3) 상담·문자·예약 연계 기록",
      ];
    }
    return [
      "1) 정기추적/재평가 중심으로 프로그램 배치",
      "2) 장기 미참여 복귀/보호자 지원 연계",
      "3) 감사 로그와 다음 체크포인트 동기화",
    ];
  }, [stage]);

  /* ── Drawer 열기/닫기 ── */
  const openDrawer = useCallback((item: SelectedProgramItem) => {
    setDrawerItem({ ...item });
    setDrawerOpen(true);
  }, []);

  const saveDrawer = useCallback((updated: SelectedProgramItem) => {
    setSelectedItems(prev => prev.map(s => s.code === updated.code ? updated : s));
    addAudit("UPDATE_EXECUTION", {
      code: updated.code, mode: updated.mode, status: updated.status,
      dueDate: updated.dueDate, assigneeName: updated.assigneeName,
    });
    setDrawerOpen(false);
    setDrawerItem(null);
  }, [addAudit]);

  /* ── 검색 결과 ── */
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    let items = searchPrograms(searchQuery);
    if (showPinnedOnly) items = items.filter(i => pinnedCodes.has(i.code));
    return items;
  }, [searchQuery, showPinnedOnly, pinnedCodes]);

  /* ── 아코디언 토글 ── */
  const toggleMid = useCallback((mid: string) => {
    setExpandedMids(prev => {
      const next = new Set(prev);
      if (next.has(mid)) next.delete(mid); else next.add(mid);
      return next;
    });
  }, []);

  /* ═══ RENDER ═══ */
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
      {/* ── LEFT: 프로그램 선택 + 선택된 카드 + 감사 로그 ── */}
      <div className="xl:col-span-8 space-y-3">
        {/* Stage 컨텍스트 배지 */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">Stage {stage}</Badge>
          <Badge variant="outline" className="text-xs">{resultLabel}</Badge>
          {mciSeverity && <Badge variant="outline" className="text-xs">MCI {mciSeverity}</Badge>}
          {riskTags.map(t => (
            <Badge key={t} variant="destructive" className="text-xs">{t}</Badge>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">추천 반영률</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{recommendationCoverage}%</p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${recommendationCoverage}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">추천 {recommendations.length}개 중 {selectedByRecoCount}개 선택</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">실행 완료율</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {selectedItems.length === 0 ? 0 : Math.round((completedCount / selectedItems.length) * 100)}%
            </p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${selectedItems.length === 0 ? 0 : Math.round((completedCount / selectedItems.length) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">완료 {completedCount} / 진행 {inProgressCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">일정 미설정</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{pendingDueUnsetCount}건</p>
            <p className="text-[10px] text-slate-500">예정/진행 항목 기준</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">운영 시퀀스</p>
            {stagePlaybook.map((line) => (
              <p key={line} className="mt-1 text-[10px] text-slate-600">{line}</p>
            ))}
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={addTopRecommendations}>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              추천 상위 3개 일괄 추가
            </Button>
            <Button size="sm" variant="outline" onClick={applyExecutionPlanPreset}>
              <Clock className="mr-1 h-3.5 w-3.5" />
              실행 계획 자동 배치
            </Button>
          </div>
        )}

        {/* 탭 전환 */}
        <div className="flex gap-1 border-b border-gray-200 pb-0">
          {(["picker", "selected", "audit"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              {tab === "picker" && <><Package className="inline h-3.5 w-3.5 mr-1" />프로그램 선택</>}
              {tab === "selected" && <><Check className="inline h-3.5 w-3.5 mr-1" />선택됨 ({selectedItems.length})</>}
              {tab === "audit" && <><History className="inline h-3.5 w-3.5 mr-1" />감사 로그 ({auditLog.length})</>}
            </button>
          ))}
        </div>

        {/* TAB: 프로그램 선택 */}
        {activeTab === "picker" && (
          <ProgramPickerPanel
            activeTop={activeTop}
            setActiveTop={setActiveTop}
            expandedMids={expandedMids}
            toggleMid={toggleMid}
            checkedCodes={checkedCodes}
            toggleCheck={toggleCheck}
            pinnedCodes={pinnedCodes}
            togglePin={togglePin}
            showPinnedOnly={showPinnedOnly}
            setShowPinnedOnly={setShowPinnedOnly}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            readOnly={readOnly}
          />
        )}

        {/* TAB: 선택된 프로그램 카드 */}
        {activeTab === "selected" && (
          <SelectedProgramCards
            items={selectedItems}
            onOpenDrawer={openDrawer}
            readOnly={readOnly}
          />
        )}

        {/* TAB: 감사 로그 */}
        {activeTab === "audit" && (
          <ProgramAuditTimeline events={auditLog} />
        )}
      </div>

      {/* ── RIGHT: 추천 패널 (고정) ── */}
      <div className="xl:col-span-4">
        <div className="sticky top-4">
          <ProgramRecommendationPanel
            recommendations={recommendations}
            checkedCodes={checkedCodes}
            heldCodes={heldRecoCodes}
            onAdd={addFromReco}
            onHold={(code) => {
              setHeldRecoCodes(prev => new Set(prev).add(code));
              addAudit("HOLD_RECO", { code });
            }}
            readOnly={readOnly}
          />
        </div>
      </div>

      {/* ── DRAWER: 실행 상세 ── */}
      {drawerOpen && drawerItem && (
        <ProgramExecutionDrawer
          item={drawerItem}
          onSave={saveDrawer}
          onClose={() => { setDrawerOpen(false); setDrawerItem(null); }}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ProgramPickerPanel — 대주제/중주제/소분류 Drill-down
═══════════════════════════════════════════════════════════════ */
function ProgramPickerPanel({
  activeTop, setActiveTop, expandedMids, toggleMid,
  checkedCodes, toggleCheck, pinnedCodes, togglePin,
  showPinnedOnly, setShowPinnedOnly, searchQuery, setSearchQuery,
  searchResults, readOnly,
}: {
  activeTop: TopCategory;
  setActiveTop: (t: TopCategory) => void;
  expandedMids: Set<string>;
  toggleMid: (mid: string) => void;
  checkedCodes: Set<string>;
  toggleCheck: (code: string) => void;
  pinnedCodes: Set<string>;
  togglePin: (code: string) => void;
  showPinnedOnly: boolean;
  setShowPinnedOnly: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchResults: ProgramTaxonomyItem[] | null;
  readOnly: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Package className="h-4 w-4 text-blue-600" />
            프로그램 카탈로그
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
                showPinnedOnly ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-100",
              )}
            >
              {showPinnedOnly ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
              핀만 보기
            </button>
          </div>
        </div>
        {/* 검색 */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="프로그램명, 코드, 키워드로 검색..."
            className="pl-8 h-8 text-xs"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* 검색 결과 모드 */}
        {searchResults !== null ? (
          <div className="mt-2">
            <div className="text-xs text-gray-500 mb-2">{searchResults.length}개 검색 결과</div>
            <div ref={scrollRef} className="max-h-[400px] overflow-y-auto space-y-0.5 pr-1">
              {searchResults.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-8">검색 결과가 없습니다</div>
              ) : (
                searchResults.map(item => (
                  <SubItemRow
                    key={item.code}
                    item={item}
                    checked={checkedCodes.has(item.code)}
                    pinned={pinnedCodes.has(item.code)}
                    onToggle={() => toggleCheck(item.code)}
                    onPin={() => togglePin(item.code)}
                    readOnly={readOnly}
                    showBreadcrumb
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 대주제 4개 탭 */}
            <div className="grid grid-cols-4 gap-1.5 mt-2 mb-3">
              {TOP_CATEGORIES.map(top => {
                const meta = TOP_CATEGORY_META[top];
                const isActive = activeTop === top;
                return (
                  <button
                    key={top}
                    onClick={() => setActiveTop(top)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-all border",
                      isActive
                        ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    <span className={cn(
                      "p-1.5 rounded-md",
                      isActive ? "bg-blue-100" : "bg-gray-100",
                    )}>
                      {TOP_ICONS[top]}
                    </span>
                    {top}
                  </button>
                );
              })}
            </div>

            {/* 중주제 아코디언 */}
            <div ref={scrollRef} className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
              {getMidCategories(activeTop).map(mid => {
                const isExpanded = expandedMids.has(mid);
                let subItems = getSubItems(activeTop, mid);
                if (showPinnedOnly) subItems = subItems.filter(i => pinnedCodes.has(i.code));

                return (
                  <div key={mid} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleMid(mid)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                      aria-expanded={isExpanded}
                    >
                      <span className="flex items-center gap-1.5">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {mid}
                        <Badge variant="secondary" className="text-[10px] ml-1">{subItems.length}</Badge>
                      </span>
                      {subItems.some(i => checkedCodes.has(i.code)) && (
                        <Badge className="text-[10px] bg-blue-600">
                          {subItems.filter(i => checkedCodes.has(i.code)).length} 선택
                        </Badge>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-100 divide-y divide-gray-50">
                        {subItems.length === 0 ? (
                          <div className="text-xs text-gray-400 text-center py-3">
                            {showPinnedOnly ? "핀 등록된 항목 없음" : "항목 없음"}
                          </div>
                        ) : (
                          subItems.map(item => (
                            <SubItemRow
                              key={item.code}
                              item={item}
                              checked={checkedCodes.has(item.code)}
                              pinned={pinnedCodes.has(item.code)}
                              onToggle={() => toggleCheck(item.code)}
                              onPin={() => togglePin(item.code)}
                              readOnly={readOnly}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── SubItemRow ─── */
function SubItemRow({ item, checked, pinned, onToggle, onPin, readOnly, showBreadcrumb = false }: {
  item: ProgramTaxonomyItem;
  checked: boolean;
  pinned: boolean;
  onToggle: () => void;
  onPin: () => void;
  readOnly: boolean;
  showBreadcrumb?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 text-xs transition-colors group",
      checked ? "bg-blue-50/60" : "hover:bg-gray-50",
    )}>
      {!readOnly && (
        <button
          onClick={onToggle}
          className={cn(
            "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
            checked ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 hover:border-blue-400",
          )}
          aria-label={`${item.label} ${checked ? '선택 해제' : '선택'}`}
        >
          {checked && <Check className="h-3 w-3" />}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800 truncate">{item.label}</div>
        {showBreadcrumb && (
          <div className="text-[10px] text-gray-400 truncate mt-0.5">{item.top} › {item.mid} › {item.sub}</div>
        )}
      </div>
      <span className="text-[10px] text-gray-400 font-mono shrink-0">{item.code}</span>
      <button
        onClick={onPin}
        className={cn(
          "p-0.5 rounded transition-colors shrink-0",
          pinned ? "text-amber-500" : "text-gray-300 opacity-0 group-hover:opacity-100",
        )}
        aria-label={`${item.label} ${pinned ? '핀 해제' : '핀 등록'}`}
      >
        {pinned ? <Star className="h-3 w-3 fill-current" /> : <StarOff className="h-3 w-3" />}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SelectedProgramCards — 선택 프로그램 카드
═══════════════════════════════════════════════════════════════ */
function SelectedProgramCards({ items, onOpenDrawer, readOnly }: {
  items: SelectedProgramItem[];
  onOpenDrawer: (item: SelectedProgramItem) => void;
  readOnly: boolean;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
            <Package className="h-6 w-6 text-blue-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">아직 선택된 프로그램이 없습니다</p>
          <p className="text-xs text-gray-400 mt-1.5 max-w-[280px] mx-auto">"프로그램 선택" 탭에서 항목을 직접 추가하거나,<br/>우측 추천 패널에서 참고 추천 프로그램을 선택할 수 있습니다.</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              우측 &ldquo;운영 가이드 참고 추천&rdquo; 패널에서 빠르게 추가
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const grouped = items.reduce<Record<TopCategory, SelectedProgramItem[]>>((acc, item) => {
    (acc[item.top] ??= []).push(item);
    return acc;
  }, {} as Record<TopCategory, SelectedProgramItem[]>);

  return (
    <div className="space-y-3">
      {/* 요약 */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>총 {items.length}개 선택</span>
        <span>·</span>
        <span className="text-green-600">{items.filter(i => i.status === "완료").length} 완료</span>
        <span className="text-amber-600">{items.filter(i => i.status === "진행").length} 진행</span>
        <span className="text-blue-600">{items.filter(i => i.status === "예정").length} 예정</span>
        <span className="text-gray-400">{items.filter(i => i.status === "보류").length} 보류</span>
      </div>

      {TOP_CATEGORIES.filter(top => grouped[top]?.length).map(top => (
        <div key={top}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="p-1 rounded bg-gray-100">{TOP_ICONS[top]}</span>
            <span className="text-xs font-semibold text-gray-700">{top}</span>
            <Badge variant="secondary" className="text-[10px]">{grouped[top].length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {grouped[top].map(item => (
              <button
                key={item.code}
                onClick={() => !readOnly && onOpenDrawer(item)}
                className={cn(
                  "text-left border rounded-lg p-3 transition-all",
                  readOnly ? "cursor-default" : "hover:shadow-md hover:border-blue-300 cursor-pointer",
                  "bg-white border-gray-200",
                )}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-800 flex-1 min-w-0 truncate">{item.label}</span>
                  <Badge className={cn("text-[10px] shrink-0 ml-2", STATUS_COLORS[item.status])}>
                    {item.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-500">
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />{item.mode}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />{item.assigneeName}
                  </div>
                  {item.dueDate && (
                    <div className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />{item.dueDate}
                    </div>
                  )}
                  {item.orgLink?.name && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{item.orgLink.name}
                    </div>
                  )}
                </div>
                {item.notes && (
                  <div className="text-[10px] text-gray-400 mt-1.5 truncate">💬 {item.notes}</div>
                )}
                {item.addedSource && item.addedSource !== "manual" && (
                  <div className="text-[10px] text-purple-500 mt-1">
                    <Sparkles className="inline h-3 w-3 mr-0.5" />
                    {item.addedSource === "rule" ? "운영 가이드 참고 추천" : "문서 기반 참고 추천"}에서 추가됨
                  </div>
                )}
                {!readOnly && (
                  <div className="text-[10px] mt-2 text-blue-600 font-medium flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    클릭하여 상세 편집
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ProgramExecutionDrawer — 상세 입력/수정
═══════════════════════════════════════════════════════════════ */
function ProgramExecutionDrawer({ item, onSave, onClose, readOnly }: {
  item: SelectedProgramItem;
  onSave: (updated: SelectedProgramItem) => void;
  onClose: () => void;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState<SelectedProgramItem>({ ...item });

  const update = <K extends keyof SelectedProgramItem>(key: K, val: SelectedProgramItem[K]) => {
    setDraft(prev => ({ ...prev, [key]: val }));
  };

  const updateOrg = <K extends keyof OrgLink>(key: K, val: OrgLink[K]) => {
    setDraft(prev => ({ ...prev, orgLink: { ...prev.orgLink, name: prev.orgLink?.name ?? "", [key]: val } }));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">프로그램 실행 상세</h3>
            <p className="text-xs text-gray-500 mt-0.5">{draft.label}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* 코드/분류 */}
          <div>
            <Label>프로그램 코드</Label>
            <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1.5 rounded font-mono">{draft.code}</div>
          </div>
          <div>
            <Label>분류</Label>
            <div className="text-xs text-gray-600">{draft.top} › {draft.mid}</div>
          </div>

          {/* 제공 방식 */}
          <div>
            <Label>제공 방식</Label>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {EXECUTION_MODES.map(m => (
                <button
                  key={m}
                  onClick={() => !readOnly && update("mode", m)}
                  disabled={readOnly}
                  className={cn(
                    "text-xs py-1.5 rounded-md border transition-colors text-center",
                    draft.mode === m
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 상태 */}
          <div>
            <Label>상태</Label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {EXECUTION_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => !readOnly && update("status", s)}
                  disabled={readOnly}
                  className={cn(
                    "text-xs py-1.5 rounded-md border transition-colors text-center",
                    draft.status === s
                      ? STATUS_COLORS[s] + " border-transparent font-medium"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 담당자 */}
          <div>
            <Label>담당자</Label>
            <Input
              value={draft.assigneeName}
              onChange={e => update("assigneeName", e.target.value)}
              className="h-8 text-xs mt-1"
              disabled={readOnly}
            />
          </div>

          {/* 예정일 */}
          <div>
            <Label>예정일</Label>
            <Input
              type="date"
              value={draft.dueDate}
              onChange={e => update("dueDate", e.target.value)}
              className="h-8 text-xs mt-1"
              disabled={readOnly}
            />
          </div>

          {/* 연결 기관 */}
          <div>
            <Label>연결 기관</Label>
            <div className="space-y-1.5 mt-1">
              <Input
                placeholder="기관명"
                value={draft.orgLink?.name ?? ""}
                onChange={e => updateOrg("name", e.target.value)}
                className="h-8 text-xs"
                disabled={readOnly}
              />
              <Input
                placeholder="연락처"
                value={draft.orgLink?.phone ?? ""}
                onChange={e => updateOrg("phone", e.target.value)}
                className="h-8 text-xs"
                disabled={readOnly}
              />
              <Input
                placeholder="메모"
                value={draft.orgLink?.note ?? ""}
                onChange={e => updateOrg("note", e.target.value)}
                className="h-8 text-xs"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* 메모 */}
          <div>
            <Label>메모 (사유/주의사항)</Label>
            <Textarea
              value={draft.notes}
              onChange={e => update("notes", e.target.value)}
              className="text-xs mt-1 min-h-[60px]"
              placeholder="메모를 입력하세요..."
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-gray-50">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" onClick={() => onSave(draft)}>저장</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-gray-700">{children}</label>;
}

/* ═══════════════════════════════════════════════════════════════
   ProgramRecommendationPanel — 우측 추천 패널
═══════════════════════════════════════════════════════════════ */
function ProgramRecommendationPanel({
  recommendations, checkedCodes, heldCodes, onAdd, onHold, readOnly,
}: {
  recommendations: RecommendationItem[];
  checkedCodes: Set<string>;
  heldCodes: Set<string>;
  onAdd: (r: RecommendationItem) => void;
  onHold: (code: string) => void;
  readOnly: boolean;
}) {
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());
  const toggleEvidence = (code: string) => {
    setExpandedEvidence(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-purple-600" />
          운영 가이드 참고 추천
        </CardTitle>
        {/* 상시 고정 문구 */}
        <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2 mt-2">
          <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            추천은 참고용이며, 최종 선택과 제공 확정은 담당자가 수행합니다.
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {recommendations.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6">
            현재 조건에 해당하는 참고 추천 항목이 없습니다
          </div>
        ) : (
          recommendations.map(reco => {
            const isAdded = checkedCodes.has(reco.code);
            const isHeld = heldCodes.has(reco.code);
            const isEvidenceOpen = expandedEvidence.has(reco.code);

            return (
              <div
                key={reco.code}
                className={cn(
                  "border rounded-lg p-2.5 transition-colors",
                  isAdded ? "border-green-300 bg-green-50/50" : isHeld ? "border-gray-200 bg-gray-50 opacity-60" : "border-gray-200 bg-white",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-800 flex-1">{reco.label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      reco.source === "rule" ? "border-blue-300 text-blue-600" : "border-purple-300 text-purple-600",
                    )}>
                      {reco.source === "rule" ? "가이드" : "문서 참고"}
                    </Badge>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      reco.confidenceLabel === "높음" ? "border-green-300 text-green-600" :
                      reco.confidenceLabel === "보통" ? "border-amber-300 text-amber-600" :
                      "border-gray-300 text-gray-500",
                    )}>
                      {reco.confidenceLabel}
                    </Badge>
                  </div>
                </div>

                <p className="text-[11px] text-gray-600 leading-relaxed mb-2">{reco.reasonSummary}</p>

                {/* 근거 더 보기 */}
                {reco.evidenceSnippets.length > 0 && (
                  <div className="mb-2">
                    <button
                      onClick={() => toggleEvidence(reco.code)}
                      className="text-[10px] text-purple-600 hover:underline flex items-center gap-0.5"
                    >
                      {isEvidenceOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      근거 더 보기
                    </button>
                    {isEvidenceOpen && (
                      <div className="mt-1.5 space-y-1.5">
                        {reco.evidenceSnippets.map((snip, idx) => (
                          <div key={idx} className="bg-gray-50 border border-gray-100 rounded px-2 py-1.5 text-[10px] text-gray-600 leading-relaxed">
                            {snip}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 액션 */}
                {!readOnly && !isAdded && !isHeld && (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="text-[11px] h-7" onClick={() => onAdd(reco)}>
                      <Plus className="h-3 w-3 mr-0.5" />선택 목록에 추가
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[11px] h-7 text-gray-400" onClick={() => onHold(reco.code)}>
                      보류
                    </Button>
                  </div>
                )}
                {isAdded && (
                  <div className="text-[10px] text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />선택 목록에 추가됨
                  </div>
                )}
                {isHeld && !isAdded && (
                  <div className="text-[10px] text-gray-400 flex items-center gap-1">
                    보류 처리됨 (담당자 확인 완료)
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ProgramAuditTimeline — 감사 로그 타임라인
═══════════════════════════════════════════════════════════════ */
function ProgramAuditTimeline({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <History className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">감사 로그가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">프로그램 선택/변경 시 자동으로 기록됩니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <History className="h-4 w-4 text-gray-600" />
          감사 로그 타임라인
          <Badge variant="secondary" className="text-[10px] ml-1">{events.length}건</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative space-y-0 max-h-[400px] overflow-y-auto">
          {events.map((ev, idx) => (
            <div key={ev.eventId} className="flex gap-3 pb-3">
              {/* 타임라인 라인 */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-1.5 shrink-0",
                  ev.type === "ADD_SELECTED" || ev.type === "ADD_FROM_RECO" ? "bg-blue-500" :
                  ev.type === "UPDATE_EXECUTION" ? "bg-amber-500" :
                  ev.type === "REMOVE_SELECTED" ? "bg-red-500" :
                  "bg-gray-400",
                )} />
                {idx < events.length - 1 && <div className="flex-1 w-px bg-gray-200 mt-1" />}
              </div>
              {/* 내용 */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-gray-800">{AUDIT_TYPE_LABEL[ev.type]}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-400">{ev.actorName}</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(ev.at).toLocaleString("ko-KR")}
                </div>
                {ev.payload && (
                  <div className="text-[10px] text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1">
                    {Object.entries(ev.payload).map(([k, v]) => (
                      <span key={k} className="mr-2">{k}: <strong>{String(v)}</strong></span>
                    ))}
                  </div>
                )}
                {ev.sourceMeta && (
                  <div className="text-[10px] text-purple-500 mt-0.5">
                    출처: {ev.sourceMeta.source === "rule" ? "운영 가이드" : "문서 참고"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
