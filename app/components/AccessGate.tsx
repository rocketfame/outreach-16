"use client";

import { useEffect, useState } from "react";

interface AccessGateProps {
  children: React.ReactNode;
}

export default function AccessGate({ children }: AccessGateProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Check localStorage only on client side
    const hasAccess = localStorage.getItem("typereach_access") === "true";
    setIsAuthorized(hasAccess);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const correctCode = process.env.NEXT_PUBLIC_APP_ACCESS_KEY || "typereach-beta";

    if (accessCode === correctCode) {
      localStorage.setItem("typereach_access", "true");
      setIsAuthorized(true);
    } else {
      setError("Wrong access code");
    }
  };

  // Show nothing while checking (prevents flash)
  if (isAuthorized === null) {
    return null;
  }

  // Show app if authorized
  if (isAuthorized) {
    return <>{children}</>;
  }

  // Show access form
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
      }}
    >
      <div
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "12px",
          padding: "2rem",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          border: "1px solid var(--border)",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            margin: "0 0 0.5rem 0",
            color: "var(--foreground)",
            textAlign: "center",
          }}
        >
          TypeReach Beta Access
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--text-muted)",
            margin: "0 0 1.5rem 0",
            textAlign: "center",
          }}
        >
          Enter your access code to start using the app.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={accessCode}
            onChange={(e) => {
              setAccessCode(e.target.value);
              setError("");
            }}
            placeholder="Access code"
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              border: `1px solid ${error ? "#f44336" : "var(--border)"}`,
              borderRadius: "8px",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              marginBottom: error ? "0.5rem" : "1rem",
              outline: "none",
              transition: "border-color 0.2s ease",
            }}
            autoFocus
          />
          {error && (
            <p
              style={{
                color: "#f44336",
                fontSize: "0.875rem",
                margin: "0 0 1rem 0",
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--primary-text)",
              background: "var(--primary-gradient)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "opacity 0.2s ease, transform 0.1s ease",
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.98)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}

