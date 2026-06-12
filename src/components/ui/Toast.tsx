"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

let addToastFn: ((toast: Omit<Toast, "id">) => void) | null = null;

export function toast(opts: Omit<Toast, "id">) {
  if (addToastFn) addToastFn(opts);
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-[#34d399]" />,
  error:   <XCircle size={16} className="text-[#f87171]" />,
  warning: <AlertTriangle size={16} className="text-[#fbbf24]" />,
  info:    <Info size={16} className="text-[#60a5fa]" />,
};

const borderColors: Record<ToastType, string> = {
  success: "border-[#34d399]/30",
  error:   "border-[#f87171]/30",
  warning: "border-[#fbbf24]/30",
  info:    "border-[#60a5fa]/30",
};

export default function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    addToastFn = (opts) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...opts, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => { addToastFn = null; };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            flex items-start gap-3 p-4 rounded-xl
            bg-[#1a1a24] border ${borderColors[t.type]}
            shadow-xl shadow-black/40
            animate-slide-down
          `}
        >
          <span className="flex-shrink-0 mt-0.5">{icons[t.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#f1f1f5]">{t.title}</p>
            {t.message && <p className="text-xs text-[#a0a0b8] mt-0.5">{t.message}</p>}
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="flex-shrink-0 text-[#6b6b85] hover:text-[#a0a0b8] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
