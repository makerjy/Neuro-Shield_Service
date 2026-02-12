/* ──────────────────────────────────────────────────────────
   모델 적용 센터 – 전면 개편 (2026-02 v2)
   기존 central-model_dashboard 래퍼를 교체하고
   신규 ModelCenterPage 로 전환
   ────────────────────────────────────────────────────────── */
import ModelCenterPage from './model-center/ModelCenterPage';

export default function ModelApplyDashboard() {
  return <ModelCenterPage />;
}

