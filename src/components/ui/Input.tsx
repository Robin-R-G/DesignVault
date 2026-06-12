"use client";

import { InputHTMLAttributes, forwardRef, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[#a0a0b8]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b85]">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full h-10 rounded-lg
              bg-[#111118] border
              ${error ? "border-[#f87171] focus:border-[#f87171] focus:ring-[#f87171]/20" : "border-[#2a2a38] focus:border-[#7c6af7] focus:ring-[#7c6af7]/20"}
              text-[#f1f1f5] placeholder-[#6b6b85]
              text-sm px-3
              ${leftIcon ? "pl-10" : ""}
              ${rightIcon ? "pr-10" : ""}
              transition-all duration-200
              focus:outline-none focus:ring-2
              ${className}
            `}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b85]">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-[#f87171]">{error}</p>}
        {hint && !error && <p className="text-xs text-[#6b6b85]">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
