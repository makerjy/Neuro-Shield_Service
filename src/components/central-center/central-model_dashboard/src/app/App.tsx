import { Users, Activity, ClipboardCheck, TrendingUp, Building2 } from 'lucide-react';
import { StatusCard } from './components/StatusCard';
import { PipelineFlow } from './components/PipelineFlow';
import { PrimaryScreening } from './components/PrimaryScreening';
import { SecondaryScreening } from './components/SecondaryScreening';
import { RegionalHeatmap } from './components/RegionalHeatmap';
import { AgeCohorts } from './components/AgeCohorts';
import { ModelExplainability } from './components/ModelExplainability';
import {
  globalStatus,
  pipelineStages,
  primaryScreeningData,
  secondaryScreeningData,
  regionalData,
  ageCohortsData,
  modelExplainabilityData,
  policyLogs
} from './data/mockData';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 헤더 */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">중앙관리센터</h1>
              <p className="mt-1 text-sm text-slate-600">모델 적용 대시보드 · 운영 감시, 정책 방어, 책임 추적</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="rounded bg-slate-100 px-2 py-1">최종 업데이트: 2026-02-06 09:00</span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* 1. 전역 상태 요약 */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">
              전역 상태 요약
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatusCard
                title="전체 대상자 수"
                value={globalStatus.totalSubjects.toLocaleString()}
                subtitle="가명 처리됨"
                icon={Users}
                status="neutral"
              />
              <StatusCard
                title="1차 검사 적용률"
                value={`${globalStatus.primaryScreeningRate}%`}
                subtitle={`${(globalStatus.totalSubjects * globalStatus.primaryScreeningRate / 100).toLocaleString()}명`}
                icon={Activity}
                status="normal"
                percentage={globalStatus.primaryScreeningRate}
              />
              <StatusCard
                title="2차 검사 적용률"
                value={`${globalStatus.secondaryScreeningRate}%`}
                subtitle={`${(globalStatus.totalSubjects * globalStatus.secondaryScreeningRate / 100).toLocaleString()}명`}
                icon={ClipboardCheck}
                status="caution"
                percentage={globalStatus.secondaryScreeningRate}
              />
              <StatusCard
                title="2차 전환율"
                value={`${globalStatus.conversionRate}%`}
                subtitle="1차 고위험 → 2차"
                icon={TrendingUp}
                status="normal"
                percentage={globalStatus.conversionRate}
              />
              <StatusCard
                title="관할 센터 수"
                value={globalStatus.centerCount.basic + globalStatus.centerCount.regional}
                subtitle={`기초 ${globalStatus.centerCount.basic} · 광역 ${globalStatus.centerCount.regional}`}
                icon={Building2}
                status="neutral"
              />
            </div>
          </section>

          {/* 2. 모델 적용 단계별 플로우 */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">
              모델 적용 단계
            </h2>
            <PipelineFlow stages={pipelineStages} />
          </section>

          {/* 3. 1차 검사 */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">
              1차 검사 분석
            </h2>
            <PrimaryScreening data={primaryScreeningData} />
          </section>

          {/* 4. 2차 검사 */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">
              2차 검사 분석
            </h2>
            <SecondaryScreening data={secondaryScreeningData} />
          </section>

          {/* 5. 지역/센터 비교 */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">
              지역/센터 담당자 관점
            </h2>
            <RegionalHeatmap data={regionalData} />
          </section>

          {/* 6. 연령 코호트 */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">
              연령 코호트 분석
            </h2>
            <AgeCohorts data={ageCohortsData} />
          </section>

          {/* 7. 설명가능성 & 정책 감사 */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">
              설명가능성 & 정책 감사
            </h2>
            <ModelExplainability data={modelExplainabilityData} policyLogs={policyLogs} />
          </section>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-slate-600">
              © 2026 중앙관리센터. 모든 데이터는 집계/비식별 처리되었습니다.
            </p>
            <div className="flex gap-4 text-sm text-slate-500">
              <span>개인 상세 화면 없음</span>
              <span>•</span>
              <span>책임 추적 시스템 운영</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
