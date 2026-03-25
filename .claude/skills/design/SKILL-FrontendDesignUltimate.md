---
name: frontend-design-ultimate
description: "Create distinctive, production-grade frontend interfaces with high design quality. Anti-AI-slop aesthetics. React + Tailwind CSS + shadcn/ui. Use when building web components, pages, or applications."
argument-hint: "[component or page description]"
---

# Frontend Design Ultimate

Create distinctive, production-grade static sites from text requirements alone. No mockups, no Figma — just describe what you want and get bold, memorable designs.

**Stack**: React 18 + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion

## Design Thinking (Do This First)

Before writing any code, commit to a **BOLD aesthetic direction**:

### 1. Understand Context
- **Purpose**: What problem does this interface solve? Who uses it?
- **Audience**: Developer tools? Consumer app? Enterprise? Creative agency?
- **Constraints**: Performance requirements, accessibility needs, brand guidelines?

### 2. Choose an Extreme Tone

| Tone | Characteristics |
|------|-----------------|
| **Brutally Minimal** | Sparse, monochrome, massive typography, raw edges |
| **Maximalist Chaos** | Layered, dense, overlapping elements, controlled disorder |
| **Retro-Futuristic** | Neon accents, geometric shapes, CRT aesthetics |
| **Organic/Natural** | Soft curves, earth tones, hand-drawn elements |
| **Luxury/Refined** | Subtle animations, premium typography, restrained palette |
| **Editorial/Magazine** | Strong grid, dramatic headlines, whitespace as feature |
| **Brutalist/Raw** | Exposed structure, harsh contrasts, anti-design |
| **Art Deco/Geometric** | Gold accents, symmetry, ornate patterns |
| **Soft/Pastel** | Rounded corners, gentle gradients, friendly |
| **Industrial/Utilitarian** | Functional, monospace, data-dense |

### 3. Define the Unforgettable Element

What's the ONE thing someone will remember? A hero animation? Typography treatment? Color combination? Unusual layout?

## Aesthetics Guidelines

### Typography — NEVER Generic

**BANNED**: Inter, Roboto, Arial, system fonts, Open Sans

**DO**: Distinctive, characterful choices that elevate the design.

| Use Case | Approach |
|----------|----------|
| Display/Headlines | Bold personality — Clash, Cabinet Grotesk, Satoshi, Space Grotesk, Playfair Display |
| Body Text | Refined readability — Instrument Sans, General Sans, Plus Jakarta Sans |
| Monospace/Code | DM Mono, JetBrains Mono, IBM Plex Mono |
| Pairing Strategy | Contrast weights (thin display + bold body), contrast styles (serif + geometric sans) |

**Size Progression**: Use 3x+ jumps, not timid 1.5x increments.

### Color & Theme

**BANNED**: Purple gradients on white, evenly-distributed 5-color palettes

**DO**:
- **Dominant + Sharp Accent**: 70-20-10 rule (primary-secondary-accent)
- **CSS Variables**: `--primary`, `--accent`, `--surface`, `--text`
- **Commit to dark OR light**: Don't hedge with gray middle-grounds
- **High contrast CTAs**: Buttons should pop dramatically

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #141414;
  --text-primary: #fafafa;
  --text-secondary: #a1a1a1;
  --accent: #ff6b35;
  --accent-hover: #ff8555;
}
```

### Motion & Animation

**Priority**: One orchestrated page load > scattered micro-interactions

**High-Impact Moments**:
- Staggered hero reveals (`animation-delay`)
- Scroll-triggered section entrances
- Hover states that surprise (scale, color shift, shadow depth)
- Smooth page transitions

**Implementation**:
- CSS-only for simple animations
- Framer Motion for React
- Keep durations 200-400ms (snappy, not sluggish)

### Spatial Composition

**BANNED**: Centered, symmetrical, predictable layouts

**DO**:
- Asymmetry with purpose
- Overlapping elements
- Diagonal flow / grid-breaking
- Generous negative space OR controlled density (pick one)
- Off-grid hero sections

### Backgrounds & Atmosphere

**BANNED**: Solid white/gray backgrounds

**DO**:
- Gradient meshes (subtle, not garish)
- Noise/grain textures (SVG filter or CSS)
- Geometric patterns (dots, lines, shapes)
- Layered transparencies
- Dramatic shadows for depth
- Blur effects for glassmorphism

```css
/* Subtle grain overlay */
.grain::before {
  content: '';
  position: fixed;
  inset: 0;
  background: url("data:image/svg+xml,...") repeat;
  opacity: 0.03;
  pointer-events: none;
}
```

## Mobile-First Patterns

### Critical Rules

| Pattern | Desktop | Mobile Fix |
|---------|---------|------------|
| Hero with hidden visual | 2-column grid | Switch to `display: flex` (not grid) |
| Large selection lists | Horizontal scroll | Accordion with category headers |
| Multi-column forms | Side-by-side | Stack vertically |
| Status/alert cards | Inline | `align-items: center` + `text-align: center` |
| Feature grids | 3-4 columns | Single column |

### Breakpoints
```css
@media (max-width: 1200px) { /* Tablet - stack sidebars */ }
@media (max-width: 768px) { /* Mobile - full single column */ }
@media (max-width: 480px) { /* Small mobile - compact spacing */ }
```

### Font Scaling
```css
@media (max-width: 768px) {
  .hero-title { font-size: 32px; }      /* from ~48px */
  .section-title { font-size: 24px; }   /* from ~32px */
  .section-subtitle { font-size: 14px; } /* from ~16px */
}
```

## Pre-Implementation Checklist

### Design Quality
- [ ] Typography is distinctive (no Inter/Roboto/Arial)
- [ ] Color palette has clear dominant + accent (not evenly distributed)
- [ ] Background has atmosphere (not solid white/gray)
- [ ] At least one memorable/unforgettable element
- [ ] Animations are orchestrated (not scattered)

### Mobile Responsiveness
- [ ] Hero centers on mobile (no empty grid space)
- [ ] All grids collapse to single column
- [ ] Forms stack vertically
- [ ] Font sizes scale down appropriately

### Form Consistency
- [ ] Input, select, textarea all styled consistently
- [ ] Radio/checkbox visible
- [ ] Dropdown options have readable backgrounds
- [ ] Labels use CSS variables (not hardcoded colors)

### Accessibility
- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Focus states visible
- [ ] Semantic HTML (nav, main, section, article)
- [ ] Keyboard navigation works

## shadcn/ui Components

Most used for landing pages:
- `Button`, `Badge` — CTAs and labels
- `Card` — Feature cards, pricing tiers
- `Accordion` — FAQ sections
- `Dialog` — Modals, video players
- `NavigationMenu` — Header nav
- `Tabs` — Feature showcases

Based on Anthropic's frontend-design, web-artifacts-builder, and community frontend-design-v2 skills.
