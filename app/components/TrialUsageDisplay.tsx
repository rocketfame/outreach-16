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
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchUsage = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const trialToken = urlParams.get("trial");
      const apiUrl = trialToken
        ? `/api/trial-usage?trial=${encodeURIComponent(trialToken)}&_t=${Date.now()}`
        : `/api/trial-usage?_t=${Date.now()}`;

      const response = await fetch(apiUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsageData(data);
      }
    } catch (error) {
      console.error("[TrialUsageDisplay] Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedFetchUsage = (() => {
    let timeoutId: NodeJS.Timeout | null = null;
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fetchUsage(), 500);
    };
  })();

  useEffect(() => {
    fetchUsage();
    const handleRefreshUsage = () => debouncedFetchUsage();
    window.addEventListener('trialUsageUpdated', handleRefreshUsage);
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchUsage();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('trialUsageUpdated', handleRefreshUsage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (isLoading || !usageData || usageData.error || usageData.isMaster || !usageData.isTrial) {
    return null;
  }

  const totalUsed = usageData.topicDiscoveryRuns + usageData.articlesGenerated + usageData.imagesGenerated;
  const totalLimit = (usageData.maxTopicDiscoveryRuns || 0) + (usageData.maxArticles || 0) + (usageData.maxImages || 0);
  const progressPercent = totalLimit > 0 ? Math.min(100, (totalUsed / totalLimit) * 100) : 0;

  // Determine progress bar color based on usage
  const getProgressColor = () => {
    if (progressPercent < 50) return "linear-gradient(90deg, #10b981 0%, #34d399 100%)";
    if (progressPercent < 80) return "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)";
    return "linear-gradient(90deg, #ef4444 0%, #f87171 100%)";
  };

  // Icon components as inline SVGs — clean Lucide-inspired style
  const CompassIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="currentColor" opacity="0.15" stroke="none"/>
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
    </svg>
  );

  const FileTextIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10,9 9,9 8,9"/>
    </svg>
  );

  const ImageIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21,15 16,10 5,21"/>
    </svg>
  );

  const ChevronIcon = ({ down }: { down: boolean }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: "transform 200ms ease", transform: down ? "rotate(180deg)" : "rotate(0deg)" }}>
      <polyline points="18,15 12,9 6,15"/>
    </svg>
  );

  const SparklesIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/>
    </svg>
  );

  // Stat pill component
  const StatPill = ({ icon, label, used, max, color }: {
    icon: React.ReactNode; label: string; used: number; max: number; color: string
  }) => {
    const pct = max > 0 ? (used / max) * 100 : 0;
    const isExhausted = used >= max;
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "8px",
        background: isExhausted ? "rgba(239,68,68,0.08)" : "rgba(0,0,0,0.03)",
        border: `1px solid ${isExhausted ? "rgba(239,68,68,0.2)" : "transparent"}`,
        transition: "all 200ms ease",
      }}>
        <span style={{ color, display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
        <span style={{
          fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
          fontSize: "11.5px",
          fontWeight: 600,
          color: isExhausted ? "#dc2626" : "#475569",
          whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
        }}>
          {used}<span style={{ opacity: 0.4, fontWeight: 400 }}>/</span>{max}
        </span>
      </div>
    );
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      marginTop: "1.5rem",
      marginBottom: "1rem",
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #fffbf7 0%, #fef5f0 50%, #fdf2f8 100%)",
        border: "1px solid rgba(255,170,100,0.25)",
        borderRadius: "16px",
        padding: "0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(255,107,157,0.06)",
        minWidth: "fit-content",
        maxWidth: "100%",
        overflow: "hidden",
        transition: "all 300ms ease",
      }}>
        {/* Main compact bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 16px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Trial badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "3px 10px 3px 8px",
            borderRadius: "20px",
            background: "linear-gradient(135deg, #ff6b9d 0%, #ff8a65 100%)",
            flexShrink: 0,
          }}>
            <SparklesIcon />
            <span style={{
              fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
              fontSize: "11px",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}>
              Trial
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            width: "80px",
            height: "5px",
            background: "rgba(0,0,0,0.06)",
            borderRadius: "100px",
            overflow: "hidden",
            flexShrink: 0,
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: getProgressColor(),
              borderRadius: "100px",
              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }} />
          </div>

          {/* Stats */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}>
            <StatPill
              icon={<CompassIcon />}
              label="Topics"
              used={usageData.topicDiscoveryRuns}
              max={usageData.maxTopicDiscoveryRuns || 0}
              color="#8b5cf6"
            />
            <StatPill
              icon={<FileTextIcon />}
              label="Articles"
              used={usageData.articlesGenerated}
              max={usageData.maxArticles || 0}
              color="#3b82f6"
            />
            <StatPill
              icon={<ImageIcon />}
              label="Images"
              used={usageData.imagesGenerated}
              max={usageData.maxImages || 0}
              color="#f59e0b"
            />
          </div>

          {/* Upgrade button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('openUpgradeModal'));
            }}
            className="trial-upgrade-btn"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #ff6b9d 0%, #f43f5e 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "7px 16px",
              fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
              fontSize: "12px",
              fontWeight: 700,
              lineHeight: "1",
              cursor: "pointer",
              transition: "all 200ms ease",
              whiteSpace: "nowrap",
              letterSpacing: "0.01em",
              boxShadow: "0 2px 8px rgba(244,63,94,0.25)",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(244,63,94,0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(244,63,94,0.25)";
            }}
          >
            Upgrade
          </button>

          {/* Expand toggle */}
          <div style={{
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}>
            <ChevronIcon down={isExpanded} />
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div style={{
            borderTop: "1px solid rgba(0,0,0,0.05)",
            padding: "12px 16px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "10px",
            background: "rgba(255,255,255,0.5)",
          }}>
            {/* Topic Discovery */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(139,92,246,0.04)",
              border: "1px solid rgba(139,92,246,0.1)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#8b5cf6" }}>
                <CompassIcon />
                <span style={{
                  fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#8b5cf6",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}>
                  Topic Discovery
                </span>
              </div>
              <div style={{
                fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
                fontSize: "20px",
                fontWeight: 800,
                color: "#1e293b",
                lineHeight: 1,
              }}>
                {usageData.topicDiscoveryRuns}<span style={{ fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>/{usageData.maxTopicDiscoveryRuns || 0}</span>
              </div>
              <span style={{
                fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
                fontSize: "10.5px",
                color: "#64748b",
                lineHeight: 1.3,
              }}>
                searches used — up to 8 articles from discovered topics
              </span>
              {/* Mini progress */}
              <div style={{ height: "3px", borderRadius: "100px", background: "rgba(139,92,246,0.12)", overflow: "hidden" }}>
                <div style={{
                  width: `${(usageData.maxTopicDiscoveryRuns || 0) > 0 ? (usageData.topicDiscoveryRuns / (usageData.maxTopicDiscoveryRuns || 1)) * 100 : 0}%`,
                  height: "100%",
                  background: "#8b5cf6",
                  borderRadius: "100px",
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>

            {/* Articles */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(59,130,246,0.04)",
              border: "1px solid rgba(59,130,246,0.1)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#3b82f6" }}>
                <FileTextIcon />
                <span style={{
                  fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#3b82f6",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}>
                  Articles
                </span>
              </div>
              <div style={{
                fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
                fontSize: "20px",
                fontWeight: 800,
                color: "#1e293b",
                lineHeight: 1,
              }}>
                {usageData.articlesGenerated}<span style={{ fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>/{usageData.maxArticles || 0}</span>
              </div>
              <span style={{
                fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
                fontSize: "10.5px",
                color: "#64748b",
                lineHeight: 1.3,
              }}>
                total across Discovery + Direct Creation modes
              </span>
              {/* Mini progress */}
              <div style={{ height: "3px", borderRadius: "100px", background: "rgba(59,130,246,0.12)", overflow: "hidden" }}>
                <div style={{
                  width: `${(usageData.maxArticles || 0) > 0 ? (usageData.articlesGenerated / (usageData.maxArticles || 1)) * 100 : 0}%`,
                  height: "100%",
                  background: "#3b82f6",
                  borderRadius: "100px",
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>

            {/* Images */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(245,158,11,0.04)",
              border: "1px solid rgba(245,158,11,0.1)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f59e0b" }}>
                <ImageIcon />
                <span style={{
                  fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#f59e0b",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}>
                  Images
                </span>
              </div>
              <div style={{
                fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
                fontSize: "20px",
                fontWeight: 800,
                color: "#1e293b",
                lineHeight: 1,
              }}>
                {usageData.imagesGenerated}<span style={{ fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>/{usageData.maxImages || 0}</span>
              </div>
              <span style={{
                fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
                fontSize: "10.5px",
                color: "#64748b",
                lineHeight: 1.3,
              }}>
                AI image generations available
              </span>
              {/* Mini progress */}
              <div style={{ height: "3px", borderRadius: "100px", background: "rgba(245,158,11,0.12)", overflow: "hidden" }}>
                <div style={{
                  width: `${(usageData.maxImages || 0) > 0 ? (usageData.imagesGenerated / (usageData.maxImages || 1)) * 100 : 0}%`,
                  height: "100%",
                  background: "#f59e0b",
                  borderRadius: "100px",
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
