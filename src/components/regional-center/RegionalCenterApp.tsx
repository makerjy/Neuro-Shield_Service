import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  ClipboardList,
  FileText,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { Button } from '../ui/button';
import { NeuroShieldLogo } from '../ui/NeuroShieldLogo';
import { AppHeaderTitle, HEADER_TITLE_MAP } from '../ui/AppHeaderTitle';
import { Badge } from '../ui/badge';
import { RegionalDashboard } from './RegionalDashboard';
import { RegionalSettings } from './RegionalSettings';
import { REGIONAL_SCOPES, resolveRegionFromName } from '../geomap/regions';
import { RegionalCausePage } from './RegionalCausePage';
import { RegionalInterventionsPage } from './RegionalInterventionsPage';
import { RegionalReportsPage } from './RegionalReportsPage';
import type { InternalRangeKey, InterventionDraft, KpiKey } from './opsContracts';
import {
  type RegionalPageId,
  type RegionalSelectionState,
  buildRegionalUrl,
  isRegionalPathname,
  parseRegionalPage,
  parseRegionalSelection,
} from './regionalRouting';

type NavigationItem = { id: RegionalPageId; label: string; icon: React.ElementType };

interface RegionalCenterAppProps {
  userRole?: string;
  userName?: string;
  centerName?: string;
  onLogout?: () => void;
}

const DEFAULT_KPI: KpiKey = 'regionalSla';

const navigationItems: NavigationItem[] = [
  { id: 'overview', label: '광역 운영 대시보드', icon: LayoutDashboard },
  { id: 'cause', label: '병목·원인 분석', icon: AlertTriangle },
  { id: 'interventions', label: '개입·조치 관리', icon: ClipboardList },
  { id: 'reports', label: '보고서', icon: FileText },
  { id: 'settings', label: '설정', icon: Settings },
];

const DISTRICT_MAP: Record<string, string[]> = {
  seoul: ['강남구', '서초구', '송파구', '강동구', '마포구', '영등포구', '용산구', '종로구', '중구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '양천구', '구로구', '금천구', '동작구', '관악구', '강서구'],
  busan: ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'],
  daegu: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군'],
  incheon: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  gwangju: ['동구', '서구', '남구', '북구', '광산구'],
  daejeon: ['동구', '중구', '서구', '유성구', '대덕구'],
  ulsan: ['중구', '남구', '동구', '북구', '울주군'],
  sejong: ['세종시'],
  gyeonggi: ['수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시', '화성시', '평택시', '의정부시', '시흥시', '파주시', '김포시', '광명시', '광주시', '군포시', '하남시', '오산시', '이천시'],
  gangwon: ['춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군', '횡성군', '영월군'],
  chungbuk: ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군'],
  chungnam: ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군'],
  jeonbuk: ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군'],
  jeonnam: ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군', '보성군'],
  gyeongbuk: ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시'],
  gyeongnam: ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군', '함안군'],
  jeju: ['제주시', '서귀포시'],
};

function normalizeRange(range: InternalRangeKey): 'week' | 'month' | 'quarter' {
  if (range === 'month') return 'month';
  if (range === 'quarter') return 'quarter';
  return 'week';
}

function isSameSelection(a: RegionalSelectionState, b: RegionalSelectionState): boolean {
  return (
    a.selectedKpiKey === b.selectedKpiKey &&
    a.selectedRegionSgg === b.selectedRegionSgg &&
    a.selectedRange === b.selectedRange
  );
}

function readUrlSelection(fallbackKpi: KpiKey): { page: RegionalPageId; selection: RegionalSelectionState } {
  const page = parseRegionalPage(window.location.pathname);
  const selection = parseRegionalSelection(window.location.search, fallbackKpi);
  return { page, selection };
}

export function RegionalCenterApp({
  userName = '김행정',
  centerName = '서울시 광역정신건강복지센터',
  onLogout,
}: RegionalCenterAppProps) {
  const defaultRegion = resolveRegionFromName(centerName);
  const [regionId, setRegionId] = useState(defaultRegion.id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const initialUrlState = useMemo(() => readUrlSelection(DEFAULT_KPI), []);
  const [currentPage, setCurrentPage] = useState<RegionalPageId>(initialUrlState.page);
  const [selection, setSelection] = useState<RegionalSelectionState>(initialUrlState.selection);
  const [pendingDraft, setPendingDraft] = useState<InterventionDraft | null>(null);

  const region = REGIONAL_SCOPES.find((item) => item.id === regionId) ?? REGIONAL_SCOPES[0];
  const districtOptions = DISTRICT_MAP[regionId] ?? DISTRICT_MAP.seoul;

  const syncUrl = useCallback((nextPage: RegionalPageId, nextSelection: RegionalSelectionState, mode: 'push' | 'replace' = 'push', extras?: Record<string, string | null | undefined>) => {
    const rawUrl = buildRegionalUrl(nextPage, nextSelection, extras);
    const nextUrl = new URL(rawUrl, window.location.origin);
    const currentUrl = new URL(window.location.href);

    // Overview에서 drill/view는 GeoMap drill 상태 SSOT이므로 유지한다.
    if (nextPage === 'overview') {
      const preserveKeys = ['drill', 'view'] as const;
      preserveKeys.forEach((key) => {
        if (!nextUrl.searchParams.has(key) && currentUrl.searchParams.has(key)) {
          const value = currentUrl.searchParams.get(key);
          if (value) nextUrl.searchParams.set(key, value);
        }
      });
    }

    if (
      nextUrl.pathname === currentUrl.pathname &&
      nextUrl.search === currentUrl.search &&
      nextUrl.hash === currentUrl.hash
    ) {
      return;
    }

    if (mode === 'replace') {
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    } else {
      window.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
  }, []);

  useEffect(() => {
    const { page, selection: parsed } = readUrlSelection(DEFAULT_KPI);
    const normalizedPathname = window.location.pathname.replace(/\/+$/, '');
    const isLegacyOverviewPath = /\/regional\/overview$/i.test(normalizedPathname);

    if (!isRegionalPathname(window.location.pathname)) {
      const fallbackSelection: RegionalSelectionState = {
        selectedKpiKey: parsed.selectedKpiKey,
        selectedRegionSgg: parsed.selectedRegionSgg,
        selectedRange: parsed.selectedRange,
      };
      setCurrentPage('overview');
      setSelection(fallbackSelection);
      syncUrl('overview', fallbackSelection, 'replace');
      return;
    }

    if (page === 'overview' && isLegacyOverviewPath) {
      const canonicalUrl = buildRegionalUrl('overview', parsed);
      window.history.replaceState({}, '', canonicalUrl);
    }

    setCurrentPage(page);
    setSelection(parsed);

    const onPopState = () => {
      const next = readUrlSelection(DEFAULT_KPI);
      const popNormalizedPathname = window.location.pathname.replace(/\/+$/, '');
      const popLegacyOverviewPath = /\/regional\/overview$/i.test(popNormalizedPathname);
      if (next.page === 'overview' && popLegacyOverviewPath) {
        const canonicalUrl = buildRegionalUrl('overview', next.selection);
        window.history.replaceState({}, '', canonicalUrl);
      }
      setCurrentPage(next.page);
      setSelection(next.selection);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [syncUrl]);

  useEffect(() => {
    if (selection.selectedRegionSgg && !districtOptions.includes(selection.selectedRegionSgg)) {
      const nextSelection = { ...selection, selectedRegionSgg: null };
      setSelection(nextSelection);
      syncUrl(currentPage, nextSelection, 'replace');
    }
  }, [currentPage, districtOptions, selection, syncUrl]);

  const navigatePage = useCallback((nextPage: RegionalPageId, patch?: Partial<RegionalSelectionState>, extras?: Record<string, string | null | undefined>) => {
    setCurrentPage(nextPage);
    setSelection((prev) => {
      const next = { ...prev, ...patch };
      if (isSameSelection(prev, next)) {
        syncUrl(nextPage, next, 'replace', extras);
        return prev;
      }
      syncUrl(nextPage, next, 'push', extras);
      return next;
    });
  }, [syncUrl]);

  const patchSelection = useCallback((patch: Partial<RegionalSelectionState>) => {
    setSelection((prev) => {
      const next = { ...prev, ...patch };
      if (isSameSelection(prev, next)) return prev;
      syncUrl(currentPage, next, 'replace');
      return next;
    });
  }, [currentPage, syncUrl]);

  const handleCreateIntervention = useCallback((draft: InterventionDraft) => {
    setPendingDraft(draft);
    if (draft.source === 'top5') return;
    navigatePage(
      'interventions',
      {
        selectedKpiKey: draft.kpiKey,
        selectedRegionSgg: draft.region,
        selectedRange: draft.range,
      },
      { create: '1', source: draft.source ?? 'overview', primaryDriverStage: draft.primaryDriverStage },
    );
  }, [navigatePage]);

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return (
          <RegionalDashboard
            region={region}
            selectedKpiKey={selection.selectedKpiKey}
            selectedRegionSgg={selection.selectedRegionSgg}
            selectedRange={normalizeRange(selection.selectedRange)}
            onSelectedKpiKeyChange={(kpi) => patchSelection({ selectedKpiKey: kpi })}
            onSelectedRegionSggChange={(sgg) => patchSelection({ selectedRegionSgg: sgg })}
            onSelectedRangeChange={(range) => patchSelection({ selectedRange: range })}
            onNavigateToCause={({ kpi, sgg, range }) =>
              navigatePage('cause', {
                selectedKpiKey: kpi,
                selectedRegionSgg: sgg,
                selectedRange: range,
              })
            }
            onCreateIntervention={({ kpi, sgg, range, source, primaryDriverStage }) =>
              handleCreateIntervention({
                kpiKey: kpi,
                region: sgg,
                range,
                source,
                primaryDriverStage,
              })
            }
          />
        );
      case 'cause':
        return (
          <RegionalCausePage
            region={region}
            districtOptions={districtOptions}
            selectedKpiKey={selection.selectedKpiKey}
            selectedRegionSgg={selection.selectedRegionSgg}
            selectedRange={selection.selectedRange}
            onSelectedKpiKeyChange={(kpi) => patchSelection({ selectedKpiKey: kpi })}
            onSelectedRegionSggChange={(sgg) => patchSelection({ selectedRegionSgg: sgg })}
            onSelectedRangeChange={(range) => patchSelection({ selectedRange: range })}
            onCreateIntervention={(draft) => handleCreateIntervention(draft)}
          />
        );
      case 'interventions':
        return (
          <RegionalInterventionsPage
            region={region}
            districtOptions={districtOptions}
            selectedKpiKey={selection.selectedKpiKey}
            selectedRegionSgg={selection.selectedRegionSgg}
            selectedRange={selection.selectedRange}
            onSelectedKpiKeyChange={(kpi) => patchSelection({ selectedKpiKey: kpi })}
            onSelectedRegionSggChange={(sgg) => patchSelection({ selectedRegionSgg: sgg })}
            onSelectedRangeChange={(range) => patchSelection({ selectedRange: range })}
            pendingDraft={pendingDraft}
            onPendingDraftConsumed={() => setPendingDraft(null)}
          />
        );
      case 'reports':
        return (
          <RegionalReportsPage
            region={region}
            selectedKpiKey={selection.selectedKpiKey}
            selectedRegionSgg={selection.selectedRegionSgg}
            selectedRange={selection.selectedRange}
          />
        );
      case 'settings':
        return <RegionalSettings regionCode={region.id} regionLabel={region.label} />;
      default:
        return null;
    }
  };

  const handleLogout = () => {
    const confirmed = window.confirm('로그아웃 하시겠습니까?');
    if (confirmed && onLogout) onLogout();
  };

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-gray-50">
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-800 border-r border-slate-700 transition-all duration-300 flex flex-col shrink-0`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
          {sidebarOpen ? (
            <>
              <NeuroShieldLogo size={36} showText subtitle={`${region.label} 운영 컨트롤타워`} variant="dark" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="h-8 w-8 p-0 mx-auto text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
        </div>

        {sidebarOpen && (
          <div className="px-4 py-3 border-b border-slate-700">
            <label className="text-[10px] text-slate-400 block mb-1">관할 권역</label>
            <select
              value={regionId}
              onChange={(event) => {
                setRegionId(event.target.value);
                patchSelection({ selectedRegionSgg: null });
              }}
              className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {REGIONAL_SCOPES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex-1 p-4 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigatePage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 ${!sidebarOpen && 'mx-auto'}`} />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-slate-700">
            <div className="text-xs text-slate-400 mb-1">{region.label} 광역센터</div>
            <div className="text-sm font-medium text-white">{userName}</div>
            <div className="text-xs text-slate-400">운영 책임자</div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex min-h-0 flex-col overflow-hidden min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            {(() => {
              const current = navigationItems.find(n => n.id === currentPage);
              const Icon = current?.icon || LayoutDashboard;
              const mapped = HEADER_TITLE_MAP[currentPage as keyof typeof HEADER_TITLE_MAP];
              return (
                <AppHeaderTitle
                  title={mapped?.title ?? current?.label ?? '광역 운영 대시보드'}
                  subtitle={mapped?.subtitle ?? 'Neuro-Shield 광역센터 운영 시스템'}
                  icon={<Icon className="h-4 w-4 text-white" />}
                />
              );
            })()}
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                3
              </Badge>
            </Button>

            <div className="relative">
              <Button variant="ghost" className="flex items-center gap-2" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm">
                  {userName.charAt(0)}
                </div>
                <span className="text-sm font-medium">{userName}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </Button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="px-3 py-2 border-b border-gray-200">
                      <div className="text-sm font-medium text-gray-900">{userName}</div>
                      <div className="text-xs text-gray-500">운영 책임자</div>
                    </div>
                    <div className="border-t border-gray-200 py-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        로그아웃
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="relative flex-1 min-h-0 w-full overflow-hidden">{renderPage()}</main>
      </div>
    </div>
  );
}
