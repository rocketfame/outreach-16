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

// Helper function to convert RGB 0-1 to hex
const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
};

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
    return null; // Don't show if no data
  }

  if (usageData.error) {
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
    return null;
  }

  // Calculate progress for the progress bar (based on total usage)
  const totalUsed = usageData.topicDiscoveryRuns + usageData.articlesGenerated + usageData.imagesGenerated;
  const totalLimit = (usageData.maxTopicDiscoveryRuns || 0) + (usageData.maxArticles || 0) + (usageData.maxImages || 0);
  const progressPercent = totalLimit > 0 ? Math.min(100, (totalUsed / totalLimit) * 100) : 0;

  // Colors from Figma design
  const cardBgGradient = `linear-gradient(180deg, ${rgbToHex(1, 0.969, 0.929)} 0%, ${rgbToHex(0.991, 0.949, 0.972)} 100%)`;
  const cardBorder = rgbToHex(1, 0.841, 0.657);
  const trialModeText = rgbToHex(0.212, 0.255, 0.325);
  const progressBarBg = rgbToHex(0.898, 0.906, 0.922);
  const progressBarGradient = `linear-gradient(90deg, ${rgbToHex(0, 0.787, 0.316)} 0%, ${rgbToHex(0, 0.739, 0.489)} 100%)`;
  const counterText = rgbToHex(0.415, 0.447, 0.510);
  const dividerColor = rgbToHex(0.819, 0.836, 0.861);
  const upgradeButtonGradient = `linear-gradient(90deg, ${rgbToHex(0.961, 0.288, 0)} 0%, ${rgbToHex(0.901, 0, 0.463)} 100%)`;
  const iconColor = rgbToHex(0.153, 0.161, 0.175);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      marginTop: "1.5rem",
      marginBottom: "1rem",
    }}>
      {/* Card container matching Figma design */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        background: cardBgGradient,
        border: `1px solid ${cardBorder}`,
        borderRadius: "14px",
        padding: "10px 12px",
        boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1), 0px 1px 3px rgba(0, 0, 0, 0.1)",
        minWidth: "fit-content",
        maxWidth: "100%",
      }}>
        {/* Main horizontal layout */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}>
          {/* Left side: Icon + Trial Mode + Progress Bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flex: "1 1 auto",
            minWidth: 0,
          }}>
            {/* Icon (orange/gold) */}
            <div style={{
              width: "14px",
              height: "14px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 1.75L10.5 1.75M3.5 7L10.5 7M3.5 12.25L10.5 12.25" 
                      stroke={rgbToHex(0.961, 0.286, 0)} 
                      strokeWidth="1.17" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Trial Mode text */}
            <span style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "12px",
              fontWeight: 500,
              lineHeight: "16px",
              color: trialModeText,
              whiteSpace: "nowrap",
            }}>
              Trial Mode
            </span>

            {/* Progress Bar */}
            <div style={{
              width: "96px",
              height: "6px",
              background: progressBarBg,
              borderRadius: "16777200px", // Very rounded (from Figma)
              overflow: "hidden",
              flexShrink: 0,
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: progressBarGradient,
                borderRadius: "16777200px",
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>

          {/* Right side: Usage counters with icons */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}>
            {/* Topic Discovery Runs */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}>
              <div style={{
                width: "12px",
                height: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="2.5" stroke={iconColor} strokeWidth="1" fill="none"/>
                  <path d="M6 3.5V6M6 6V8.5" stroke={iconColor} strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </div>
              <span style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: "16px",
                color: counterText,
                whiteSpace: "nowrap",
              }}>
                {usageData.topicDiscoveryRuns}/{usageData.maxTopicDiscoveryRuns || 0}
              </span>
            </div>

            {/* Divider */}
            <span style={{
              fontSize: "12px",
              lineHeight: "16px",
              color: dividerColor,
            }}>
              •
            </span>

            {/* Articles Generated */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}>
              <div style={{
                width: "12px",
                height: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="2" y="2" width="8" height="8" rx="1" stroke={iconColor} strokeWidth="1" fill="none"/>
                  <path d="M2 4H10M2 6H10" stroke={iconColor} strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </div>
              <span style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: "16px",
                color: counterText,
                whiteSpace: "nowrap",
              }}>
                {usageData.articlesGenerated}/{usageData.maxArticles || 0}
              </span>
            </div>

            {/* Divider */}
            <span style={{
              fontSize: "12px",
              lineHeight: "16px",
              color: dividerColor,
            }}>
              •
            </span>

            {/* Images Generated */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}>
              <div style={{
                width: "12px",
                height: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke={iconColor} strokeWidth="1" fill="none"/>
                  <circle cx="4" cy="4" r="1" fill={iconColor}/>
                  <path d="M1.5 8L4 6L6.5 7.5L10.5 4.5" stroke={iconColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: "16px",
                color: counterText,
                whiteSpace: "nowrap",
              }}>
                {usageData.imagesGenerated}/{usageData.maxImages || 0}
              </span>
            </div>

            {/* Upgrade Button */}
            <button
              onClick={() => {
                window.open('mailto:support@typereach.app?subject=Upgrade Request', '_blank');
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: upgradeButtonGradient,
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "6px 12px",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "12px",
                fontWeight: 500,
                lineHeight: "16px",
                cursor: "pointer",
                transition: "opacity 0.2s, transform 0.2s",
                whiteSpace: "nowrap",
                marginLeft: "8px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
                e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Upgrade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
