"use client";

import { useEffect } from "react";
import { DESIGN_TOKENS } from "@/lib/designTokens";

interface CreditsExhaustedProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  trialStats?: {
    topicSearches: number;
    articles: number;
    images: number;
  };
}

/**
 * Design & logic — Figma OutRea, node 5-1739 (Your Trial Period Has Ended modal):
 * https://www.figma.com/design/A5QmFDenHInwQnft6pk8KO/OutRea?node-id=5-1739&m=dev
 * Tokens: lib/designTokens.ts (single source for Figma tokens).
 */
const TOKENS = DESIGN_TOKENS;

export default function CreditsExhausted({ isOpen, onClose, onUpgrade, trialStats }: CreditsExhaustedProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const stats = trialStats ?? { topicSearches: 0, articles: 0, images: 0 };

  /** Order matches Figma 5-1739: topic research, image creation, priority support, article generation, editing tools, export */
  const unlockFeatures = [
    { label: "Unlimited", value: "topic research" },
    { label: "Unlimited", value: "image creation" },
    { label: "Priority", value: "support" },
    { label: "Unlimited", value: "article generation" },
    { label: "Advanced", value: "editing tools" },
    { label: "Export", value: "in multiple formats" },
  ];

  return (
    <div
      data-testid="credits-exhausted-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credits-exhausted-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: TOKENS.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          position: "relative",
          backgroundColor: TOKENS.modalBg,
          borderRadius: TOKENS.modalRadius,
          boxShadow: TOKENS.modalShadow,
          maxWidth: 480,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — Figma 5-1739 */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 36,
            height: 36,
            borderRadius: 10,
            border: "none",
            background: TOKENS.cardBg,
            color: TOKENS.textPrimary,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
            transition: "background 0.2s, color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = TOKENS.border;
            e.currentTarget.style.color = TOKENS.textSecondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = TOKENS.cardBg;
            e.currentTarget.style.color = TOKENS.textPrimary;
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div style={{ overflowY: "auto", padding: "28px 28px 0", flex: 1 }}>
          {/* Header — Figma 5-1739 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
            <div
              style={{
                width: TOKENS.iconSize,
                height: TOKENS.iconSize,
                borderRadius: "50%",
                background: TOKENS.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
                boxShadow: "0 8px 24px rgba(255, 105, 0, 0.28)",
                position: "relative",
              }}
            >
              {/* Crown icon — Figma 5-1739 */}
              <svg width={TOKENS.iconInnerSize} height={TOKENS.iconInnerSize} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 17l3-5 4 2 5-8 4 6 3-2 1 7H2z" />
                <path d="M12 9v6" />
              </svg>
            </div>
            <h2
              id="credits-exhausted-title"
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 22,
                fontWeight: 600,
                lineHeight: 1.3,
                letterSpacing: "-0.02em",
                color: TOKENS.textSecondary,
                margin: "0 0 10px",
                textAlign: "center",
              }}
            >
              Your Trial Period Has Ended
            </h2>
            <p
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 15,
                fontWeight: 400,
                lineHeight: 1.45,
                color: TOKENS.textPrimary,
                margin: 0,
                textAlign: "center",
                maxWidth: 360,
              }}
            >
              You've explored what our AI content creator can do! Ready to unlock unlimited potential?
            </p>
          </div>

          {/* What you accomplished — Figma 5-1739 (lightning icon) */}
          <div
            style={{
              backgroundColor: TOKENS.cardBg,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: TOKENS.cardRadius,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={TOKENS.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span
                style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: TOKENS.textSecondary,
                }}
              >
                What you accomplished in trial:
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { value: stats.topicSearches, label: "Topic Searches" },
                { value: stats.articles, label: "Articles" },
                { value: stats.images, label: "Image" },
              ].map(({ value, label }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "Inter, system-ui, sans-serif",
                      fontSize: 24,
                      fontWeight: 600,
                      lineHeight: "32px",
                      color: TOKENS.gradientStart,
                      marginBottom: 4,
                    }}
                  >
                    {value}
                  </div>
                  <div
                    style={{
                      fontFamily: "Inter, system-ui, sans-serif",
                      fontSize: 12,
                      fontWeight: 400,
                      lineHeight: "16px",
                      color: TOKENS.textPrimary,
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade to unlock — Figma 5-1739 (crown icon) */}
          <div
            style={{
              border: `1px solid ${TOKENS.border}`,
              borderRadius: TOKENS.cardRadius,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={TOKENS.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M2 17l3-5 4 2 5-8 4 6 3-2 1 7H2z" />
                <path d="M12 9v6" />
              </svg>
              <span
                style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: TOKENS.textSecondary,
                }}
              >
                Upgrade to unlock:
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px 16px" }}>
              {unlockFeatures.map(({ label, value }) => (
                <div key={`${label}-${value}`} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={TOKENS.success}
                    strokeWidth="2"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <div>
                    <span
                      style={{
                        fontFamily: "Inter, system-ui, sans-serif",
                        fontSize: 12,
                        fontWeight: 500,
                        lineHeight: "16px",
                        color: TOKENS.textSecondary,
                      }}
                    >
                      {label}{" "}
                    </span>
                    <span
                      style={{
                        fontFamily: "Inter, system-ui, sans-serif",
                        fontSize: 12,
                        fontWeight: 400,
                        lineHeight: "16px",
                        color: TOKENS.textPrimary,
                      }}
                    >
                      {value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing CTA — Figma: gradient button */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <button
              type="button"
              onClick={onUpgrade}
              style={{
                padding: "12px 28px",
                background: TOKENS.gradient,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 15,
                fontWeight: 600,
                lineHeight: 1.35,
                cursor: "pointer",
                transition: "opacity 0.2s, transform 0.05s",
                boxShadow: "0 2px 8px rgba(255, 105, 0, 0.25)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.92";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              Starting at $19/month
            </button>
          </div>
        </div>

        {/* Footer CTA — Figma 5-1739: Upgrade Now (crown) + Maybe Later */}
        <div
          style={{
            padding: "24px 28px 20px",
            borderTop: `1px solid ${TOKENS.border}`,
            backgroundColor: TOKENS.modalBg,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              type="button"
              onClick={onUpgrade}
              style={{
                width: "100%",
                padding: "14px 24px",
                background: TOKENS.gradient,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 15,
                fontWeight: 600,
                lineHeight: 1.35,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "opacity 0.2s, transform 0.05s",
                boxShadow: "0 2px 8px rgba(255, 105, 0, 0.25)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.92";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 17l3-5 4 2 5-8 4 6 3-2 1 7H2z" />
                <path d="M12 9v6" />
              </svg>
              Upgrade Now
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                padding: "12px 24px",
                background: "#fff",
                color: TOKENS.textSecondary,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 10,
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.35,
                cursor: "pointer",
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = TOKENS.cardBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
              }}
            >
              Maybe Later
            </button>
          </div>
          <p
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              lineHeight: 1.45,
              color: TOKENS.textPrimary,
              margin: "16px 0 0",
              textAlign: "center",
            }}
          >
            No credit card required to start • Cancel anytime • 14-day money-back guarantee
          </p>
        </div>
      </div>
    </div>
  );
}
