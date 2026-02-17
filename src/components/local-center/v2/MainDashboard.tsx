import React, { useMemo, useState } from "react";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Phone, 
  Calendar, 
  Link as LinkIcon, 
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from "recharts";
import { cn, type StageType } from "./shared";
import { GeoMapPanel } from "../../geomap/GeoMapPanel";
import { REGIONAL_SCOPES } from "../../geomap/regions";
import { applyDrilldownFilter, useDashboardStats } from "./caseSSOT";

interface KPIProps {
  label: string;
  value: string;
  change: string;
  isUp: boolean;
  color: string;
  onClick?: () => void;
}

const KPICard = ({ label, value, change, isUp, color, onClick }: KPIProps) => (
  <div 
    onClick={onClick}
    className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col gap-2 group"
  >
    <span className="text-gray-500 text-xs font-semibold group-hover:text-blue-600 transition-colors">{label}</span>
    <div className="flex items-baseline justify-between">
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      <div className={cn(
        "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded",
        isUp ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
      )}>
        {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {change}
      </div>
    </div>
    <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
      <div className={cn("h-full", color)} style={{ width: "65%" }}></div>
    </div>
  </div>
);

/* ── KOSTAT 2018 GeoJSON 기준 시군구 코드 (행정안전부 코드와 다름!) ── */
const SEOUL_SIG_CODE_BY_DISTRICT: Record<string, string> = {
  종로구: "11010",
  중구: "11020",
  용산구: "11030",
  성동구: "11040",
  광진구: "11050",
  동대문구: "11060",
  중랑구: "11070",
  성북구: "11080",
  강북구: "11090",
  도봉구: "11100",
  노원구: "11110",
  은평구: "11120",
  서대문구: "11130",
  마포구: "11140",
  양천구: "11150",
  강서구: "11160",
  구로구: "11170",
  금천구: "11180",
  영등포구: "11190",
  동작구: "11200",
  관악구: "11210",
  서초구: "11220",
  강남구: "11230",
  송파구: "11240",
  강동구: "11250",
};

function resolveLocalMapScope(centerName?: string) {
  const matchedRegion =
    REGIONAL_SCOPES.find((region) => centerName?.includes(region.name) || centerName?.includes(region.label)) ??
    REGIONAL_SCOPES[0];

  const matchedDistrictEntry = Object.entries(SEOUL_SIG_CODE_BY_DISTRICT).find(([district]) =>
    centerName?.includes(district)
  );

  const sigCode = matchedDistrictEntry?.[1] ?? "11230";
  const sigLabel = matchedDistrictEntry?.[0] ?? "강남구";
  const ctprvnCode = sigCode.slice(0, 2) || matchedRegion.ctprvnCode;
  const ctprvnLabel =
    REGIONAL_SCOPES.find((region) => region.ctprvnCode === ctprvnCode)?.label ?? matchedRegion.label;

  return {
    ctprvnCode,
    ctprvnLabel,
    sigCode,
    sigLabel,
  };
}

export function MainDashboard({ onNavigateToCases, onSelectCase, centerName }: {
  onNavigateToCases: (filter: string) => void,
  onSelectCase: (id: string, stage: StageType) => void,
  centerName?: string,
}) {
  const stats = useDashboardStats();
  const mapScope = resolveLocalMapScope(centerName);
  const [hoveredPipelineStep, setHoveredPipelineStep] = useState<string | null>(null);
  const mciDistribution = useMemo(
    () =>
      stats.mciDistribution.length > 0
        ? stats.mciDistribution
        : [
            { name: "Low", value: 0, color: "#059669" },
            { name: "Moderate", value: 0, color: "#d97706" },
            { name: "High", value: 0, color: "#dc2626" },
          ],
    [stats.mciDistribution],
  );
  const highRiskMciList = stats.highRiskMciList;
  const pipelineData = stats.pipelineData;
  const priorityTasks = stats.priorityTasks;

  const handleDrilldown = (filter: string) => {
    applyDrilldownFilter(filter);
    onNavigateToCases(filter);
  };

  return (
    <div className="space-y-6">
      {/* 1) 상단 KPI 요약 바 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard 
          label="오늘 연락 필요" value={stats.contactNeeded.toLocaleString()} change="실시간" isUp={true} color="bg-blue-600" 
          onClick={() => handleDrilldown("SLA 임박")}
        />
        <KPICard 
          label="2차 대기" value={stats.stage2Waiting.toLocaleString()} change="실시간" isUp={false} color="bg-orange-500" 
          onClick={() => handleDrilldown("연계 대기")}
        />
        <KPICard 
          label="고위험 MCI" value={stats.highRiskMci.toLocaleString()} change="실시간" isUp={true} color="bg-red-600" 
          onClick={() => handleDrilldown("High MCI")}
        />
        <KPICard 
          label="3차 대기" value={stats.stage3Waiting.toLocaleString()} change="실시간" isUp={true} color="bg-purple-600" 
          onClick={() => handleDrilldown("3차 감별")}
        />
        <KPICard 
          label="이탈자" value={stats.churnRisk.toLocaleString()} change="실시간" isUp={false} color="bg-gray-500" 
          onClick={() => handleDrilldown("이탈 위험")}
        />
      </div>

      {/* 2) 단계별 파이프라인 (우선업무 위로 이동) */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-slate-50/80 p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-28 w-52 rounded-full bg-indigo-100/40 blur-3xl" />

        <div className="relative z-10 mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">단계별 파이프라인 현황</h3>
            <p className="mt-1 text-[11px] text-gray-500">각 단계를 클릭하면 해당 단계 케이스로 즉시 이동합니다.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px]">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-700">이행률 중심</span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 font-semibold text-rose-700">이탈률 모니터링</span>
          </div>
        </div>

        <div className="relative z-10 overflow-x-auto pb-1">
          <div className="grid min-w-[980px] grid-cols-5 gap-5">
            {pipelineData.map((step, idx) => {
              const tone = idx === 0
                ? "from-blue-600 to-cyan-500"
                : idx === 1
                  ? "from-indigo-600 to-blue-500"
                  : idx === 2
                    ? "from-sky-600 to-blue-500"
                    : idx === 3
                      ? "from-violet-600 to-indigo-500"
                      : "from-blue-700 to-indigo-700";

              const progressWidth = Math.max(8, Math.min(step.rate, 100));
              const isHovered = hoveredPipelineStep === step.name;

              return (
                <button
                  key={step.name}
                  onClick={() => handleDrilldown(step.name)}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") {
                      setHoveredPipelineStep(step.name);
                    }
                  }}
                  onPointerMove={(event) => {
                    if (event.pointerType !== "touch") {
                      setHoveredPipelineStep(step.name);
                    }
                  }}
                  onPointerLeave={() => setHoveredPipelineStep((prev) => (prev === step.name ? null : prev))}
                  onMouseEnter={() => setHoveredPipelineStep(step.name)}
                  onMouseLeave={() => setHoveredPipelineStep((prev) => (prev === step.name ? null : prev))}
                  onFocus={() => setHoveredPipelineStep(step.name)}
                  onBlur={() => setHoveredPipelineStep((prev) => (prev === step.name ? null : prev))}
                  className={cn(
                    "relative text-left rounded-2xl border border-slate-200 bg-white transition-all duration-200",
                    isHovered
                      ? "-translate-y-1 shadow-[0_18px_34px_rgba(37,99,235,0.22)]"
                      : "shadow-[0_14px_28px_rgba(15,23,42,0.08)]"
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-4 -bottom-2 h-3 rounded-xl blur-sm transition-colors",
                      isHovered ? "bg-blue-300/60" : "bg-slate-300/60"
                    )}
                  />
                  <div className="relative rounded-2xl">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold tracking-wide text-slate-700">{step.name}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Stage {idx + 1}</span>
                      </div>

                      <div className="mt-2 flex items-end justify-between">
                        <p className="text-2xl font-bold text-slate-900 leading-none">{step.count.toLocaleString()}</p>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">이행률</p>
                          <p className="text-sm font-bold text-blue-700">{step.rate}%</p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn("h-full rounded-full bg-gradient-to-r", tone)}
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-rose-100 bg-rose-50 px-2 py-1.5">
                          <p className="text-[10px] font-semibold text-rose-500">이탈</p>
                          <p className="text-xs font-bold text-rose-700">{step.drop}%</p>
                        </div>
                        <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5">
                          <p className="text-[10px] font-semibold text-amber-600">평균 대기</p>
                          <p className="text-xs font-bold text-amber-700">{step.wait}일</p>
                        </div>
                      </div>
                    </div>

                    {idx < 4 && (
                      <div className="pointer-events-none absolute top-1/2 -right-2 hidden -translate-y-1/2 md:flex items-center">
                        <span className="h-px w-3 bg-slate-200" />
                        <ChevronRight size={12} className="text-slate-300" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2) 오늘의 우선 업무 패널 */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} />
              오늘의 우선 업무
            </h3>
            <button 
              onClick={() => handleDrilldown("SLA 임박")}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              전체 보기 <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3 border-b border-gray-100">케이스ID</th>
                  <th className="px-5 py-3 border-b border-gray-100">연령</th>
                  <th className="px-5 py-3 border-b border-gray-100">현재 Stage</th>
                  <th className="px-5 py-3 border-b border-gray-100">핵심 사유</th>
                  <th className="px-5 py-3 border-b border-gray-100">SLA</th>
                  <th className="px-5 py-3 border-b border-gray-100 text-right">즉시 액션</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {priorityTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-4 font-mono font-medium text-gray-900 group-hover:text-blue-600 cursor-pointer" onClick={() => onSelectCase(task.id, task.stage as StageType)}>
                      {task.id}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{task.age}세</td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold border",
                        task.stage === "Stage 1" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        task.stage === "Stage 2" ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-purple-50 text-purple-700 border-purple-100"
                      )}>
                        {task.stage}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600 max-w-[200px] truncate">{task.reason}</td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold",
                        task.sla === "지연" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"
                      )}>
                        {task.sla}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="전화"><Phone size={14} /></button>
                        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="예약"><Calendar size={14} /></button>
                        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="연계"><LinkIcon size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-gray-50 text-[10px] text-gray-500 italic text-center">
            * 운영자 주석: SLA 임박 및 지연 케이스는 당일 업무 마감 전 반드시 액션을 실행해야 합니다.
          </div>
        </div>

        {/* 4) MCI 세분화 분석 */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col">
          <h3 className="font-bold text-gray-800 mb-4">MCI 세분화 분석</h3>
          <div className="flex gap-4 items-center mb-6">
            <div className="h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mciDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {mciDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 flex-1">
              {mciDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-500">{item.name} MCI</span>
                  </div>
                  <span>{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex-1 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase">고위험 MCI 리스트 (High)</p>
            {highRiskMciList.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-600">
                현재 고위험 MCI 케이스가 없습니다.
              </div>
            ) : (
              highRiskMciList.map((mci) => (
                <div key={mci.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-blue-600">{mci.id} <span className="text-gray-400 text-[10px]">({mci.age}세)</span></p>
                    <p className="text-[9px] text-red-600 font-bold">전환 가능성 {mci.probability} | {mci.period}</p>
                  </div>
                  <button 
                    onClick={() => onSelectCase(mci.id, "Stage 2")}
                    className="px-2 py-1 bg-white border border-gray-200 rounded text-[9px] font-bold text-gray-600 hover:bg-gray-100"
                  >
                    {mci.nextAction}
                  </button>
                </div>
              ))
            )}
          </div>
          <button className="mt-4 w-full py-2 bg-red-50 text-red-700 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors">
            3차 감별 권고 일괄 실행
          </button>
        </div>
      </div>

      {/* 5) 지역/성과 분석 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
            지역별 운영 밀집도 (읍/면/동)
            <div className="flex gap-2">
              <span className="text-[10px] px-2 py-0.5 bg-blue-50 rounded text-blue-700">
                {mapScope.sigLabel}
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded text-gray-500">emd 고정</span>
            </div>
          </h3>
          <GeoMapPanel
            title={`${mapScope.sigLabel} 읍/면/동 분포`}
            indicatorId="total_cases"
            year={2026}
            scope={{
              mode: "regional",
              ctprvnCodes: [mapScope.ctprvnCode],
              label: mapScope.ctprvnLabel,
            }}
            fixedLevel="emd"
            lockedSigCode={mapScope.sigCode}
            lockedSigName={mapScope.sigLabel}
            hideBreadcrumb
            variant="portal"
            mapHeight={320}
            externalColorScheme="risk"
            hideLegendPanel
            hintText="읍/면/동 단위 리스크 히트맵이 기본 표시됩니다."
            className="rounded-lg overflow-hidden"
          />
          <div className="pointer-events-none absolute left-8 top-[92px] z-10 rounded-md border border-slate-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur-sm">
            <p className="text-[11px] font-bold text-slate-700">운영 자원 분석</p>
            <div className="mt-2 space-y-1.5 text-[10px] font-semibold text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                <span>위험 (자원 부족)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                <span>주의 (수요 증가)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
                <span>정상/여유</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">주요 운영 지표 추이</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-600">
                <div className="w-2 h-2 rounded-full bg-blue-600"></div> 선별수검률
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-600">
                <div className="w-2 h-2 rounded-full bg-[#d97706]"></div> 단계이행률
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-600">
                <div className="w-2 h-2 rounded-full bg-[#059669]"></div> 감별완료율
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { date: "02/05", screen: 72, evaluation: 65, completed: 58 },
                { date: "02/06", screen: 75, evaluation: 68, completed: 55 },
                { date: "02/07", screen: 82, evaluation: 62, completed: 62 },
                { date: "02/08", screen: 80, evaluation: 70, completed: 65 },
                { date: "02/09", screen: 88, evaluation: 74, completed: 68 },
                { date: "02/10", screen: 92, evaluation: 81, completed: 72 },
                { date: "02/11", screen: 89, evaluation: 85, completed: 75 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" fontSize={9} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                <YAxis fontSize={9} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} unit="%" />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Line type="monotone" dataKey="screen" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="evaluation" stroke="#d97706" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="completed" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-around border-t border-gray-50 pt-4">
            <div className="text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase">전국 평균 편차</p>
              <p className="text-sm font-bold text-emerald-600">+4.2%</p>
            </div>
            <div className="w-px h-6 bg-gray-100"></div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase">자원 대비 수요</p>
              <p className="text-sm font-bold text-red-600">115%</p>
            </div>
          </div>
        </div>
      </div>
      <div className="p-3 bg-gray-50 text-[10px] text-gray-500 italic text-center rounded-lg">
        * 운영자 주석: 전국 평균 대비 수검률은 높으나 자원 대비 수요가 100%를 초과하고 있습니다. 고위험군 중심의 선택적 집중 관리가 필요합니다.
      </div>
    </div>
  );
}
