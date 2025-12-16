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
        rounded-[20px]
        text-[0.85rem]
        font-medium
        transition-all duration-200 ease-in-out
        cursor-pointer
        font-inherit
        ${
          selected
            ? "bg-gradient-to-r from-[#FF4B9A]/15 via-[#FF7AC4]/15 to-[#FFC5E6]/15 border-[1.5px] border-[#FF6B9D] text-[#FF6B9D]"
            : "bg-gradient-to-r from-[#FF4B9A]/5 via-[#FF7AC4]/5 to-[#FFC5E6]/5 border-[1.5px] border-[var(--border)] text-[var(--foreground)]"
        }
        hover:border-[#FF6B9D] hover:bg-gradient-to-r hover:from-[#FF4B9A]/10 hover:via-[#FF7AC4]/10 hover:to-[#FFC5E6]/10 hover:text-[#FF6B9D]
        active:scale-[0.98]
        ${className}
      `}
      style={{
        padding: '0.5rem 1rem'
      }}
      {...props}
    >
      {label}
    </button>
  );
}

