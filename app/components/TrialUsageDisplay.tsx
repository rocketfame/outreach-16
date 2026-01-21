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

  // Don't show if invalid or error
  if (!usageData || usageData.error) {
    return null;
  }

  // Show for both trial and master users
  // For master, show unlimited status

  const articlesProgress = usageData.maxArticles !== null
    ? (usageData.articlesGenerated / usageData.maxArticles) * 100
    : 0;

  const topicDiscoveryProgress = usageData.maxTopicDiscoveryRuns !== null
    ? (usageData.topicDiscoveryRuns / usageData.maxTopicDiscoveryRuns) * 100
    : 0;

  const isMaster = usageData.isMaster;

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "16px",
      padding: "1.5rem",
      marginBottom: "2rem",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        marginBottom: "1rem",
      }}>
        <div style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          background: isMaster 
            ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
            : "var(--primary-gradient)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.875rem",
          flexShrink: 0,
        }}>
          {isMaster ? "✨" : "📊"}
        </div>
        <h3 style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--foreground)",
          margin: 0,
        }}>
          {isMaster ? "Usage (Master Access)" : "Trial Usage"}
        </h3>
      </div>

      {/* Topic Discovery Progress */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}>
          <span style={{
            fontSize: "0.875rem",
            color: "var(--text-muted)",
            fontWeight: 500,
          }}>
            Topic Discovery
          </span>
          <span style={{
            fontSize: "0.875rem",
            color: "var(--foreground)",
            fontWeight: 600,
          }}>
            {isMaster ? (
              <span style={{ color: "#10b981" }}>Unlimited</span>
            ) : (
              `${usageData.topicDiscoveryRuns} / ${usageData.maxTopicDiscoveryRuns}`
            )}
          </span>
        </div>
        {!isMaster && (
          <>
            <div style={{
              width: "100%",
              height: "8px",
              background: "var(--secondary)",
              borderRadius: "4px",
              overflow: "hidden",
            }}>
              <div style={{
                width: `${Math.min(100, topicDiscoveryProgress)}%`,
                height: "100%",
                background: topicDiscoveryProgress >= 100
                  ? "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)"
                  : "var(--primary-gradient)",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }} />
            </div>
            {usageData.topicDiscoveryRunsRemaining !== null && usageData.topicDiscoveryRunsRemaining > 0 && (
              <p style={{
                fontSize: "0.75rem",
                color: "var(--text-light)",
                margin: "0.25rem 0 0 0",
              }}>
                {usageData.topicDiscoveryRunsRemaining} run{usageData.topicDiscoveryRunsRemaining !== 1 ? "s" : ""} remaining
              </p>
            )}
            {usageData.topicDiscoveryRunsRemaining === 0 && (
              <p style={{
                fontSize: "0.75rem",
                color: "#ef4444",
                margin: "0.25rem 0 0 0",
                fontWeight: 500,
              }}>
                Limit reached
              </p>
            )}
          </>
        )}
        {isMaster && (
          <p style={{
            fontSize: "0.75rem",
            color: "#10b981",
            margin: "0.25rem 0 0 0",
            fontWeight: 500,
          }}>
            No limits - full access
          </p>
        )}
      </div>

      {/* Articles Progress */}
      <div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}>
          <span style={{
            fontSize: "0.875rem",
            color: "var(--text-muted)",
            fontWeight: 500,
          }}>
            Articles Generated
          </span>
          <span style={{
            fontSize: "0.875rem",
            color: "var(--foreground)",
            fontWeight: 600,
          }}>
            {isMaster ? (
              <span style={{ color: "#10b981" }}>Unlimited</span>
            ) : (
              `${usageData.articlesGenerated} / ${usageData.maxArticles}`
            )}
          </span>
        </div>
        {!isMaster && (
          <>
            <div style={{
              width: "100%",
              height: "8px",
              background: "var(--secondary)",
              borderRadius: "4px",
              overflow: "hidden",
            }}>
              <div style={{
                width: `${Math.min(100, articlesProgress)}%`,
                height: "100%",
                background: articlesProgress >= 100
                  ? "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)"
                  : "var(--primary-gradient)",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }} />
            </div>
            {usageData.articlesRemaining !== null && usageData.articlesRemaining > 0 && (
              <p style={{
                fontSize: "0.75rem",
                color: "var(--text-light)",
                margin: "0.25rem 0 0 0",
              }}>
                {usageData.articlesRemaining} article{usageData.articlesRemaining !== 1 ? "s" : ""} remaining
              </p>
            )}
            {usageData.articlesRemaining === 0 && (
              <p style={{
                fontSize: "0.75rem",
                color: "#ef4444",
                margin: "0.25rem 0 0 0",
                fontWeight: 500,
              }}>
                Limit reached
              </p>
            )}
          </>
        )}
        {isMaster && (
          <p style={{
            fontSize: "0.75rem",
            color: "#10b981",
            margin: "0.25rem 0 0 0",
            fontWeight: 500,
          }}>
            No limits - full access
          </p>
        )}
      </div>

      {/* Info hint */}
      {!isMaster && (
        <div style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "var(--secondary)",
          borderRadius: "8px",
          border: "1px solid var(--border)",
        }}>
          <p style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            margin: 0,
            lineHeight: 1.5,
          }}>
            💡 <strong>Trial limits:</strong> You can generate up to {usageData.maxTopicDiscoveryRuns} topic discovery runs and up to {usageData.maxArticles} articles. Master access has unlimited usage.
          </p>
        </div>
      )}
    </div>
  );
}
