import { STAGE_LABELS } from "../constants";
import type { ExportHistoryItem } from "../types";

interface ExportHistoryPanelProps {
  items: ExportHistoryItem[];
}

export function ExportHistoryPanel({ items }: ExportHistoryPanelProps) {
  return (
    <section className="history-panel">
      <h4>저장 히스토리 (최근 5개)</h4>
      {items.length === 0 && <p className="muted">저장 이력이 없습니다.</p>}
      {items.length > 0 && (
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.id}>
              <p>
                <strong>{STAGE_LABELS[item.stage]}</strong> · {item.caseId}
              </p>
              <p>{item.filename}</p>
              <p>
                {new Date(item.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · {item.rows}행
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
