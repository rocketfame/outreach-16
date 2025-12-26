"use client";

import React from "react";
import clsx from "clsx";

interface NicheTagProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function NicheTag({ label, selected = false, onClick, className }: NicheTagProps) {
  // Debug log (can be removed later)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('Rendering NicheTag', label, selected);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center justify-center rounded-full border transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[#FFB86A]/60 focus:ring-offset-1",
        "active:scale-[0.98]",
        // розміри для мобайлу / десктопу
        "px-3.5 py-2 text-sm font-semibold",
        "sm:px-7 sm:py-3.5 sm:text-base",
        selected
          ? [
              "border-transparent",
              "bg-gradient-to-r from-[#FF6900] to-[#F6339A]",
              "text-white",
            ]
          : [
              "bg-white",
              "border-2 border-[#FFB86A]",
              "text-[#F54900]",
            ],
        "hover:opacity-90",
        className
      )}
    >
      {label}
    </button>
  );
}

