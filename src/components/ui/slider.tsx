import { cn } from "../../lib/utils";

type SliderProps = {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  label?: string;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
};

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  className,
  label,
  showValue = true,
  valueFormatter,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-text-secondary">{label}</span>}
          {showValue && (
            <span className="text-xs text-text-primary font-mono">
              {valueFormatter ? valueFormatter(value) : value}
            </span>
          )}
        </div>
      )}
      <div className="relative h-6 flex items-center">
        <div className="absolute w-full h-1.5 rounded-full bg-surface-lighter">
          <div
            className="h-full rounded-full bg-trance-600 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute w-full h-6 opacity-0 cursor-pointer"
        />
        <div
          className="absolute w-4 h-4 rounded-full bg-white shadow-md border-2 border-trance-600 transition-all pointer-events-none"
          style={{ left: `calc(${percentage}% - ${percentage * 0.16}px)` }}
        />
      </div>
    </div>
  );
}
