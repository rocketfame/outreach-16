"use client";

import { useEffect, useState } from "react";

interface CreditPlan {
  id: string;
  credits: number;
  totalPrice: number;
  savings?: number;
  popular?: boolean;
  benefits: string[];
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  trialToken?: string | null;
}

// Credit plans from Figma design
const CREDIT_PLANS: CreditPlan[] = [
  {
    id: "50",
    credits: 50,
    totalPrice: 30.00,
    benefits: ["~5 topic generations", "~10 full articles", "Credits never expire"],
  },
  {
    id: "100",
    credits: 100,
    totalPrice: 55.00,
    savings: 5,
    popular: true,
    benefits: ["~10 topic generations", "~20 full articles", "Credits never expire"],
  },
  {
    id: "250",
    credits: 250,
    totalPrice: 125.00,
    savings: 25,
    benefits: ["~25 topic generations", "~50 full articles", "Credits never expire"],
  },
  {
    id: "500",
    credits: 500,
    totalPrice: 225.00,
    savings: 75,
    benefits: ["~50 topic generations", "~100 full articles", "Credits never expire"],
  },
];

// Helper function to convert RGB 0-1 to hex
const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
};

export default function UpgradeModal({ isOpen, onClose, currentBalance, trialToken }: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<CreditPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
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

  const handlePurchase = async (plan: CreditPlan) => {
    setIsProcessing(true);
    try {
      // Create Stripe checkout session
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          credits: plan.credits,
          amount: plan.totalPrice,
          trialToken: trialToken || null,
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
        setIsProcessing(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      alert("Failed to initiate payment. Please try again.");
      setIsProcessing(false);
    }
  };

  // Colors from Figma
  const overlayBg = "rgba(0, 0, 0, 0.5)";
  const modalBg = "#ffffff";
  const borderColor = rgbToHex(0.898, 0.906, 0.922);
  const textPrimary = rgbToHex(0.289, 0.334, 0.396);
  const textSecondary = rgbToHex(0.065, 0.094, 0.157);
  const gradientButton = `linear-gradient(90deg, ${rgbToHex(0.961, 0.288, 0)} 0%, ${rgbToHex(0.901, 0, 0.463)} 100%)`;
  const popularBadgeBg = gradientButton;
  const savingsColor = "#10b981"; // Green for savings
  const balanceBg = `linear-gradient(180deg, ${rgbToHex(1, 0.969, 0.929)} 0%, ${rgbToHex(0.991, 0.949, 0.972)} 100%)`;
  const balanceBorder = rgbToHex(1, 0.841, 0.657);

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
        zIndex: 1000,
        padding: "1rem",
      }}
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
          maxWidth: "800px",
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
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* Star Icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={rgbToHex(1, 0.412, 0)} strokeWidth="1.67">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <h2 style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "24px",
                fontWeight: 600,
                lineHeight: "32px",
                color: textSecondary,
                margin: 0,
              }}>
                Buy Additional Credits
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: textPrimary,
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.7";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Description */}
          <p style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "14px",
            fontWeight: 400,
            lineHeight: "20px",
            color: textPrimary,
            margin: "0 0 24px 0",
          }}>
            Choose a credit pack that suits your needs and get started with your writing projects.
          </p>

          {/* Current Balance and Credit Cost */}
          <div style={{
            background: balanceBg,
            border: `1px solid ${balanceBorder}`,
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}>
            <div>
              <div style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "14px",
                fontWeight: 400,
                lineHeight: "20px",
                color: textPrimary,
                marginBottom: "4px",
              }}>
                Current Balance
              </div>
              <div style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "24px",
                fontWeight: 400,
                lineHeight: "32px",
                color: rgbToHex(0.961, 0.288, 0), // Orange color for balance
              }}>
                {currentBalance} Credits
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "14px",
                fontWeight: 400,
                lineHeight: "20px",
                color: textPrimary,
                marginBottom: "4px",
              }}>
                Credit Cost
              </div>
              <div style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "18px",
                fontWeight: 400,
                lineHeight: "28px",
                color: textSecondary,
              }}>
                $0.60 per credit
              </div>
            </div>
          </div>

          {/* Credit Plans - 2 columns grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px",
            marginBottom: "24px",
          }}>
            {CREDIT_PLANS.map((plan) => (
              <div
                key={plan.id}
                style={{
                  border: `1px solid ${plan === selectedPlan ? rgbToHex(0.961, 0.288, 0) : borderColor}`,
                  borderRadius: "12px",
                  padding: "16px",
                  position: "relative",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor: plan === selectedPlan ? rgbToHex(0.969, 0.973, 0.980) : "transparent",
                }}
                onClick={() => setSelectedPlan(plan)}
                onMouseEnter={(e) => {
                  if (plan !== selectedPlan) {
                    e.currentTarget.style.backgroundColor = rgbToHex(0.969, 0.973, 0.980);
                  }
                }}
                onMouseLeave={(e) => {
                  if (plan !== selectedPlan) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: "absolute",
                    top: "-8px",
                    right: "8px",
                    background: popularBadgeBg,
                    color: "#ffffff",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 600,
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}>
                    Best Value
                  </div>
                )}
                
                {/* Credits */}
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "24px",
                  fontWeight: 400,
                  lineHeight: "32px",
                  color: textSecondary,
                  marginBottom: "4px",
                }}>
                  {plan.credits}
                </div>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "14px",
                  fontWeight: 400,
                  lineHeight: "20px",
                  color: textPrimary,
                  marginBottom: "16px",
                }}>
                  Credits
                </div>

                {/* Price */}
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "24px",
                  fontWeight: 400,
                  lineHeight: "32px",
                  color: plan.popular ? savingsColor : textSecondary,
                  marginBottom: plan.savings ? "4px" : "16px",
                }}>
                  ${plan.totalPrice.toFixed(0)}
                </div>

                {/* Savings */}
                {plan.savings && (
                  <div style={{
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: "14px",
                    fontWeight: 400,
                    lineHeight: "20px",
                    color: savingsColor,
                    marginBottom: "16px",
                  }}>
                    Save ${plan.savings}
                  </div>
                )}

                {/* Benefits */}
                <div style={{ marginTop: plan.savings ? "0" : "16px" }}>
                  {plan.benefits.map((benefit, index) => (
                    <div key={index} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      marginBottom: index < plan.benefits.length - 1 ? "8px" : "0",
                    }}>
                      {/* Checkmark Icon */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={savingsColor} strokeWidth="2" style={{ flexShrink: 0, marginTop: "2px" }}>
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <div style={{
                        fontFamily: "Inter, system-ui, sans-serif",
                        fontSize: "12px",
                        fontWeight: 400,
                        lineHeight: "16px",
                        color: textPrimary,
                      }}>
                        {benefit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Footer with Purchase Button */}
        <div style={{
          padding: "24px",
          borderTop: `1px solid ${borderColor}`,
          backgroundColor: modalBg,
        }}>
          <button
            onClick={() => selectedPlan && handlePurchase(selectedPlan)}
            disabled={!selectedPlan || isProcessing}
            style={{
              width: "100%",
              padding: "12px 24px",
              background: selectedPlan && !isProcessing ? gradientButton : borderColor,
              color: selectedPlan && !isProcessing ? "#ffffff" : textPrimary,
              border: "none",
              borderRadius: "8px",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              lineHeight: "20px",
              cursor: selectedPlan && !isProcessing ? "pointer" : "not-allowed",
              transition: "opacity 0.2s",
              opacity: selectedPlan && !isProcessing ? 1 : 0.6,
            }}
            onMouseEnter={(e) => {
              if (selectedPlan && !isProcessing) {
                e.currentTarget.style.opacity = "0.9";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPlan && !isProcessing) {
                e.currentTarget.style.opacity = "1";
              }
            }}
          >
            {isProcessing ? "Processing..." : selectedPlan ? `Purchase ${selectedPlan.credits} Credits - $${selectedPlan.totalPrice.toFixed(2)}` : "Select a plan to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
