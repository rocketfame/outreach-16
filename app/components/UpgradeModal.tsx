"use client";

import { useEffect, useState } from "react";

interface CreditPlan {
  id: string;
  credits: number;
  pricePerCredit: number;
  totalPrice: number;
  popular?: boolean;
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  trialToken?: string | null;
}

// Credit plans from Figma design
const CREDIT_PLANS: CreditPlan[] = [
  { id: "30", credits: 30, pricePerCredit: 0.60, totalPrice: 18.00 },
  { id: "100", credits: 100, pricePerCredit: 0.50, totalPrice: 50.00, popular: true },
  { id: "250", credits: 250, pricePerCredit: 0.40, totalPrice: 100.00 },
  { id: "500", credits: 500, pricePerCredit: 0.35, totalPrice: 175.00 },
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
          padding: "24px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "24px",
              fontWeight: 600,
              lineHeight: "32px",
              color: textSecondary,
              margin: "0 0 8px 0",
            }}>
              Purchase Credits
            </h2>
            <p style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 400,
              lineHeight: "20px",
              color: textPrimary,
              margin: 0,
            }}>
              Secure payment processing · Credits added instantly
            </p>
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

        {/* Current Balance */}
        <div style={{
          backgroundColor: rgbToHex(0.969, 0.973, 0.980),
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "24px",
        }}>
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
            color: textSecondary,
          }}>
            {currentBalance} Credits
          </div>
        </div>

        {/* Credit Plans */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}>
          {CREDIT_PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                border: `1px solid ${plan.popular ? rgbToHex(0.961, 0.288, 0) : borderColor}`,
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
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: popularBadgeBg,
                  color: "#ffffff",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 600,
                  fontFamily: "Inter, system-ui, sans-serif",
                }}>
                  Popular
                </div>
              )}
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
                marginBottom: "8px",
              }}>
                Credits
              </div>
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
                ${plan.pricePerCredit.toFixed(2)} per credit
              </div>
            </div>
          ))}
        </div>

        {/* Selected Plan Summary */}
        {selectedPlan && (
          <div style={{
            border: `1px solid ${borderColor}`,
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "24px",
            backgroundColor: rgbToHex(0.969, 0.973, 0.980),
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}>
              <div>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "14px",
                  fontWeight: 400,
                  lineHeight: "20px",
                  color: textPrimary,
                }}>
                  Selected Plan
                </div>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "24px",
                  fontWeight: 400,
                  lineHeight: "32px",
                  color: textSecondary,
                }}>
                  {selectedPlan.credits} Credits
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "14px",
                  fontWeight: 400,
                  lineHeight: "20px",
                  color: textPrimary,
                }}>
                  Total Price
                </div>
                <div style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "24px",
                  fontWeight: 400,
                  lineHeight: "32px",
                  color: textSecondary,
                }}>
                  ${selectedPlan.totalPrice.toFixed(2)}
                </div>
              </div>
            </div>
            <div style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "12px",
              fontWeight: 400,
              lineHeight: "16px",
              color: textPrimary,
              marginTop: "8px",
            }}>
              Credits never expire
            </div>
          </div>
        )}

        {/* Purchase Button */}
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
  );
}
