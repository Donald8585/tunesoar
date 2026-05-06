import { cn } from "../../lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  description?: string;
}

export function Switch({ checked, onChange, disabled, className, label, description }: SwitchProps) {
  return (
    <label className={cn("flex items-center gap-3 cursor-pointer no-select", disabled && "opacity-50 cursor-not-allowed", className)}>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trance-500",
          checked ? "bg-trance-600" : "bg-surface-lighter"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-[2px] ml-[2px]",
            checked && "translate-x-4"
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm text-text-primary">{label}</span>}
          {description && <span className="text-xs text-text-secondary">{description}</span>}
        </div>
      )}
    </label>
  );
}
