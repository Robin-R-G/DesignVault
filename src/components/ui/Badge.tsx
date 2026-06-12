"use client";

import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "primary";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:  "bg-[#1a1a24] text-[#a0a0b8] border-[#2a2a38]",
  primary:  "bg-[#7c6af7]/15 text-[#7c6af7] border-[#7c6af7]/30",
  success:  "bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30",
  warning:  "bg-[#fbbf24]/15 text-[#fbbf24] border-[#fbbf24]/30",
  error:    "bg-[#f87171]/15 text-[#f87171] border-[#f87171]/30",
  info:     "bg-[#60a5fa]/15 text-[#60a5fa] border-[#60a5fa]/30",
};

const dotColors: Record<BadgeVariant, string> = {
  default:  "bg-[#a0a0b8]",
  primary:  "bg-[#7c6af7]",
  success:  "bg-[#34d399]",
  warning:  "bg-[#fbbf24]",
  error:    "bg-[#f87171]",
  info:     "bg-[#60a5fa]",
};

export function statusToBadgeVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    "Project Created": "default",
    "Planning": "info",
    "Designing": "primary",
    "Client Review": "warning",
    "Revision Requested": "error",
    "Final Delivery": "success",
    "Completed": "success",
    "Archived": "default",
    "Pending Review": "warning",
    "Approved": "success",
    "Changes Requested": "error",
    "Final": "success",
    "Pending": "warning",
    "Partial": "info",
    "Paid": "success",
    "Overdue": "error",
  };
  return map[status] || "default";
}

export default function Badge({ children, variant = "default", dot = false, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        text-xs font-medium px-2 py-0.5
        rounded-full border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
