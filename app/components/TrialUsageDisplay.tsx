// app/components/TrialUsageDisplay.tsx
"use client";

import { useEffect, useState } from "react";

interface TrialUsageData {
  isMaster: boolean;
  isTrial: boolean;
  articlesGenerated: number;
  topicDiscoveryRuns: number;
  maxArticles: number | null;
  maxTopicDiscoveryRuns: number | null;
  articlesRemaining: number | null;
  topicDiscoveryRunsRemaining: number | null;
  error?: string;
}

export default function TrialUsageDisplay() {
  const [usageData, setUsageData] = useState<TrialUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        // Get trial token from URL query parameter
        const urlParams = new URLSearchParams(window.location.search);
        const trialToken = urlParams.get("trial");
        
        // Build API URL with trial token if present
        const apiUrl = trialToken 
          ? `/api/trial-usage?trial=${encodeURIComponent(trialToken)}`
          : "/api/trial-usage";
        
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          setUsageData(data);
        } else {
          console.error("Failed to fetch trial usage");
        }
      } catch (error) {
        console.error("Error fetching trial usage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsage();
    
    // Refresh usage data every 5 seconds to keep it updated
    const interval = setInterval(fetchUsage, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return null; // Don't show anything while loading
  }

  if (!usageData || usageData.error) {
    return null; // Don't show if error or invalid
  }

  const isMaster = usageData.isMaster;

  // For master, don't show anything (unlimited access)
  if (isMaster) {
    return null;
  }

  // Calculate total remaining "credits" (topic discovery runs + articles)
  const totalRemaining = (usageData.topicDiscoveryRunsRemaining || 0) + (usageData.articlesRemaining || 0);
  const totalUsed = usageData.topicDiscoveryRuns + usageData.articlesGenerated;
  const totalLimit = (usageData.maxTopicDiscoveryRuns || 0) + (usageData.maxArticles || 0);
  const totalProgress = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

  return (
    <div style={{
      marginBottom: "1.5rem",
      padding: "0.75rem 0",
    }}>
      {/* Minimalistic Progress Bar */}
      <div style={{
        width: "100%",
        height: "6px",
        background: "var(--secondary)",
        borderRadius: "3px",
        overflow: "hidden",
        marginBottom: "0.5rem",
      }}>
        <div style={{
          width: `${Math.min(100, totalProgress)}%`,
          height: "100%",
          background: totalProgress >= 100
            ? "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)"
            : "linear-gradient(90deg, #10b981 0%, #059669 100%)",
          borderRadius: "3px",
          transition: "width 0.3s ease",
        }} />
      </div>

      {/* Credits Left Text with Refresh Icon */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
      }}>
        <span style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--foreground)",
        }}>
          {totalRemaining} credit{totalRemaining !== 1 ? "s" : ""} left
        </span>
        <button
          onClick={() => {
            const urlParams = new URLSearchParams(window.location.search);
            const trialToken = urlParams.get("trial");
            const apiUrl = trialToken 
              ? `/api/trial-usage?trial=${encodeURIComponent(trialToken)}`
              : "/api/trial-usage";
            fetch(apiUrl)
              .then(res => res.json())
              .then(data => setUsageData(data))
              .catch(err => console.error("Error refreshing:", err));
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            transition: "color 0.2s, transform 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--foreground)";
            e.currentTarget.style.transform = "rotate(180deg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.transform = "rotate(0deg)";
          }}
          title="Refresh usage"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{
              transition: "transform 0.3s ease",
            }}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
