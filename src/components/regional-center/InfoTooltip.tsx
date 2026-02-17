import React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import type { MetricHelp } from './MetricDictionary';

type InfoTooltipProps = {
  help: MetricHelp;
  onActionClick?: () => void;
  actionLabel?: string;
};

export function InfoTooltip({
  help,
  onActionClick,
  actionLabel = '관련 탭 이동',
}: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 hover:text-gray-700"
          aria-label="지표 설명 보기"
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={8}
        className="max-w-[300px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-800 shadow-lg"
      >
        <div className="space-y-1.5 text-[11px] leading-relaxed">
          <div><span className="font-semibold">정의:</span> {help.definition}</div>
          <div><span className="font-semibold">집계 범위:</span> {help.scope}</div>
          <div><span className="font-semibold">기간:</span> {help.period}</div>
          <div><span className="font-semibold">기준:</span> {help.threshold}</div>
          <div><span className="font-semibold">해석:</span> {help.interpretation}</div>
          <div><span className="font-semibold">다음 액션:</span> {help.nextAction}</div>
          {onActionClick ? (
            <button
              type="button"
              onClick={onActionClick}
              className="mt-1 inline-flex h-6 items-center rounded border border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

