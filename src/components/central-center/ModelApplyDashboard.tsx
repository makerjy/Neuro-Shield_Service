// 원본 central-model_dashboard 프로젝트를 그대로 사용
// 원본 styles 폴더의 디자인(theme.css CSS 변수)을 scope하여 적용
import './model-dashboard-theme.css';
import OriginalApp from './central-model_dashboard/src/app/App';

export default function ModelApplyDashboard() {
  return (
    <div className="model-dashboard-scope h-full overflow-y-auto">
      <OriginalApp />
    </div>
  );
}

