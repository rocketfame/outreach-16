"use client";

import { useEffect, useState } from "react";

// Check if maintenance gate should be shown
// Can be disabled via environment variable or localStorage
const isMaintenanceEnabled = () => {
  if (typeof window === "undefined") return true;
  // Check if disabled via localStorage (for quick testing)
  const disabled = localStorage.getItem("maintenance_disabled");
  if (disabled === "true") return false;
  // Check environment variable (for production control)
  // Default to true (show gate) if not explicitly set to "false"
  const envValue = process.env.NEXT_PUBLIC_MAINTENANCE_ENABLED;
  return envValue !== "false";
};

// Check if user is master (from cookie set by proxy)
const isMasterUser = () => {
  if (typeof document === "undefined") return false;
  // Check cookie set by proxy
  const cookies = document.cookie.split(";");
  const isMasterIP = cookies.some(c => c.trim().startsWith("is_master_ip=true"));
  const bypassMaintenance = cookies.some(c => c.trim().startsWith("bypass_maintenance=true"));
  return isMasterIP || bypassMaintenance;
};

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [showGate, setShowGate] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if maintenance is enabled
    if (!isMaintenanceEnabled()) {
      setShowGate(false);
      setIsLoading(false);
      return;
    }

    // Check if user is master (from cookie)
    if (isMasterUser()) {
      setShowGate(false);
      setIsLoading(false);
      return;
    }

    // Check maintenance gate header (set by proxy)
    const maintenanceHeader = document.querySelector('meta[name="maintenance-gate"]');
    if (maintenanceHeader?.getAttribute("content") === "false") {
      setShowGate(false);
      setIsLoading(false);
      return;
    }

    // Show gate for non-master users
    setShowGate(true);
    setIsLoading(false);
  }, []);

  // Show loading state while checking
  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "var(--background)"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ 
            width: "40px", 
            height: "40px", 
            border: "4px solid var(--border)",
            borderTopColor: "var(--primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 1rem"
          }} />
          <p style={{ color: "var(--text-muted)" }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Don't show gate for master IP or if disabled
  if (!showGate) {
    return <>{children}</>;
  }

  // Show maintenance gate
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {/* Blurred content behind gate */}
      <div style={{ 
        filter: "blur(8px)",
        pointerEvents: "none",
        userSelect: "none",
        opacity: 0.3
      }}>
        {children}
      </div>

      {/* Maintenance gate overlay */}
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
        zIndex: 9999,
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
        }}>
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
            🔒
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
            Access Request Required
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
            This platform is currently in private beta. To request access and unlock the full functionality, please contact our support team.
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

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
