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
        "preset-button",
        selected && "preset-button-selected",
        className,
      )}
    >
      {label}
    </button>
  );
}
