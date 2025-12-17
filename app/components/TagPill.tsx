"use client";

import React from "react";
import clsx from "clsx";

interface TagPillProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TagPill({ label, selected = false, onClick, className }: TagPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center justify-center rounded-full transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[#FFB86A]/60 focus:ring-offset-1",
        "active:scale-[0.98] hover:opacity-90",
        selected
          ? [
              "border border-transparent",
              "bg-gradient-to-r from-[#FF6900] to-[#F6339A]",
              "text-white",
            ]
          : [
              "border-2 border-[#FFB86A]",
              "bg-white",
              "text-[#F54900]",
            ],
        // розміри
        "px-3.5 py-2 text-sm font-semibold",
        "sm:px-7 sm:py-3.5 sm:text-base",
        className,
      )}
    >
      {label}
    </button>
  );
}

