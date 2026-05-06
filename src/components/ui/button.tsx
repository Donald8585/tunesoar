import * as React from "react";
import { cn } from "../../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trance-500 disabled:pointer-events-none disabled:opacity-50 no-select";

    const variants = {
      primary: "bg-trance-600 text-white hover:bg-trance-700 active:bg-trance-800",
      secondary: "bg-surface-lighter text-text-primary hover:bg-surface-light border border-surface-lighter",
      ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-light",
      danger: "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
export type { ButtonProps };
