import React, { useCallback, useMemo, useState } from 'react';
import {
  Save,
  RotateCcw,
  CheckCircle2,
  Sliders,
  Bell,
  Lock,
  ShieldCheck,
  Gauge,
  LayoutTemplate,
  Database,
} from 'lucide-react';
import {
  loadCentralSettings,
  saveCentralSettings,
  resetCentralSettings,
  DEFAULT_CENTRAL_SETTINGS,
  type CentralDefaultPeriod,
  type CentralSettingsData,
} from '../../lib/centralSettings';

interface CentralSettingsProps {
  userRole: 'central_admin' | 'policy_maker';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function CentralSettings({ userRole }: CentralSettingsProps) {
  const canEdit = userRole === 'central_admin';
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<CentralSettingsData>(() => loadCentralSettings());

  const updateMatrix = useCallback((key: keyof CentralSettingsData['matrixThresholds'], value: number) => {
    setSettings((prev) => ({
      ...prev,
      matrixThresholds: {
        ...prev.matrixThresholds,
        [key]: clamp(value, 70, 99),
      },
    }));
    setSaved(false);
  }, []);

  const updateHeadline = useCallback((key: keyof CentralSettingsData['headline'], value: number | boolean) => {
    setSettings((prev) => ({
      ...prev,
      headline: {
        ...prev.headline,
        [key]: value,
      },
    }));
    setSaved(false);
  }, []);

  const toggleDrilldown = useCallback((key: keyof CentralSettingsData['drilldown']) => {
    setSettings((prev) => ({
      ...prev,
      drilldown: {
        ...prev.drilldown,
        [key]: !prev.drilldown[key],
      },
    }));
    setSaved(false);
  }, []);

  const toggleNotification = useCallback((key: keyof CentralSettingsData['notifications']) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      },
    }));
    setSaved(false);
  }, []);

  const updateReportPeriod = useCallback((value: CentralDefaultPeriod) => {
    setSettings((prev) => ({
      ...prev,
      reports: {
        ...prev.reports,
        defaultPeriod: value,
      },
    }));
    setSaved(false);
  }, []);

  const toggleReportOption = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      reports: {
        ...prev.reports,
        includeFilterContext: !prev.reports.includeFilterContext,
      },
    }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    saveCentralSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [settings]);

  const handleReset = useCallback(() => {
    const reset = resetCentralSettings();
    setSettings(reset);
    setSaved(false);
  }, []);

  const matrixSummary = useMemo(() => {
    const gap = Math.abs(settings.matrixThresholds.slaCut - settings.matrixThresholds.dataCut);
    if (gap <= 1) return '균형 기준선';
    if (settings.matrixThresholds.slaCut > settings.matrixThresholds.dataCut) return 'SLA 기준이 더 엄격';
    return '데이터 기준이 더 엄격';
  }, [settings.matrixThresholds.dataCut, settings.matrixThresholds.slaCut]);

  const roleLabel = canEdit ? '중앙 관리자' : '정책 담당자';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">중앙센터 설정</h2>
          <p className="text-sm text-gray-500 mt-0.5">기준선 · 우선조치 노출 · 알림/리포트 정책을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium animate-pulse">
              <CheckCircle2 className="h-4 w-4" />
              저장 완료
            </span>
          )}
          <button
            type="button"
            onClick={handleReset}
            disabled={!canEdit}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            기본값 복원
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canEdit}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            저장
          </button>
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <LayoutTemplate className="h-4.5 w-4.5 text-indigo-600" />
          <h3 className="text-sm font-bold text-gray-800">운영 원칙</h3>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">기준 안내</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="text-[10px] text-indigo-500 font-medium mb-1">집계 원칙</div>
            <div className="text-sm font-semibold text-indigo-800">D-1 배치 기준</div>
            <div className="text-[10px] text-indigo-400 mt-1">실시간 지표가 아닌 일 단위 운영 집계로 해석합니다.</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="text-[10px] text-indigo-500 font-medium mb-1">시각화 원칙</div>
            <div className="text-sm font-semibold text-indigo-800">부분 로딩 우선</div>
            <div className="text-[10px] text-indigo-400 mt-1">패널 깜빡임 없이 기존 값 유지 후 업데이트합니다.</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="text-[10px] text-indigo-500 font-medium mb-1">로그 정책</div>
            <div className="text-sm font-semibold text-indigo-800">감사 추적 가능</div>
            <div className="text-[10px] text-indigo-400 mt-1">설정값은 브라우저 저장소에 보관되며 복원 가능합니다.</div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="h-4.5 w-4.5 text-orange-600" />
          <h3 className="text-sm font-bold text-gray-800">SLA × 데이터 충족률 기준선</h3>
          {!canEdit && <Lock className="h-3.5 w-3.5 text-gray-400" />}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 ml-auto">{matrixSummary}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">SLA 기준선 (%)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={70}
                max={99}
                value={settings.matrixThresholds.slaCut}
                onChange={(e) => updateMatrix('slaCut', Number(e.target.value))}
                disabled={!canEdit}
                className="w-full accent-blue-600 disabled:opacity-40"
              />
              <input
                type="number"
                min={70}
                max={99}
                value={settings.matrixThresholds.slaCut}
                onChange={(e) => updateMatrix('slaCut', Number(e.target.value) || settings.matrixThresholds.slaCut)}
                disabled={!canEdit}
                className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">데이터 기준선 (%)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={70}
                max={99}
                value={settings.matrixThresholds.dataCut}
                onChange={(e) => updateMatrix('dataCut', Number(e.target.value))}
                disabled={!canEdit}
                className="w-full accent-emerald-600 disabled:opacity-40"
              />
              <input
                type="number"
                min={70}
                max={99}
                value={settings.matrixThresholds.dataCut}
                onChange={(e) => updateMatrix('dataCut', Number(e.target.value) || settings.matrixThresholds.dataCut)}
                disabled={!canEdit}
                className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-gray-500">
          저장 후 대시보드 재진입 시 매트릭스 기준선과 사분면 분류에 반영됩니다.
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-4.5 w-4.5 text-blue-600" />
          <h3 className="text-sm font-bold text-gray-800">우선조치/드릴다운 동작</h3>
          {!canEdit && <Lock className="h-3.5 w-3.5 text-gray-400" />}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-100 p-3">
            <label className="text-xs font-medium text-gray-700 block mb-2">우선 점검 노출 개수</label>
            <input
              type="number"
              min={1}
              max={5}
              value={settings.headline.maxItems}
              onChange={(e) => updateHeadline('maxItems', clamp(Number(e.target.value) || 1, 1, 5))}
              disabled={!canEdit}
              className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <div className="text-[10px] text-gray-500 mt-1">상단 “이번 주 우선 점검” 칩 개수</div>
          </div>
          <div className="rounded-lg border border-gray-100 p-3 space-y-2">
            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={settings.headline.includePartialBadge}
                onChange={(e) => updateHeadline('includePartialBadge', e.target.checked)}
                disabled={!canEdit}
                className="accent-blue-600"
              />
              부분 집계 배지 노출
            </label>
            <div className="text-[10px] text-gray-500">우선 점검 영역에 부분 집계 가능성 배지를 함께 표시</div>
          </div>
          {[
            { key: 'keepPreviousData' as const, label: '이전 데이터 유지(keepPreviousData)', desc: '범위 변경 시 값 사라짐 없이 전환' },
            { key: 'prefetchEnabled' as const, label: '드릴다운 프리페치', desc: '예상 하위 범위 데이터를 사전 로드' },
            { key: 'useScopeOverlay' as const, label: '스코프 전환 오버레이', desc: '로딩 시 얇은 오버레이로 전환 상태 표시' },
          ].map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => toggleDrilldown(item.key)}
              disabled={!canEdit}
              className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                settings.drilldown[item.key]
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="text-xs font-semibold text-gray-800">{item.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4.5 w-4.5 text-amber-600" />
          <h3 className="text-sm font-bold text-gray-800">알림/보고 정책</h3>
          {!canEdit && <Lock className="h-3.5 w-3.5 text-gray-400" />}
        </div>
        <div className="space-y-3">
          {[
            { key: 'batchDelayed' as const, label: '배치 지연 알림', desc: 'D-1 배치 지연 또는 부분 완료 감지 시 알림' },
            { key: 'qualityRisk' as const, label: '품질 위험 알림', desc: '품질 탭 위험 범위 지표 증가 시 알림' },
            { key: 'governanceGap' as const, label: '거버넌스 누락 알림', desc: '감사 필수 항목 누락 구간 발생 시 알림' },
            { key: 'policyImpactSpike' as const, label: '정책 영향 급증 알림', desc: '정책 영향 지표 급등 시 검토 알림' },
          ].map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => toggleNotification(item.key)}
              disabled={!canEdit}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                settings.notifications[item.key]
                  ? 'border-amber-200 bg-amber-50/70'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="text-xs font-semibold text-gray-800">{item.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-100 p-3">
            <label className="text-xs font-medium text-gray-700 block mb-1">기본 기간 필터</label>
            <select
              value={settings.reports.defaultPeriod}
              onChange={(e) => updateReportPeriod(e.target.value as CentralDefaultPeriod)}
              disabled={!canEdit}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="weekly">주간</option>
              <option value="monthly">월간</option>
              <option value="quarterly">분기</option>
              <option value="yearly_cum">연간(누적)</option>
            </select>
          </div>
          <div className="rounded-lg border border-gray-100 p-3">
            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={settings.reports.includeFilterContext}
                onChange={toggleReportOption}
                disabled={!canEdit}
                className="accent-amber-600"
              />
              다운로드 시 현재 필터 컨텍스트 포함
            </label>
            <div className="text-[10px] text-gray-500 mt-1">KPI/기간/스코프/사분면 기준값을 CSV 헤더에 포함</div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-4.5 w-4.5 text-green-600" />
          <h3 className="text-sm font-bold text-gray-800">권한 및 저장 위치</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="text-xs font-semibold text-green-800">중앙 관리자</div>
            <div className="text-[10px] text-green-700 mt-1">설정 조회/수정/저장/복원 가능</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-800">정책 담당자</div>
            <div className="text-[10px] text-gray-600 mt-1">설정 조회만 가능 (변경 불가)</div>
          </div>
        </div>
        <div className="mt-3 text-[10px] text-gray-400 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" />
          저장 키: central.settings.v1 · 현재 역할: {roleLabel} · 기본값: SLA {DEFAULT_CENTRAL_SETTINGS.matrixThresholds.slaCut}% / 데이터 {DEFAULT_CENTRAL_SETTINGS.matrixThresholds.dataCut}%
        </div>
      </section>
    </div>
  );
}
