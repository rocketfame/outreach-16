"use client";

import { useEffect, useState } from "react";

interface TrialLimitReachedProps {
  message?: string;
  onClose?: () => void;
}

export default function TrialLimitReached({ 
  message = "Trial limit reached", 
  onClose 
}: TrialLimitReachedProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.85)",
      backdropFilter: "blur(10px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000,
      padding: "2rem",
    }}>
      <div style={{
        background: "var(--card)",
        borderRadius: "24px",
        padding: "3rem",
        maxWidth: "600px",
        width: "100%",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        textAlign: "center",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto",
        position: "relative",
      }}>
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "transparent",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "0.5rem",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s, color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--secondary)";
            e.currentTarget.style.color = "var(--foreground)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
          aria-label="Close"
        >
          ×
        </button>

        <div style={{
          width: "80px",
          height: "80px",
          margin: "0 auto 2rem",
          background: "var(--primary-gradient)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2.5rem",
          flexShrink: 0,
        }}>
          ⚠️
        </div>

        <h1 style={{
          fontSize: "2rem",
          fontWeight: 700,
          marginBottom: "1rem",
          color: "var(--foreground)",
          lineHeight: 1.2,
          textAlign: "center",
          width: "100%",
        }}>
          Trial Limit Reached
        </h1>

        <p style={{
          fontSize: "1.125rem",
          color: "var(--text-muted)",
          marginBottom: "2rem",
          lineHeight: 1.6,
          textAlign: "center",
          width: "100%",
          maxWidth: "100%",
        }}>
          {message || "You have reached the trial limit. To continue using the platform with full access, please contact our support team to purchase a full access plan."}
        </p>

        <div style={{
          background: "var(--secondary)",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "2rem",
          border: "1px solid var(--border)",
          width: "100%",
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <p style={{
            fontSize: "0.875rem",
            color: "var(--text-muted)",
            marginBottom: "0.5rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            textAlign: "center",
            width: "100%",
          }}>
            Support Email
          </p>
          <a
            href="mailto:fotosyntezaou@gmail.com"
            style={{
              fontSize: "1.25rem",
              color: "var(--primary)",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-block",
              transition: "opacity 0.2s",
              textAlign: "center",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            fotosyntezaou@gmail.com
          </a>
        </div>

        <p style={{
          fontSize: "0.875rem",
          color: "var(--text-light)",
          lineHeight: 1.5,
          textAlign: "center",
          width: "100%",
          maxWidth: "100%",
        }}>
          We'll review your request and provide access credentials as soon as possible.
        </p>
      </div>
    </div>
  );
}
