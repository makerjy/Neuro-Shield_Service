import { FLOW_NODES, STAGE_STAGE_TO_FLOW_INDEX } from "../constants";
import type { StageKey } from "../types";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

interface ServiceFlowRibbonProps {
  stage: StageKey;
  opsProgress: number;
  flashReflection: boolean;
}

export function ServiceFlowRibbon({ stage, opsProgress, flashReflection }: ServiceFlowRibbonProps) {
  const navigate = useNavigate();
  const activeFlowIndex = STAGE_STAGE_TO_FLOW_INDEX[stage];
  const stagesByIndex = useMemo(
    () =>
      (Object.keys(STAGE_STAGE_TO_FLOW_INDEX) as StageKey[]).sort(
        (a, b) => STAGE_STAGE_TO_FLOW_INDEX[a] - STAGE_STAGE_TO_FLOW_INDEX[b]
      ),
    []
  );

  const handleMoveStage = (index: number) => {
    const targetStage = stagesByIndex[index];
    if (!targetStage) return;
    navigate(`/demo/${targetStage}`);
  };

  return (
    <div className="flow-ribbon" role="tablist" aria-label="서비스 흐름 단계">
      {FLOW_NODES.map((node, index) => {
        const done = index < opsProgress;
        const active = index === activeFlowIndex;
        const reflectFlash = index === FLOW_NODES.length - 1 && flashReflection;

        return (
          <button
            key={node}
            type="button"
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            onClick={() => handleMoveStage(index)}
            className={[
              "flow-node",
              done ? "is-done" : "",
              active ? "is-active" : "",
              reflectFlash ? "is-reflect-flash" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="flow-node__index">{index + 1}</span>
            <span className="flow-node__label">{node}</span>
          </button>
        );
      })}
    </div>
  );
}
