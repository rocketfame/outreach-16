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
        transition-all duration-150 ease-in-out
        cursor-pointer
        font-inherit
        border border-transparent
        ${
          selected
            ? "bg-gradient-to-r from-[#FF6B9D]/60 to-[#FF8E53]/70 text-white shadow-lg shadow-[#FF6B9D]/25"
            : "bg-gradient-to-r from-[#FF6B9D]/12 via-[#FF6B9D]/6 to-[#FF8E53]/14 text-slate-900 shadow-[0_6px_18px_rgba(255,105,180,0.12)]"
        }
        hover:bg-gradient-to-r hover:from-[#FF6B9D]/30 hover:to-[#FF8E53]/30 hover:shadow-md hover:shadow-[#FF6B9D]/18 hover:-translate-y-[1px]
        active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B9D]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF7F3]
        ${selected ? "hover:text-white" : ""}
        ${className}
      `}
      {...props}
    >
      {label}
    </button>
  );
}

