"use client";

import React from "react";
import clsx from "clsx";

export type ArticleSettingsValues = {
  nicheOrIndustry?: string;
  brandName?: string;
  anchorKeyword?: string;
  targetWordCount?: number;
  writingStyle?: string;
};

type ArticleSettingsPanelProps = {
  values: ArticleSettingsValues;
  onChange: (updates: Partial<ArticleSettingsValues>) => void;
  disabled?: boolean;
  className?: string;
};

export function ArticleSettingsPanel({
  values,
  onChange,
  disabled = false,
  className,
}: ArticleSettingsPanelProps) {
  return (
    <section
      className={clsx(
        "space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-4 lg:px-5 lg:py-5",
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-800">
          Article context (optional)
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          These fields help align the article with your niche, brand, SEO focus and target length.
        </p>
      </div>

      <div className="space-y-3">
        {/* Niche or industry */}
        <label>
          <span className="block text-sm font-medium text-slate-700 mb-1.5">
            Niche or industry (optional)
          </span>
          <input
            type="text"
            value={values.nicheOrIndustry || ""}
            onChange={(e) => onChange({ nicheOrIndustry: e.target.value || undefined })}
            placeholder="e.g. Music promotion"
            disabled={disabled}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
                     focus:border-[#FF7C4D] focus:ring-2 focus:ring-[#FFB6A3]/70 outline-none transition
                     disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>

        {/* Brand / company name */}
        <label>
          <span className="block text-sm font-medium text-slate-700 mb-1.5">
            Brand / company name (optional)
          </span>
          <input
            type="text"
            value={values.brandName || ""}
            onChange={(e) => onChange({ brandName: e.target.value || undefined })}
            placeholder="e.g. Universal Content Creator"
            disabled={disabled}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
                     focus:border-[#FF7C4D] focus:ring-2 focus:ring-[#FFB6A3]/70 outline-none transition
                     disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>

        {/* Anchor / primary keyword */}
        <label>
          <span className="block text-sm font-medium text-slate-700 mb-1.5">
            Anchor / primary keyword (optional)
          </span>
          <input
            type="text"
            value={values.anchorKeyword || ""}
            onChange={(e) => onChange({ anchorKeyword: e.target.value || undefined })}
            placeholder="e.g. music promotion services"
            disabled={disabled}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
                     focus:border-[#FF7C4D] focus:ring-2 focus:ring-[#FFB6A3]/70 outline-none transition
                     disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>

        {/* Target word count */}
        <label>
          <span className="block text-sm font-medium text-slate-700 mb-1.5">
            Target word count (optional)
          </span>
          <input
            type="number"
            value={values.targetWordCount || ""}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                targetWordCount: val ? (isNaN(parseInt(val)) ? undefined : parseInt(val)) : undefined,
              });
            }}
            placeholder="e.g. 1200"
            min="100"
            disabled={disabled}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
                     focus:border-[#FF7C4D] focus:ring-2 focus:ring-[#FFB6A3]/70 outline-none transition
                     disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>

        {/* Writing style */}
        <label>
          <span className="block text-sm font-medium text-slate-700 mb-1.5">
            Writing style (optional)
          </span>
          <select
            value={values.writingStyle || ""}
            onChange={(e) => onChange({ writingStyle: e.target.value || undefined })}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
                     focus:border-[#FF7C4D] focus:ring-2 focus:ring-[#FFB6A3]/70 outline-none transition
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select style...</option>
            <option value="neutral">Neutral</option>
            <option value="friendly-expert">Friendly Expert</option>
            <option value="journalistic">Journalistic</option>
            <option value="conversational">Conversational</option>
            <option value="professional">Professional</option>
          </select>
        </label>
      </div>
    </section>
  );
}

