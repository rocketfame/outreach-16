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
        px-5 py-2
        text-sm font-medium
        transition-all duration-200 ease-in-out
        cursor-pointer
        font-inherit
        ${
          selected
            ? "bg-gradient-to-r from-[#FF4B9A] via-[#FF7AC4] to-[#FFC5E6] text-white border-transparent shadow-md"
            : "bg-gradient-to-r from-[#FF4B9A]/10 via-[#FF7AC4]/10 to-[#FFC5E6]/10 text-slate-900 border border-white/40 shadow-sm"
        }
        hover:scale-[1.02] hover:shadow-md
        active:scale-[0.98]
        ${selected ? "hover:from-[#FF4B9A]/90 hover:via-[#FF7AC4]/90 hover:to-[#FFC5E6]/90" : "hover:from-[#FF4B9A]/15 hover:via-[#FF7AC4]/15 hover:to-[#FFC5E6]/15"}
        ${className}
      `}
      {...props}
    >
      {label}
    </button>
  );
}

