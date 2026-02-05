import React from 'react';

const modeOptions = [
  { id: 'fill', label: '열' },
  { id: 'dot', label: '점' },
  { id: 'bubble', label: '버블' }
] as const;

type MapLegendAndControlsProps = {
  mode: 'fill' | 'dot' | 'bubble';
  levels: number;
  alpha: number;
  onModeChange: (mode: 'fill' | 'dot' | 'bubble') => void;
  onLevelsChange: (levels: number) => void;
  onAlphaChange: (alpha: number) => void;
  onReset: () => void;
  minLabel?: string;
  maxLabel?: string;
};

export function MapLegendAndControls({
  mode,
  levels,
  alpha,
  onModeChange,
  onLevelsChange,
  onAlphaChange,
  onReset,
  minLabel = '낮음',
  maxLabel = '높음'
}: MapLegendAndControlsProps) {
  return (
    <div className="w-64 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-sm">
      <div className="text-xs font-semibold text-gray-800">지도 설정</div>

      <div className="mt-3">
        <div className="text-[11px] text-gray-500">시각화 유형</div>
        <div className="mt-2 flex gap-1">
          {modeOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`flex-1 rounded border px-2 py-1 ${
                mode === item.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white'
              }`}
              onClick={() => onModeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[11px] text-gray-500">레벨</div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="range"
            min={5}
            max={10}
            step={1}
            value={levels}
            onChange={(event) => onLevelsChange(Number(event.target.value))}
            className="w-full"
          />
          <span className="w-6 text-right">{levels}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[11px] text-gray-500">알파</div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="range"
            min={40}
            max={100}
            step={5}
            value={Math.round(alpha * 100)}
            onChange={(event) => onAlphaChange(Number(event.target.value) / 100)}
            className="w-full"
          />
          <span className="w-8 text-right">{Math.round(alpha * 100)}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[11px] text-gray-500">범례</div>
        <div className="mt-2">
          <div className="h-2 w-full rounded-full" style={{ background: 'linear-gradient(90deg, #e5effe, #93c5fd, #3b82f6, #1e3a8a)' }} />
          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="mt-3 w-full rounded border border-gray-200 bg-white py-1 text-xs text-gray-600 hover:bg-gray-50"
        onClick={onReset}
      >
        초기화
      </button>
    </div>
  );
}
