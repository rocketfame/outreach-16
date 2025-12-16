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
            ? "bg-gradient-to-r from-[#FF4B9A]/8 via-[#FF7AC4]/8 to-[#FFC5E6]/8 border-[1.5px] border-[#FF6B9D] text-[var(--foreground)]"
            : "bg-gradient-to-r from-[#FF4B9A]/3 via-[#FF7AC4]/3 to-[#FFC5E6]/3 border-[1.5px] border-[var(--border)] text-[var(--foreground)]"
        }
        hover:border-[#FF6B9D] hover:bg-gradient-to-r hover:from-[#FF4B9A]/6 hover:via-[#FF7AC4]/6 hover:to-[#FFC5E6]/6 hover:text-[var(--foreground)]
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

