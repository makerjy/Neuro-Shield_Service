import React from 'react';
import { cn } from './utils';

type LoadingOverlayStage = 'scopeChange' | 'refreshing';

interface LoadingOverlayProps {
  visible: boolean;
  stage?: LoadingOverlayStage;
  label?: string;
  className?: string;
}

export function LoadingOverlay({
  visible,
  stage = 'scopeChange',
  label,
  className,
}: LoadingOverlayProps) {
  if (!visible) return null;

  const resolvedLabel = label ?? (stage === 'refreshing' ? '최신 값을 반영하는 중…' : '영역을 전환하는 중…');

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-30', className)}>
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          stage === 'scopeChange' ? 'bg-white/35 backdrop-blur-[1px]' : 'bg-white/18'
        )}
      />
      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-blue-100/90">
        <div className="ns-loading-overlay-bar h-full w-1/3 bg-blue-600" />
      </div>
      <div className="absolute right-3 top-3 rounded-md border border-blue-100 bg-white/90 px-2 py-1 text-[11px] font-medium text-blue-700 shadow-sm">
        {resolvedLabel}
      </div>
    </div>
  );
}
