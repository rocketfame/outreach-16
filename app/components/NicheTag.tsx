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
        px-7 py-3.5
        text-[0.875rem]
        font-semibold
        transition-all duration-150 ease-in-out
        cursor-pointer
        font-inherit
        ${
          selected
            ? "bg-gradient-to-r from-[#FF6B9D]/60 to-[#FF8E53]/70 text-white shadow-md shadow-[#FF6B9D]/25"
            : "bg-white border-2 border-[#FFB86A] text-[#F55A00] shadow-sm"
        }
        hover:bg-gradient-to-r hover:from-[#FF6B9D]/25 hover:to-[#FF8E53]/25 hover:border-[#FF6B9D]/30 hover:shadow-md hover:shadow-[#FF6B9D]/20 hover:-translate-y-[1px]
        active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B9D]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF7F3]
        ${selected ? "hover:text-white hover:from-[#FF6B9D]/65 hover:to-[#FF8E53]/75" : "hover:text-[#F55A00]"}
        ${className}
      `}
      {...props}
    >
      {label}
    </button>
  );
}

