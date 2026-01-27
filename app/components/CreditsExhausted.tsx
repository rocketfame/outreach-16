"use client";

import { useEffect } from "react";

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
 * Design tokens — sync with Figma OutRea:
 * https://www.figma.com/design/A5QmFDenHInwQnft6pk8KO/OutRea?node-id=5-1739&m=dev
 * Update hex/gradient values when refreshing from Figma.
 */
const TOKENS = {
  overlay: "rgba(0, 0, 0, 0.5)",
  modalBg: "#ffffff",
  modalRadius: 16,
  modalShadow: "0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)",
  border: "#E5E7EB",
  textPrimary: "#4A5568",
  textSecondary: "#111827",
  cardBg: "#F7F8FA",
  cardRadius: 12,
  /** CTA gradient — Figma: orange → pink */
  gradientStart: "#FF6900",
  gradientEnd: "#F73399",
  gradient: "linear-gradient(90deg, #FF6900 0%, #F73399 100%)",
  success: "#10b981",
  iconSize: 80,
  iconInnerSize: 40,
} as const;

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

  const unlockFeatures = [
    { label: "Unlimited", value: "topic research" },
    { label: "Unlimited", value: "article generation" },
    { label: "Unlimited", value: "image creation" },
    { label: "Advanced", value: "editing tools" },
    { label: "Priority", value: "support" },
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
        {/* Close button */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "none",
            background: TOKENS.cardBg,
            color: TOKENS.textPrimary,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div style={{ overflowY: "auto", padding: "24px 24px 0", flex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <div
              style={{
                width: TOKENS.iconSize,
                height: TOKENS.iconSize,
                borderRadius: "50%",
                background: TOKENS.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                boxShadow: "0 4px 14px rgba(255, 105, 0, 0.35)",
              }}
            >
              <svg width={TOKENS.iconInnerSize} height={TOKENS.iconInnerSize} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <h2
              id="credits-exhausted-title"
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 24,
                fontWeight: 600,
                lineHeight: "32px",
                color: TOKENS.textSecondary,
                margin: "0 0 8px",
                textAlign: "center",
              }}
            >
              Your Trial Period Has Ended
            </h2>
            <p
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 400,
                lineHeight: "20px",
                color: TOKENS.textPrimary,
                margin: 0,
                textAlign: "center",
              }}
            >
              You've explored what our AI content creator can do! Ready to unlock unlimited potential?
            </p>
          </div>

          {/* What you accomplished */}
          <div
            style={{
              backgroundColor: TOKENS.cardBg,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: TOKENS.cardRadius,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 500,
                lineHeight: "20px",
                color: TOKENS.textSecondary,
                marginBottom: 16,
              }}
            >
              What you accomplished in trial:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { value: stats.topicSearches, label: "Topic Searches" },
                { value: stats.articles, label: "Articles" },
                { value: stats.images, label: "Images" },
              ].map(({ value, label }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "Inter, system-ui, sans-serif",
                      fontSize: 24,
                      fontWeight: 600,
                      lineHeight: "32px",
                      color: TOKENS.textSecondary,
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

          {/* Upgrade to unlock */}
          <div
            style={{
              border: `1px solid ${TOKENS.border}`,
              borderRadius: TOKENS.cardRadius,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 500,
                lineHeight: "20px",
                color: TOKENS.textSecondary,
                marginBottom: 16,
              }}
            >
              Upgrade to unlock:
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

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 400,
                lineHeight: "20px",
                color: TOKENS.textPrimary,
              }}
            >
              Starting at $19/month
            </span>
          </div>
        </div>

        {/* Footer CTA */}
        <div
          style={{
            padding: 24,
            borderTop: `1px solid ${TOKENS.border}`,
            backgroundColor: TOKENS.modalBg,
          }}
        >
          <button
            type="button"
            onClick={onUpgrade}
            style={{
              width: "100%",
              padding: "12px 24px",
              background: TOKENS.gradient,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 500,
              lineHeight: "20px",
              cursor: "pointer",
              transition: "opacity 0.2s, transform 0.05s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.92";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}
