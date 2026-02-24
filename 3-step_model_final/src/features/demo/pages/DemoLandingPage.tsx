import { useNavigate } from "react-router-dom";
import { StageSelectCard } from "../components/StageSelectCard";
import { ServiceFlowRibbon } from "../components/ServiceFlowRibbon";
import { STAGE_CARD_COPY } from "../constants";
import { useDemoContext } from "../context/DemoContext";
import type { StageKey } from "../types";

export function DemoLandingPage() {
  const navigate = useNavigate();
  const { demoMode, setDemoMode, runSeed, opsProgress, flashReflection, setCurrentStage } = useDemoContext();

  const enterStage = (stage: StageKey, autoRun: boolean) => {
    setCurrentStage(stage);
    const suffix = autoRun ? `?autorun=1&seed=${runSeed}` : "";
    navigate(`/demo/${stage}${suffix}`);
  };

  return (
    <div className="demo-page landing-page">
      <header className="landing-header">
        <div>
          <p className="eyebrow">Model Demo Center</p>
          <h1>3-Stage 치매 고위험군 발굴/관리 시연센터</h1>
          <p className="muted">모델 선택 → 입력 확인 → 파이프라인 진행 → 결과/저장 → 다음 Stage 연계를 한 화면에서 시연합니다.</p>
        </div>
        <label className="toggle-row" htmlFor="demo-mode">
          <span>Demo Mode</span>
          <input
            id="demo-mode"
            type="checkbox"
            checked={demoMode}
            onChange={(event) => setDemoMode(event.target.checked)}
          />
          <strong>{demoMode ? "ON" : "OFF"}</strong>
        </label>
      </header>

      <ServiceFlowRibbon stage="stage1" opsProgress={opsProgress} flashReflection={flashReflection} />

      <section className="stage-card-grid">
        {(Object.keys(STAGE_CARD_COPY) as StageKey[]).map((stage) => (
          <StageSelectCard
            key={stage}
            stage={stage}
            title={STAGE_CARD_COPY[stage].title}
            subtitle={STAGE_CARD_COPY[stage].subtitle}
            io={STAGE_CARD_COPY[stage].io}
            onDemoRun={(target) => enterStage(target, true)}
            onEnter={(target) => enterStage(target, false)}
          />
        ))}
      </section>
    </div>
  );
}
