import { Navigate, Route, Routes } from "react-router-dom";
import { DemoLandingPage } from "./features/demo/pages/DemoLandingPage";
import { StagePage } from "./features/demo/pages/StagePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/demo" replace />} />
      <Route path="/demo" element={<DemoLandingPage />} />
      <Route path="/demo/stage1" element={<StagePage stage="stage1" />} />
      <Route path="/demo/stage2" element={<StagePage stage="stage2" />} />
      <Route path="/demo/stage3" element={<StagePage stage="stage3" />} />
      <Route path="*" element={<Navigate to="/demo" replace />} />
    </Routes>
  );
}
