import React, { useState } from "react";
import { 
  Shield, 
  Bell, 
  Clock, 
  Database, 
  Lock, 
  Info,
  ChevronRight,
  ShieldAlert,
  History,
  AlertCircle,
  Eye,
  FileText
} from "lucide-react";
import { cn } from "./shared";

export function SettingsView() {
  const [activeSubTab, setActiveSubTab] = useState("임계치");

  const sections = [
    {
      title: "임계치 설정 (행정 기준)",
      id: "임계치",
      icon: Clock,
      items: [
        { label: "장기 대기 기준일 (Stage 1)", value: "3일", type: "number", desc: "선별 후 2차 연계 대기 시간이 이 값을 초과하면 경고 발생" },
        { label: "SLA 임박 기준 (연락/예약)", value: "24시간", type: "number", desc: "업무 마감 전 SLA 경고가 노출되는 시점" },
        { label: "재평가 트리거 (점수 하락)", value: "10%", type: "number", desc: "직전 대비 하락폭이 이 값을 초과하면 자동 트리거 활성화" },
        { label: "이탈 위험 판단 (미접촉)", value: "3회", type: "number", desc: "연속 연락 실패 횟수 기준" },
      ]
    },
    {
      title: "알림 및 보고서 설정",
      id: "알림",
      icon: Bell,
      items: [
        { label: "이탈 위험 실시간 알림", value: "On", type: "toggle" },
        { label: "데이터 품질 경고 상시 노출", value: "On", type: "toggle" },
        { label: "재평가 지연 관리자 보고", value: "Off", type: "toggle" },
        { label: "매주 운영 성과 리포트 발송", value: "On", type: "toggle" },
      ]
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex gap-1 border-b border-gray-200">
        {["임계치", "알림", "권한/보안", "감사로그"].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveSubTab(tab)}
            className={cn(
              "px-6 py-3 text-sm font-bold border-b-2 transition-all",
              activeSubTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Settings List */}
        <div className="col-span-8 space-y-8">
          {sections.map((section, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                <section.icon className="text-blue-600" size={20} />
                <h3 className="font-bold text-gray-800">{section.title}</h3>
              </div>
              <div className="p-0">
                {section.items.map((item, iIdx) => (
                  <div key={iIdx} className="p-5 flex items-start justify-between border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <div className="max-w-[70%]">
                      <p className="text-sm font-bold text-gray-700">{item.label}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {item.type === "number" ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={item.value} 
                            readOnly 
                            className="w-16 text-right px-2 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-blue-600"
                          />
                          <button className="text-[10px] font-bold text-blue-600 hover:underline">수정</button>
                        </div>
                      ) : (
                        <div className={cn(
                          "w-10 h-5 rounded-full relative cursor-pointer transition-colors shadow-inner",
                          item.value === "On" ? "bg-emerald-500" : "bg-gray-200"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform",
                            item.value === "On" ? "translate-x-5.5" : "translate-x-0.5"
                          )}></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Policies & Info */}
        <div className="col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
              <ShieldAlert className="text-orange-500" size={20} />
              권한 및 보안
            </h3>
            <div className="space-y-4">
              <div className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <Lock size={14} className="text-gray-400" />
                  <p className="text-[10px] font-bold text-gray-400 uppercase">민감정보 열람권한</p>
                </div>
                <p className="text-sm font-bold text-gray-900 leading-tight">센터장, 케이스매니저 (L2 이상)</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">2FA 활성화</span>
                  <button className="text-[10px] font-bold text-blue-600 hover:underline">대상자 설정</button>
                </div>
              </div>
              <div className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <Database size={14} className="text-gray-400" />
                  <p className="text-[10px] font-bold text-gray-400 uppercase">데이터 보존 및 폐기</p>
                </div>
                <p className="text-sm font-bold text-gray-900">종결 후 5년 (법정기간 준수)</p>
                <p className="text-[9px] text-gray-400 mt-2">차기 폐기 예정일: 2026-12-31</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <History size={120} />
             </div>
             <div className="relative z-10">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <History className="text-blue-400" size={20} />
                  감사로그 정책 안내
                </h3>
                <div className="space-y-4 text-xs leading-relaxed text-white/70">
                  <p>모든 데이터 열람, 수정, 내보내기 행위는 사용자 ID, IP 주소, 시간 정보와 함께 암호화되어 영구 기록됩니다.</p>
                  <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                    <p className="text-[10px] font-bold text-blue-400 uppercase mb-1 flex items-center gap-1">
                      <Eye size={10} /> 실시간 모니터링 중
                    </p>
                    <p className="text-white/80">참고 분류(Stage 2) 열람 시에는 즉시 상위 관리자에게 알림이 전송됩니다.</p>
                  </div>
                  <p>감사로그는 무결성 검증 시스템에 의해 보호되며 임의 삭제가 불가능합니다.</p>
                </div>
                <button className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition-all">
                  전체 감사 로그 아카이브 조회
                </button>
             </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border border-gray-200 rounded-xl flex items-center gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
          <AlertCircle size={24} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-900">시스템 설정 변경 안내</h4>
          <p className="text-xs text-gray-500 mt-0.5">설정된 임계치나 트리거 기준 변경 시, 즉시 기존 케이스들의 위험 등급이 재계산될 수 있습니다. (전산팀 승인 필요)</p>
        </div>
      </div>
    </div>
  );
}
