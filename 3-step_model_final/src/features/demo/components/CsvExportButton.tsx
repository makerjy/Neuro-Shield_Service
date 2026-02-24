import { exportToCsv } from "../utils/exportToCsv";
import type { ActiveCaseState, DemoDatasetRow, StageKey, StageResult } from "../types";

interface CsvExportButtonProps {
  stage: StageKey;
  activeCase: ActiveCaseState;
  result?: StageResult;
  onExport: (filename: string, rows: number) => void;
}

function buildExportRows(stage: StageKey, activeCase: ActiveCaseState, result: StageResult): DemoDatasetRow[] {
  if (stage === "stage1" && result.stage === "stage1") {
    const row = result.output;
    return [
      {
        PTID: row.PTID,
        label: row.label,
        target: row.target,
        DIAGNOSIS_str: row.DIAGNOSIS_str,
        DM_Probability: row.DM_Probability,
        MCI_Probability: row.MCI_Probability,
        CN_Probability: row.CN_Probability,
        Impairment_Probability: row.Impairment_Probability,
        Predicted_Label: row.Predicted_Label,
        Interest_Category: row.Interest_Category,
        Caregiver_Available: row.Caregiver_Available,
        Priority_Score: row.Priority_Score,
        Priority_AgeScore: result.priorityScoring.age,
        Priority_MCIRiskScore: result.priorityScoring.mciRisk,
        Priority_DMRiskScore: result.priorityScoring.dmRisk,
        Priority_ImpairmentBoostScore: result.priorityScoring.impairmentBoost,
        Priority_CaregiverScore: result.priorityScoring.caregiver,
        Priority_GuardrailTriggered: result.priorityScoring.guardrailTriggered ? 1 : 0,
      },
    ];
  }

  if (stage === "stage2" && result.stage === "stage2") {
    return [
      {
        caseId: activeCase.caseId,
        PTID: activeCase.ptid,
        Predicted_Class: result.output.Predicted_Class,
        Probabilities: JSON.stringify(result.output.Probabilities),
        LOW_MCI: result.output.Probabilities.LOW_MCI,
        HIGH_MCI: result.output.Probabilities.HIGH_MCI,
        AD: result.output.Probabilities.AD,
      },
    ];
  }

  if (result.stage === "stage3") {
    return [
      {
        caseId: activeCase.caseId,
        PTID: activeCase.ptid,
        Year1_ConversionRisk: result.output.Year1_ConversionRisk,
        Year2_ConversionRisk: result.output.Year2_ConversionRisk,
        Conversion_12mo: result.output.Conversion_12mo ?? null,
        Conversion_24mo: result.output.Conversion_24mo ?? null,
        Conversion_36mo: result.output.Conversion_36mo ?? null,
        Conversion_48mo: result.output.Conversion_48mo ?? null,
        CNN_Biomarker_Score: result.output.CNN_Biomarker_Score,
        Fusion_Score: result.output.Fusion_Score,
        ANN_AD_Probability: result.output.ANN_AD_Probability ?? null,
        Ensemble_AD_Probability: result.output.Ensemble_AD_Probability ?? null,
        Predicted_Label: result.output.Predicted_Label ?? "",
        Predicted_Binary: result.output.Predicted_Binary ?? null,
        Ensemble_Risk_Grade: result.output.Ensemble_Risk_Grade ?? "",
        Survival_Risk_Grade: result.output.Survival_Risk_Grade ?? "",
        Model_Source: result.output.Model_Source ?? "",
        Pipeline_RunId: result.output.Pipeline_RunId ?? "",
        Pipeline_Note: result.output.Pipeline_Note ?? "",
        CNN_InferenceSource: result.output.CNN_InferenceSource ?? "",
        CNN_Top_Class: result.output.CNN_Top_Class ?? "",
        CNN_Confidence: result.output.CNN_Confidence ?? null,
        CNN_RunId: result.output.CNN_RunId ?? "",
        CNN_SampleId: result.output.CNN_SampleId ?? "",
        CNN_ClassProbabilities: result.output.CNN_ClassProbabilities
          ? JSON.stringify(result.output.CNN_ClassProbabilities)
          : "",
        TrackingSeries: JSON.stringify(result.output.TrackingSeries),
      },
    ];
  }

  return [];
}

export function CsvExportButton({ stage, activeCase, result, onExport }: CsvExportButtonProps) {
  const disabled = !result;

  const handleExport = () => {
    if (!result) return;
    const rows = buildExportRows(stage, activeCase, result);
    const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
    const filename = `${stage}_${activeCase.caseId}_${timestamp}.csv`;

    exportToCsv(rows, filename);
    onExport(filename, rows.length);
  };

  return (
    <button type="button" className="btn btn-primary" disabled={disabled} onClick={handleExport}>
      CSV 저장
    </button>
  );
}
