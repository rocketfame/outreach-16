"use client";

import React from "react";

interface NicheTagProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selected?: boolean;
}

export function NicheTag({ label, selected = false, className = "", ...props }: NicheTagProps) {
  return (
    <button
      type="button"
      className={`
        rounded-xl
        px-4 py-2
        text-[0.85rem]
        font-medium
        transition-all duration-200 ease-in-out
        cursor-pointer
        font-inherit
        border border-transparent
        ${
          selected
            ? "bg-gradient-to-r from-[#FF6B9D]/30 to-[#FF8E53]/35 text-[var(--foreground)] shadow-sm shadow-[#FF6B9D]/10"
            : "bg-gradient-to-r from-[#FF6B9D]/15 to-[#FF8E53]/15 text-[var(--foreground)]"
        }
        hover:bg-gradient-to-r hover:from-[#FF6B9D]/20 hover:to-[#FF8E53]/20 hover:shadow-sm hover:shadow-[#FF6B9D]/5
        active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B9D]/60 focus-visible:ring-offset-2
        ${className}
      `}
      {...props}
    >
      {label}
    </button>
  );
}

