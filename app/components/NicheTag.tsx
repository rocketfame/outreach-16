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
        transition-all duration-150 ease-in-out
        cursor-pointer
        font-inherit
        border border-transparent
        ${
          selected
            ? "bg-gradient-to-r from-[#FF6B9D]/50 to-[#FF8E53]/60 text-white shadow-md shadow-[#FF6B9D]/20"
            : "bg-gradient-to-r from-[#FF6B9D]/15 to-[#FF8E53]/15 text-slate-900 shadow-sm"
        }
        hover:bg-gradient-to-r hover:from-[#FF6B9D]/25 hover:to-[#FF8E53]/25 hover:shadow-md hover:shadow-[#FF6B9D]/15 hover:-translate-y-[1px]
        active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B9D]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF7F3]
        ${selected ? "hover:text-white hover:from-[#FF6B9D]/55 hover:to-[#FF8E53]/65" : ""}
        ${className}
      `}
      {...props}
    >
      {label}
    </button>
  );
}

