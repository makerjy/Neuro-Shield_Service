import React from 'react';
import { InfoTooltip } from './InfoTooltip';
import type { MetricHelp } from './MetricDictionary';

type MetricLabelProps = {
  label: string;
  help: MetricHelp;
  onActionClick?: () => void;
  className?: string;
};

export function MetricLabel({
  label,
  help,
  onActionClick,
  className,
}: MetricLabelProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <span>{label}</span>
      <InfoTooltip help={help} onActionClick={onActionClick} />
    </span>
  );
}

