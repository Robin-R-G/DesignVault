"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const maxWidthMap: Record<string, string> = {
  sm: "480px",
  md: "560px",
  lg: "768px",
  xl: "960px",
};

export default function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        overflowY: "auto",
        paddingTop: "40px",
        paddingBottom: "40px",
        paddingLeft: "16px",
        paddingRight: "16px",
        boxSizing: "border-box",
      }}
    >
      {/* Modal Box — click stops propagation so it doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: maxWidthMap[size] ?? "560px",
          backgroundColor: "#111118",
          border: "1px solid #2a2a38",
          borderRadius: "18px",
          boxShadow: "0 30px 60px rgba(0,0,0,0.7)",
          flexShrink: 0,
        }}
      >
        {/* Header */}
        {title && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px 24px",
              borderBottom: "1px solid #1e1e2a",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#f1f1f5" }}>
              {title}
            </span>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6b6b85",
                padding: "6px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: "24px" }}>{children}</div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "12px",
              padding: "16px 24px",
              borderTop: "1px solid #1e1e2a",
              borderRadius: "0 0 18px 18px",
              backgroundColor: "#111118",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
