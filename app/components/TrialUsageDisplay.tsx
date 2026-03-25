"use client";

import { useEffect, useState } from "react";

interface TrialUsageData {
  isMaster: boolean;
  isTrial: boolean;
  discoveryArticlesGenerated: number;
  directArticlesGenerated: number;
  maxDiscoveryArticles: number;
  maxDirectArticles: number;
  articlesGenerated: number;
  topicDiscoveryRuns: number;
  imagesGenerated: number;
  maxArticles: number | null;
  maxTopicDiscoveryRuns: number | null;
  maxImages: number | null;
  error?: string;
}

/* ─── SVG іконки (Lucide-стиль) ─── */

const CompassIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="currentColor" opacity="0.15" stroke="none"/>
    <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
  </svg>
);

const FileTextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const PenToolIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z"/>
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
    <path d="M2 2l7.586 7.586"/>
    <circle cx="11" cy="11" r="2"/>
  </svg>
);

const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21,15 16,10 5,21"/>
  </svg>
);

const SparklesIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/>
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 200ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
    <polyline points="18,15 12,9 6,15"/>
  </svg>
);

/* ─── Стилі ─── */

const FONT = "var(--font-sans), Inter, system-ui, -apple-system, sans-serif";

/* ─── Компонент ─── */

export default function TrialUsageDisplay() {
  const [data, setData] = useState<TrialUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchUsage = async () => {
    try {
      const token = new URLSearchParams(window.location.search).get("trial");
      const url = token
        ? `/api/trial-usage?trial=${encodeURIComponent(token)}&_t=${Date.now()}`
        : `/api/trial-usage?_t=${Date.now()}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache" },
      });
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("[TrialUsageDisplay]", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    let tid: NodeJS.Timeout;
    const debounced = () => { clearTimeout(tid); tid = setTimeout(fetchUsage, 500); };
    window.addEventListener("trialUsageUpdated", debounced);
    const vis = () => { if (!document.hidden) fetchUsage(); };
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("trialUsageUpdated", debounced);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  if (loading || !data || data.error || data.isMaster || !data.isTrial) return null;

  const discoveryArt = data.discoveryArticlesGenerated ?? 0;
  const directArt = data.directArticlesGenerated ?? 0;
  const maxDisc = data.maxDiscoveryArticles ?? 4;
  const maxDir = data.maxDirectArticles ?? 8;
  const discRuns = data.topicDiscoveryRuns ?? 0;
  const maxRuns = data.maxTopicDiscoveryRuns ?? 4;
  const imgs = data.imagesGenerated ?? 0;
  const maxImgs = data.maxImages ?? 10;

  const totalUsed = discRuns + discoveryArt + directArt + imgs;
  const totalMax = maxRuns + maxDisc + maxDir + maxImgs;
  const pct = totalMax > 0 ? Math.min(100, (totalUsed / totalMax) * 100) : 0;

  const progressGrad =
    pct < 50 ? "linear-gradient(90deg,#10b981,#34d399)"
    : pct < 80 ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
    : "linear-gradient(90deg,#ef4444,#f87171)";

  /* Компактний pill для верхнього рядка */
  const Pill = ({ icon, used, max, color }: { icon: React.ReactNode; used: number; max: number; color: string }) => {
    const exhausted = used >= max;
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "5px",
        padding: "3px 8px", borderRadius: "8px",
        background: exhausted ? "rgba(239,68,68,0.08)" : "rgba(0,0,0,0.03)",
        border: exhausted ? "1px solid rgba(239,68,68,0.2)" : "1px solid transparent",
        transition: "all 200ms ease",
      }}>
        <span style={{ color, display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
        <span style={{
          fontFamily: FONT, fontSize: "11.5px", fontWeight: 600,
          color: exhausted ? "#dc2626" : "#475569", whiteSpace: "nowrap", letterSpacing: "-0.01em",
        }}>
          {used}<span style={{ opacity: 0.35, fontWeight: 400 }}>/</span>{max}
        </span>
      </div>
    );
  };

  /* Розгорнута картка */
  const DetailCard = ({ icon, title, desc, used, max, color, bgAlpha }: {
    icon: React.ReactNode; title: string; desc: string;
    used: number; max: number; color: string; bgAlpha: string;
  }) => {
    const p = max > 0 ? (used / max) * 100 : 0;
    return (
      <div style={{
        display: "flex", flexDirection: "column", gap: "6px",
        padding: "10px 12px", borderRadius: "10px",
        background: bgAlpha, border: `1px solid ${color}22`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color }}>
          {icon}
          <span style={{ fontFamily: FONT, fontSize: "10.5px", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {title}
          </span>
        </div>
        <div style={{ fontFamily: FONT, fontSize: "20px", fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>
          {used}<span style={{ fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>/{max}</span>
        </div>
        <span style={{ fontFamily: FONT, fontSize: "10.5px", color: "#64748b", lineHeight: 1.3 }}>{desc}</span>
        <div style={{ height: "3px", borderRadius: "100px", background: `${color}1a`, overflow: "hidden" }}>
          <div style={{ width: `${p}%`, height: "100%", background: color, borderRadius: "100px", transition: "width 0.3s ease" }}/>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", marginTop: "1.5rem", marginBottom: "1rem" }}>
      <div style={{
        display: "flex", flexDirection: "column",
        background: "linear-gradient(135deg,#fffbf7 0%,#fef5f0 50%,#fdf2f8 100%)",
        border: "1px solid rgba(255,170,100,0.25)", borderRadius: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(255,107,157,0.06)",
        minWidth: "fit-content", maxWidth: "100%", overflow: "hidden", transition: "all 300ms ease",
      }}>
        {/* ─── Верхній рядок ─── */}
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
          onClick={() => setExpanded(!expanded)}
        >
          {/* Trial badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: "5px",
            padding: "3px 10px 3px 7px", borderRadius: "20px",
            background: "linear-gradient(135deg,#ff6b9d,#ff8a65)", flexShrink: 0,
          }}>
            <SparklesIcon />
            <span style={{ fontFamily: FONT, fontSize: "10.5px", fontWeight: 700, color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase" }}>Trial</span>
          </div>

          {/* Загальний прогрес */}
          <div style={{ width: "60px", height: "4px", background: "rgba(0,0,0,0.06)", borderRadius: "100px", overflow: "hidden", flexShrink: 0 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: progressGrad, borderRadius: "100px", transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }}/>
          </div>

          {/* 4 pill-и */}
          <div style={{ display: "flex", alignItems: "center", gap: "3px", flexWrap: "nowrap" }}>
            <Pill icon={<CompassIcon />}  used={discRuns}     max={maxRuns}  color="#8b5cf6" />
            <Pill icon={<FileTextIcon />} used={discoveryArt} max={maxDisc}  color="#6366f1" />
            <Pill icon={<PenToolIcon />}  used={directArt}    max={maxDir}   color="#3b82f6" />
            <Pill icon={<ImageIcon />}    used={imgs}         max={maxImgs}  color="#f59e0b" />
          </div>

          {/* Upgrade */}
          <button
            onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("openUpgradeModal")); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,#ff6b9d,#f43f5e)", color: "#fff", border: "none", borderRadius: "10px",
              padding: "6px 14px", fontFamily: FONT, fontSize: "11.5px", fontWeight: 700, lineHeight: 1,
              cursor: "pointer", transition: "all 200ms ease", whiteSpace: "nowrap", letterSpacing: "0.01em",
              boxShadow: "0 2px 8px rgba(244,63,94,0.25)", flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(244,63,94,0.35)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(244,63,94,0.25)"; }}
          >
            Upgrade
          </button>

          {/* Chevron */}
          <div style={{ color: "#94a3b8", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <ChevronIcon open={expanded} />
          </div>
        </div>

        {/* ─── Розгорнутий блок ─── */}
        {expanded && (
          <div style={{
            borderTop: "1px solid rgba(0,0,0,0.05)",
            padding: "12px 14px",
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px",
            background: "rgba(255,255,255,0.5)",
          }}>
            <DetailCard
              icon={<CompassIcon />}
              title="Topic Search"
              desc="Topic Discovery runs"
              used={discRuns} max={maxRuns}
              color="#8b5cf6" bgAlpha="rgba(139,92,246,0.04)"
            />
            <DetailCard
              icon={<FileTextIcon />}
              title="Discovery Articles"
              desc="Articles from discovered topics"
              used={discoveryArt} max={maxDisc}
              color="#6366f1" bgAlpha="rgba(99,102,241,0.04)"
            />
            <DetailCard
              icon={<PenToolIcon />}
              title="Direct Articles"
              desc="Articles via Direct Creation"
              used={directArt} max={maxDir}
              color="#3b82f6" bgAlpha="rgba(59,130,246,0.04)"
            />
            <DetailCard
              icon={<ImageIcon />}
              title="Images"
              desc="AI image generations"
              used={imgs} max={maxImgs}
              color="#f59e0b" bgAlpha="rgba(245,158,11,0.04)"
            />
          </div>
        )}
      </div>
    </div>
  );
}
