"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-[#7c6af7] hover:bg-[#6b59e8] text-white border border-[#7c6af7] hover:border-[#6b59e8] shadow-lg shadow-[rgba(124,106,247,0.25)] hover:shadow-[rgba(124,106,247,0.4)]",
  secondary:
    "bg-[#1a1a24] hover:bg-[#22222e] text-[#f1f1f5] border border-[#2a2a38] hover:border-[#3a3a50]",
  ghost:
    "bg-transparent hover:bg-[#1a1a24] text-[#a0a0b8] hover:text-[#f1f1f5] border border-transparent",
  danger:
    "bg-[#f87171]/10 hover:bg-[#f87171]/20 text-[#f87171] border border-[#f87171]/30 hover:border-[#f87171]/50",
  outline:
    "bg-transparent hover:bg-[#7c6af7]/10 text-[#7c6af7] border border-[#7c6af7]/50 hover:border-[#7c6af7]",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-7 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-base gap-2.5",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, icon, children, className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-medium rounded-lg
          transition-all duration-200 cursor-pointer select-none
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          icon && <span className="flex-shrink-0">{icon}</span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
