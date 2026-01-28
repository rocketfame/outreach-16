/**
 * Design tokens (Figma OutRea).
 * Single source of truth for colors, radii, shadows. Sync with Figma when updating.
 *
 * Figma file: https://www.figma.com/design/A5QmFDenHInwQnft6pk8KO/OutRea
 * Modal "Your Trial Period Has Ended": node-id=5-1739
 */

export const DESIGN_TOKENS = {
  /** Overlay behind modals */
  overlay: "rgba(0, 0, 0, 0.5)",
  /** Modal / card backgrounds */
  modalBg: "#ffffff",
  modalRadius: 16,
  modalShadow:
    "0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)",
  border: "#E5E7EB",
  textPrimary: "#4A5568",
  textSecondary: "#111827",
  cardBg: "#F7F8FA",
  cardRadius: 12,
  /** CTA gradient — Figma: orange → pink */
  gradientStart: "#FF6900",
  gradientEnd: "#F73399",
  gradient: "linear-gradient(90deg, #FF6900 0%, #F73399 100%)",
  success: "#10b981",
  /** Credits exhausted modal — header circle and icon inside */
  iconSize: 72,
  iconInnerSize: 38,
  /** Section title icons (What you accomplished, Upgrade to unlock) */
  sectionIconSize: 16,
  /** Checkmarks in unlock list */
  listIconSize: 14,
  /** Icon in CTA button (Upgrade Now) */
  buttonIconSize: 18,
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;
