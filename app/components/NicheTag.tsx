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
        rounded-full
        px-4 py-2
        text-[0.85rem]
        font-medium
        transition-all duration-200 ease-in-out
        cursor-pointer
        font-inherit
        border border-transparent
        ${
          selected
            ? "bg-gradient-to-r from-[#FF6B9D]/50 to-[#FF8E53]/60 text-white shadow-md shadow-[#FF6B9D]/20"
            : "bg-gradient-to-r from-[#FF6B9D]/10 to-[#FF8E53]/10 text-[var(--foreground)]"
        }
        hover:bg-gradient-to-r hover:from-[#FF6B9D]/30 hover:to-[#FF8E53]/30 hover:shadow-md hover:shadow-[#FF6B9D]/10 hover:text-[var(--foreground)]
        active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B9D]/60 focus-visible:ring-offset-2
        ${selected ? "hover:text-white" : ""}
        ${className}
      `}
      {...props}
    >
      {label}
    </button>
  );
}

