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
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              {/* Lightning — TrialExpiredDialog.svg */}
              <svg width={TOKENS.iconInnerSize} height={TOKENS.iconInnerSize} viewBox="0 0 104 106" fill="none" style={{ overflow: "visible" }}>
                <path d="M51.27 29.44C51.34 29.31 51.45 29.2 51.58 29.13C51.7 29.05 51.85 29.01 52 29.01C52.15 29.01 52.3 29.05 52.42 29.13C52.55 29.2 52.66 29.31 52.73 29.44L57.65 38.78C57.77 39 57.93 39.19 58.13 39.33C58.33 39.48 58.56 39.58 58.8 39.62C59.04 39.67 59.29 39.66 59.53 39.6C59.76 39.54 59.99 39.43 60.18 39.27L67.3 33.17C67.44 33.06 67.61 32.99 67.79 32.98C67.96 32.97 68.14 33.02 68.29 33.11C68.43 33.21 68.55 33.35 68.61 33.52C68.67 33.68 68.68 33.86 68.63 34.03L63.91 51.11C63.82 51.46 63.61 51.77 63.32 51.99C63.03 52.21 62.68 52.33 62.32 52.33H41.68C41.32 52.33 40.97 52.21 40.68 51.99C40.39 51.77 40.18 51.46 40.09 51.11L35.37 34.03C35.32 33.86 35.33 33.68 35.39 33.52C35.46 33.35 35.57 33.21 35.72 33.12C35.86 33.02 36.04 32.97 36.22 32.98C36.39 32.99 36.56 33.06 36.7 33.17L43.82 39.28C44.01 39.43 44.23 39.54 44.47 39.61C44.71 39.67 44.96 39.67 45.2 39.63C45.44 39.58 45.67 39.48 45.87 39.33C46.07 39.19 46.23 39 46.35 38.79L51.27 29.44Z" stroke="#fff" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M40.33 59H63.67" stroke="#fff" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round" />
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
              {/* Icon.svg — lightning */}
              <svg width={TOKENS.sectionIconSize} height={TOKENS.sectionIconSize} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2.6665 9.33334C2.54034 9.33377 2.41665 9.2984 2.3098 9.23133C2.20295 9.16426 2.11732 9.06824 2.06287 8.95445C2.00841 8.84065 1.98736 8.71373 2.00217 8.58845C2.01697 8.46316 2.06702 8.34465 2.1465 8.24667L8.7465 1.44667C8.79601 1.38953 8.86347 1.35091 8.93782 1.33716C9.01217 1.32341 9.08898 1.33535 9.15565 1.37101C9.22232 1.40667 9.27489 1.46394 9.30472 1.53341C9.33456 1.60289 9.33988 1.68044 9.31983 1.75334L8.03983 5.76667C8.00209 5.86769 7.98941 5.97635 8.00289 6.08334C8.01637 6.19034 8.05561 6.29246 8.11723 6.38096C8.17885 6.46946 8.26101 6.54168 8.35668 6.59145C8.45235 6.64121 8.55866 6.66702 8.6665 6.66667H13.3332C13.4593 6.66624 13.583 6.70162 13.6899 6.76869C13.7967 6.83576 13.8823 6.93177 13.9368 7.04557C13.9913 7.15937 14.0123 7.28628 13.9975 7.41157C13.9827 7.53685 13.9326 7.65537 13.8532 7.75334L7.25317 14.5533C7.20366 14.6105 7.13619 14.6491 7.06184 14.6629C6.9875 14.6766 6.91068 14.6647 6.84401 14.629C6.77734 14.5933 6.72478 14.5361 6.69494 14.4666C6.66511 14.3971 6.65978 14.3196 6.67983 14.2467L7.95983 10.2333C7.99758 10.1323 8.01025 10.0237 7.99677 9.91667C7.98329 9.80968 7.94406 9.70755 7.88244 9.61906C7.82082 9.53056 7.73865 9.45833 7.64298 9.40857C7.54731 9.3588 7.441 9.33299 7.33317 9.33334H2.6665Z" stroke={TOKENS.textPrimary} strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
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
              {/* Icon upgrade.svg — Upgrade to unlock */}
              <svg width={TOKENS.sectionIconSize} height={TOKENS.sectionIconSize} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M7.70796 2.17732C7.73673 2.12506 7.77901 2.08148 7.83037 2.05113C7.88173 2.02077 7.9403 2.00476 7.99996 2.00476C8.05962 2.00476 8.11818 2.02077 8.16955 2.05113C8.22091 2.08148 8.26318 2.12506 8.29196 2.17732L10.26 5.91332C10.3069 5.99983 10.3724 6.07488 10.4518 6.13307C10.5311 6.19126 10.6224 6.23116 10.719 6.2499C10.8156 6.26863 10.9152 6.26575 11.0106 6.24144C11.106 6.21714 11.1948 6.17202 11.2706 6.10932L14.122 3.66666C14.1767 3.62214 14.2441 3.59614 14.3146 3.59239C14.3851 3.58865 14.4549 3.60735 14.514 3.64582C14.5732 3.68429 14.6186 3.74053 14.6437 3.80645C14.6689 3.87237 14.6725 3.94457 14.654 4.01266L12.7646 10.8433C12.7261 10.9831 12.643 11.1065 12.528 11.1948C12.413 11.2831 12.2723 11.3315 12.1273 11.3327H3.87329C3.72818 11.3316 3.58736 11.2833 3.47222 11.195C3.35707 11.1067 3.27389 10.9832 3.23529 10.8433L1.34662 4.01332C1.32812 3.94524 1.3317 3.87304 1.35685 3.80712C1.382 3.7412 1.42741 3.68495 1.48656 3.64649C1.5457 3.60802 1.61553 3.58931 1.68598 3.59306C1.75644 3.5968 1.82389 3.6228 1.87862 3.66732L4.72929 6.10999C4.80516 6.17268 4.89396 6.2178 4.98933 6.24211C5.0847 6.26641 5.18427 6.2693 5.28089 6.25056C5.37751 6.23183 5.46878 6.19193 5.54815 6.13374C5.62752 6.07554 5.69303 6.0005 5.73996 5.91399L7.70796 2.17732Z" stroke={TOKENS.gradientStart} strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.3335 14H12.6668" stroke={TOKENS.gradientStart} strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
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
                    width={TOKENS.listIconSize}
                    height={TOKENS.listIconSize}
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

        {/* Footer CTA — Upgrade Now (lightning) + Maybe Later, in one row */}
        <div
          style={{
            padding: "24px 28px 20px",
            borderTop: `1px solid ${TOKENS.border}`,
            backgroundColor: TOKENS.modalBg,
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", gap: 12, alignItems: "stretch" }}>
            <button
              type="button"
              onClick={onUpgrade}
              style={{
                flex: 1,
                padding: "14px 20px",
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
              {/* Lightning — TrialExpiredDialog (white) */}
              <svg width={TOKENS.buttonIconSize} height={TOKENS.buttonIconSize} viewBox="0 0 104 106" fill="none">
                <path d="M51.27 29.44C51.34 29.31 51.45 29.2 51.58 29.13C51.7 29.05 51.85 29.01 52 29.01C52.15 29.01 52.3 29.05 52.42 29.13C52.55 29.2 52.66 29.31 52.73 29.44L57.65 38.78C57.77 39 57.93 39.19 58.13 39.33C58.33 39.48 58.56 39.58 58.8 39.62C59.04 39.67 59.29 39.66 59.53 39.6C59.76 39.54 59.99 39.43 60.18 39.27L67.3 33.17C67.44 33.06 67.61 32.99 67.79 32.98C67.96 32.97 68.14 33.02 68.29 33.11C68.43 33.21 68.55 33.35 68.61 33.52C68.67 33.68 68.68 33.86 68.63 34.03L63.91 51.11C63.82 51.46 63.61 51.77 63.32 51.99C63.03 52.21 62.68 52.33 62.32 52.33H41.68C41.32 52.33 40.97 52.21 40.68 51.99C40.39 51.77 40.18 51.46 40.09 51.11L35.37 34.03C35.32 33.86 35.33 33.68 35.39 33.52C35.46 33.35 35.57 33.21 35.72 33.12C35.86 33.02 36.04 32.97 36.22 32.98C36.39 32.99 36.56 33.06 36.7 33.17L43.82 39.28C44.01 39.43 44.23 39.54 44.47 39.61C44.71 39.67 44.96 39.67 45.2 39.63C45.44 39.58 45.67 39.48 45.87 39.33C46.07 39.19 46.23 39 46.35 38.79L51.27 29.44Z" stroke="#fff" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M40.33 59H63.67" stroke="#fff" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Upgrade Now
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px 20px",
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
