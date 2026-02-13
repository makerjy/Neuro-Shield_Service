export type WorkflowStepStatus = "neutral" | "good" | "warn" | "bad";

export type WorkflowStep = {
  id: string;
  title: string;
  value: number | string;
  subLabel?: string;
  percentOfTotal?: number;
  conversionFromPrev?: number;
  status?: WorkflowStepStatus;
  onClick?: () => void;
  helperText?: string;
};

