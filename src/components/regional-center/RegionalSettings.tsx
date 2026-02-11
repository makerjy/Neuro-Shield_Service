import React, { useState, useMemo, useCallback } from 'react';
import { Save, ShieldCheck, Bell, Sliders, BookOpen, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  loadRegionalSettings,
  saveRegionalSettings,
  DEFAULT_REGIONAL_SETTINGS,
  type RegionalSettingsData,
  type RiskWeightConfig,
} from '../../lib/regionalKpiDictionary';

/* ═══════════════════════════════════════════════════════════════
   RegionalSettings — 광역센터 설정 페이지
   섹션 4개: 운영 기준(읽기전용) / 임계치·룰 / 알림 / 권한
   localStorage 기반 저장, region scope 네임스페이스
═══════════════════════════════════════════════════════════════ */

interface RegionalSettingsProps {
  regionCode: string;
  regionLabel: string;
  userRole?: string; // 'center_director' | 'operator' etc.
}

export function RegionalSettings({ regionCode, regionLabel, userRole = 'center_director' }: RegionalSettingsProps) {
  const isDirector = userRole === 'center_director';
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<RegionalSettingsData>(() => loadRegionalSettings(regionCode));

  /* ── 핸들러 ── */
  const updateThreshold = useCallback((key: keyof RegionalSettingsData['thresholds'], value: number) => {
    setSettings(prev => ({ ...prev, thresholds: { ...prev.thresholds, [key]: value } }));
    setSaved(false);
  }, []);

  const updateWeight = useCallback((key: keyof RiskWeightConfig, value: number) => {
    setSettings(prev => ({ ...prev, weights: { ...prev.weights, [key]: value } }));
    setSaved(false);
  }, []);

  const toggleNotification = useCallback((key: keyof RegionalSettingsData['notifications']) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: !prev.notifications[key] },
    }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    saveRegionalSettings(regionCode, settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [regionCode, settings]);

  const handleReset = useCallback(() => {
    setSettings({ ...DEFAULT_REGIONAL_SETTINGS });
    setSaved(false);
  }, []);

  const weightSum = useMemo(() => {
    const w = settings.weights;
    return Number((w.slaBreachRate + w.notReachedRate + w.avgWaitTimeNorm + w.longWaitRate).toFixed(2));
  }, [settings.weights]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">설정</h2>
          <p className="text-sm text-gray-500 mt-0.5">{regionLabel} 광역센터 · 운영 대시보드 설정</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium animate-pulse">
              <CheckCircle className="h-4 w-4" /> 저장 완료
            </span>
          )}
          <button
            onClick={handleReset}
            disabled={!isDirector}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            기본값 복원
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirector}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            저장
          </button>
        </div>
      </div>

      {/* ═══ 1. 운영 기준 (읽기 전용) ═══ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-4.5 w-4.5 text-indigo-600" />
          <h3 className="text-sm font-bold text-gray-800">운영 기준</h3>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">읽기 전용</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="text-[10px] text-indigo-500 font-medium mb-1">집계 단위</div>
            <div className="text-sm font-semibold text-indigo-800">case_id (배정 케이스)</div>
            <div className="text-[10px] text-indigo-400 mt-1">동일 시민·사건의 복수 신호 → 1건 병합</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="text-[10px] text-indigo-500 font-medium mb-1">중복 제거</div>
            <div className="text-sm font-semibold text-indigo-800">event_id/signal_id 자동 병합</div>
            <div className="text-[10px] text-indigo-400 mt-1">광역 화면에서 signal 기반 지표 숨김</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="text-[10px] text-indigo-500 font-medium mb-1">기간 필터 적용</div>
            <div className="text-sm font-semibold text-indigo-800">전체 패널 동일 적용</div>
            <div className="text-[10px] text-indigo-400 mt-1">상단 KPI · 지도 · 우측 차트 · 테이블</div>
          </div>
        </div>
      </section>

      {/* ═══ 2. 임계치 / 룰 (편집 가능) ═══ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-4.5 w-4.5 text-orange-600" />
          <h3 className="text-sm font-bold text-gray-800">임계치 / 룰</h3>
          {!isDirector && <Lock className="h-3.5 w-3.5 text-gray-400" />}
        </div>

        {/* 임계치 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">장기 대기 기준일 (thresholdDays)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={90}
                value={settings.thresholds.longWaitDays}
                onChange={e => updateThreshold('longWaitDays', Number(e.target.value))}
                disabled={!isDirector}
                className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-xs text-gray-500">일</span>
              <span className="text-[10px] text-gray-400 ml-2">배정 후 {settings.thresholds.longWaitDays}일 이상 미처리 시 "장기 대기"</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">SLA 임박 기준일 (slaNearDays)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={settings.thresholds.slaNearDays}
                onChange={e => updateThreshold('slaNearDays', Number(e.target.value))}
                disabled={!isDirector}
                className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-xs text-gray-500">일</span>
              <span className="text-[10px] text-gray-400 ml-2">SLA 마감 {settings.thresholds.slaNearDays}일 전부터 "임박"</span>
            </div>
          </div>
        </div>

        {/* 가중치 */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-700">Top5 리스크 가중치 (w1~w4)</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${weightSum === 1 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              합계: {weightSum} {weightSum === 1 ? '✓' : '≠ 1.00'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'slaBreachRate' as const, label: 'w1 · SLA 위반률', color: 'text-red-600' },
              { key: 'notReachedRate' as const, label: 'w2 · 미접촉률', color: 'text-orange-600' },
              { key: 'avgWaitTimeNorm' as const, label: 'w3 · 대기시간', color: 'text-purple-600' },
              { key: 'longWaitRate' as const, label: 'w4 · 장기대기률', color: 'text-blue-600' },
            ].map(({ key, label, color }) => (
              <div key={key}>
                <label className={`text-[10px] font-medium ${color} block mb-1`}>{label}</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.weights[key]}
                  onChange={e => updateWeight(key, Number(e.target.value))}
                  disabled={!isDirector}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-gray-400">
            risk_score = w1·SLA위반률 + w2·미접촉률 + w3·대기시간(정규화) + w4·장기대기률
          </div>
        </div>
      </section>

      {/* ═══ 3. 알림 설정 ═══ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4.5 w-4.5 text-yellow-600" />
          <h3 className="text-sm font-bold text-gray-800">알림 설정</h3>
          {!isDirector && <Lock className="h-3.5 w-3.5 text-gray-400" />}
        </div>
        <div className="space-y-3">
          {[
            { key: 'slaBreachAlert' as const, label: 'SLA 위반 알림', desc: 'SLA 위반 발생 시 즉시 알림', ready: true },
            { key: 'slaImminentAlert' as const, label: 'SLA 임박 알림', desc: 'SLA 마감 N일 전 경고', ready: true },
            { key: 'longWaitSurge' as const, label: '장기대기 급증 알림', desc: '장기대기 건수가 전주 대비 30% 이상 증가 시', ready: false },
            { key: 'riskIncrease' as const, label: '리스크 상승 알림', desc: '시군구 리스크 점수가 임계치 초과 시', ready: false },
          ].map(({ key, label, desc, ready }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-4 w-4 ${settings.notifications[key] ? 'text-yellow-500' : 'text-gray-300'}`} />
                <div>
                  <div className="text-xs font-medium text-gray-800 flex items-center gap-1.5">
                    {label}
                    {!ready && <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">준비중</span>}
                  </div>
                  <div className="text-[10px] text-gray-500">{desc}</div>
                </div>
              </div>
              <button
                onClick={() => toggleNotification(key)}
                disabled={!isDirector}
                className={`relative w-10 h-5.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  settings.notifications[key] ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                style={{ height: '22px' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                  style={{ left: settings.notifications[key] ? '22px' : '2px' }}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ 4. 권한 / 역할 ═══ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-4.5 w-4.5 text-green-600" />
          <h3 className="text-sm font-bold text-gray-800">권한 / 역할</h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">장</span>
              <div>
                <div className="text-xs font-medium text-green-800">센터장</div>
                <div className="text-[10px] text-green-600">임계치·가중치·알림 설정 변경 가능</div>
              </div>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDirector ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {isDirector ? '현재 역할' : ''}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-[10px] font-bold">운</span>
              <div>
                <div className="text-xs font-medium text-gray-700">운영 담당자</div>
                <div className="text-[10px] text-gray-500">설정 조회만 가능 · 변경 불가</div>
              </div>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${!isDirector ? 'bg-gray-100 text-gray-600' : ''}`}>
              {!isDirector ? '현재 역할' : ''}
            </span>
          </div>
        </div>
        <div className="mt-3 text-[10px] text-gray-400">
          저장 위치: localStorage · regional.settings.{regionCode}.* · 브라우저 로컬에만 저장됩니다
        </div>
      </section>
    </div>
  );
}
