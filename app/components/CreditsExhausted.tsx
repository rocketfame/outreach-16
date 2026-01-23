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

// Helper function to convert RGB 0-1 to hex
const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
};

export default function CreditsExhausted({ isOpen, onClose, onUpgrade, trialStats }: CreditsExhaustedProps) {
  // Debug logging
  useEffect(() => {
    console.log("[CreditsExhausted] Component rendered with props:", {
      isOpen,
      hasTrialStats: !!trialStats,
      trialStats,
    });
  }, [isOpen, trialStats]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      console.log("[CreditsExhausted] Modal is open, adding event listeners");
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    } else {
      console.log("[CreditsExhausted] Modal is closed");
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  console.log("[CreditsExhausted] Render check - isOpen:", isOpen, "trialStats:", trialStats);
  if (!isOpen) {
    console.log("[CreditsExhausted] ❌ Returning null because isOpen is false");
    return null;
  }
  
  console.log("[CreditsExhausted] ✅ Rendering modal content - isOpen is true");

  // Colors from Figma
  const overlayBg = "rgba(0, 0, 0, 0.5)";
  const modalBg = "#ffffff";
  const borderColor = rgbToHex(0.898, 0.906, 0.922);
  const textPrimary = rgbToHex(0.289, 0.334, 0.396);
  const textSecondary = rgbToHex(0.065, 0.094, 0.157);
  const gradientButton = `linear-gradient(90deg, ${rgbToHex(1, 0.411, 0)} 0%, ${rgbToHex(0.966, 0.198, 0.604)} 100%)`;
  const iconBgGradient = gradientButton;
  const savingsColor = "#10b981"; // Green

  const stats = trialStats || {
    topicSearches: 0,
    articles: 0,
    images: 0,
  };

  const unlockFeatures = [
    { label: "Unlimited", value: "topic research" },
    { label: "Unlimited", value: "article generation" },
    { label: "Unlimited", value: "image creation" },
    { label: "Advanced", value: "editing tools" },
    { label: "Priority", value: "support" },
    { label: "Export", value: "in multiple formats" },
  ];

  console.log("[CreditsExhausted] ✅ About to render modal div with zIndex 9999");
  
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: overlayBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
      data-testid="credits-exhausted-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: modalBg,
          borderRadius: "16px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable Content */}
        <div
          style={{
            overflowY: "auto",
            padding: "24px",
            flex: 1,
          }}
        >
          {/* Header with Icon */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "24px" }}>
            {/* Icon with gradient background */}
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: iconBgGradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
                boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                <path d="M12 8V16M8 12H16" />
              </svg>
            </div>

            <h2 style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "24px",
              fontWeight: 600,
              lineHeight: "32px",
              color: textSecondary,
              margin: "0 0 8px 0",
              textAlign: "center",
            }}>
              Your Trial Period Has Ended
            </h2>

            <p style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 400,
              lineHeight: "20px",
              color: textPrimary,
              margin: 0,
              textAlign: "center",
            }}>
              You've explored what our AI content creator can do! Ready to unlock unlimited potential?
            </p>
          </div>

          {/* What you accomplished */}
          <div style={{
            border: `1px solid ${borderColor}`,
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "24px",
            backgroundColor: rgbToHex(0.969, 0.973, 0.980),
          }}>
            <div style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              lineHeight: "20px",
              color: textSecondary,
              marginBottom: "16px",
            }}>
              What you accomplished in trial:
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "24px",
                  fontWeight: 600,
                  lineHeight: "32px",
                  color: textSecondary,
                  marginBottom: "4px",
                }}>
                  {stats.topicSearches}
                </div>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "12px",
                  fontWeight: 400,
                  lineHeight: "16px",
                  color: textPrimary,
                }}>
                  Topic Searches
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "24px",
                  fontWeight: 600,
                  lineHeight: "32px",
                  color: textSecondary,
                  marginBottom: "4px",
                }}>
                  {stats.articles}
                </div>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "12px",
                  fontWeight: 400,
                  lineHeight: "16px",
                  color: textPrimary,
                }}>
                  Articles
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "24px",
                  fontWeight: 600,
                  lineHeight: "32px",
                  color: textSecondary,
                  marginBottom: "4px",
                }}>
                  {stats.images}
                </div>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "12px",
                  fontWeight: 400,
                  lineHeight: "16px",
                  color: textPrimary,
                }}>
                  Image
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade to unlock */}
          <div style={{
            border: `1px solid ${borderColor}`,
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "24px",
          }}>
            <div style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              lineHeight: "20px",
              color: textSecondary,
              marginBottom: "16px",
            }}>
              Upgrade to unlock:
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "12px",
            }}>
              {unlockFeatures.map((feature, index) => (
                <div key={index} style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}>
                  {/* Checkmark Icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={savingsColor} strokeWidth="2" style={{ flexShrink: 0, marginTop: "2px" }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <div>
                    <div style={{
                      fontFamily: "Inter, system-ui, sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: "16px",
                      color: textSecondary,
                    }}>
                      {feature.label}
                    </div>
                    <div style={{
                      fontFamily: "Inter, system-ui, sans-serif",
                      fontSize: "12px",
                      fontWeight: 400,
                      lineHeight: "16px",
                      color: textPrimary,
                    }}>
                      {feature.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div style={{
            textAlign: "center",
            marginBottom: "24px",
          }}>
            <div style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 400,
              lineHeight: "20px",
              color: textPrimary,
            }}>
              Starting at $19/month
            </div>
          </div>
        </div>

        {/* Fixed Footer with Upgrade Button */}
        <div style={{
          padding: "24px",
          borderTop: `1px solid ${borderColor}`,
          backgroundColor: modalBg,
        }}>
          <button
            onClick={onUpgrade}
            style={{
              width: "100%",
              padding: "12px 24px",
              background: gradientButton,
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              lineHeight: "20px",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
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
