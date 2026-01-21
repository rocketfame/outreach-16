// app/components/TrialUsageDisplay.tsx
"use client";

import { useEffect, useState } from "react";

interface TrialUsageData {
  isMaster: boolean;
  isTrial: boolean;
  articlesGenerated: number;
  topicDiscoveryRuns: number;
  imagesGenerated: number;
  maxArticles: number | null;
  maxTopicDiscoveryRuns: number | null;
  maxImages: number | null;
  articlesRemaining: number | null;
  topicDiscoveryRunsRemaining: number | null;
  imagesRemaining: number | null;
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
          console.log("[TrialUsageDisplay] Received data:", data);
          setUsageData(data);
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error("[TrialUsageDisplay] Failed to fetch:", response.status, errorText);
        }
      } catch (error) {
        console.error("[TrialUsageDisplay] Error:", error);
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

  if (!usageData) {
    // Debug: log why usageData is null
    if (process.env.NODE_ENV === 'development') {
      console.log('[TrialUsageDisplay] No usageData available');
    }
    return null; // Don't show if no data
  }

  if (usageData.error) {
    // Debug: log error
    if (process.env.NODE_ENV === 'development') {
      console.log('[TrialUsageDisplay] Error:', usageData.error);
    }
    return null; // Don't show if error
  }

  const isMaster = usageData.isMaster;
  const isTrial = usageData.isTrial;

  // For master, don't show anything (unlimited access)
  if (isMaster) {
    return null;
  }

  // Only show for trial users
  if (!isTrial) {
    console.log('[TrialUsageDisplay] Not a trial user, isMaster:', isMaster, 'isTrial:', isTrial);
    return null;
  }

  console.log('[TrialUsageDisplay] Rendering for trial user, progress:', totalProgress, 'remaining:', totalRemaining);

  // Calculate total remaining "credits" (topic discovery runs + articles + images)
  const totalRemaining = (usageData.topicDiscoveryRunsRemaining || 0) + (usageData.articlesRemaining || 0) + (usageData.imagesRemaining || 0);
  const totalUsed = usageData.topicDiscoveryRuns + usageData.articlesGenerated + usageData.imagesGenerated;
  const totalLimit = (usageData.maxTopicDiscoveryRuns || 0) + (usageData.maxArticles || 0) + (usageData.maxImages || 0);
  const totalProgress = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

  console.log('[TrialUsageDisplay] Rendering component:', {
    totalRemaining,
    totalUsed,
    totalLimit,
    totalProgress,
    isTrial,
    isMaster
  });

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "0.25rem",
      minWidth: "140px",
      zIndex: 10, // Ensure it's visible
    }}>
      {/* Minimalistic Progress Bar - fills from center */}
      <div style={{
        width: "100%",
        height: "4px",
        background: "var(--secondary)",
        borderRadius: "2px",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Progress bar that fills from center */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: 0,
          height: "100%",
          width: `${Math.min(100, totalProgress)}%`,
          transform: "translateX(-50%)",
          background: totalProgress >= 100
            ? "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)"
            : "linear-gradient(90deg, #10b981 0%, #059669 100%)",
          borderRadius: "2px",
          transition: "width 0.3s ease",
        }} />
      </div>

      {/* Credits Left Text with Refresh Icon */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        fontSize: "0.75rem",
      }}>
        <span style={{
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
          title={`Trial: ${usageData.maxTopicDiscoveryRuns} topic searches, ${usageData.maxArticles} articles, ${usageData.maxImages} image`}
        >
          <svg 
            width="14" 
            height="14" 
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
