# Design Guidelines: IFRS 15 Contract Management System

## Design Approach

**Selected System:** Premium Enterprise Design Language  
**Justification:** High-end financial compliance application requiring sophisticated visual treatment that signals credibility and innovation. Combines modern glassmorphism aesthetics with enterprise-grade data presentation.

**Key Principles:**
- Premium depth through layered backgrounds, gradients, and subtle shadows
- Glassmorphism for elevated UI surfaces with backdrop blur effects
- Vibrant accent system using emerald, blue, and purple strategically
- Financial credibility through refined typography and tabular numerals
- Rich micro-interactions without sacrificing performance

---

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Primary Background: Soft gray (#f8f9fa)
- Elevated Surfaces: White with subtle shadow and 50% backdrop blur
- Deep Accents: Charcoal (#1a1a1a) for contrast elements
- Primary Action: Emerald (#10b981) with gradient to lighter shade
- Data Viz: Blue (#3b82f6), Purple (#8b5cf6), Emerald variations
- Gradients: Emerald-to-blue for primary elements, purple-to-blue for accents

**Dark Mode:**
- Primary Background: Deep charcoal (#0f0f0f)
- Elevated Surfaces: Slate gray (#1a1a1f) with glass effect and enhanced glow
- Card Backgrounds: Dark gray (#18181b) with subtle border glow
- Primary Action: Bright emerald (#34d399) with enhanced luminosity
- Glassmorphism: 40% opacity backgrounds with heavy backdrop blur
- Gradient Overlays: Brighter, more saturated versions for dark backgrounds

### B. Typography

**Font Stack:** Inter Variable, system-ui fallback

**Hierarchy:**
- Display Headers: 36px, Bold (font-bold), tight tracking
- Page Headers: 28px, Semibold, gradient text on key metrics
- Section Headers: 20px, Semibold
- Card Headers: 16px, Medium
- Body/Data: 14px, Regular, tabular-nums for financial figures
- Labels: 13px, Medium, uppercase tracking
- Metadata: 12px, Regular, tabular-nums

**Financial Data Treatment:**
- All currency amounts: Tabular numerals, Medium weight, 16px minimum
- Percentage changes: Bold weight with colored backgrounds
- Large metrics: 32px, Bold, with gradient fill on significant values

### C. Layout System

**Spacing Primitives:** Tailwind units of **3, 4, 6, 8, 12, 16, 24**

**Patterns:**
- Card padding: `p-6` to `p-8`
- Glass surfaces: Additional `border border-white/10` with `backdrop-blur-xl`
- Section gaps: `gap-6` to `gap-8`
- Dashboard grid: Asymmetric 12-column with varied card spans
- Container: `max-w-[1600px] mx-auto px-8`

---

## D. Component Library

### Icons
- **Primary:** Phosphor Icons (Duotone variant) via CDN
- **Size Standards:** 20px inline, 24px buttons, 32px feature cards
- **Treatment:** Duotone with gradient fills on active/hover states

### Navigation

**Sidebar:**
- Width: `280px`, collapsible to `80px`
- Background: Gradient from charcoal to deep slate with glass overlay
- Logo area: 64px height with gradient brand treatment
- Active state: Emerald gradient background with enhanced glow
- Section dividers: Subtle gradient lines

**Header:**
- Height: `64px`
- Glass effect with backdrop blur
- Contains: breadcrumbs, global search, notifications, user menu, theme toggle

### Premium UI Elements

**Glass Cards:**
- Background: White/10 (dark) or white with 50% blur (light)
- Border: Subtle gradient border (1px)
- Shadow: Layered shadows for depth (sm + lg combined)
- Hover: Lift effect with enhanced shadow and subtle scale (1.01)

**Dashboard Cards (Asymmetric):**
- Financial summary: 2x height span with large metrics and sparkline
- Quick actions: 1x1 compact cards with gradient backgrounds
- Charts: 2x1 landscape cards with premium chart styling
- Status indicators: 1x1 with radial progress and glass effect

**Data Tables:**
- Header: Glass effect with gradient underline
- Rows: Subtle hover with glass background
- Alt rows: Very subtle background tint
- Sticky columns: Enhanced shadow separation
- Cell padding: `px-6 py-4`

**Badges:**
- Rounded-full pills with gradient backgrounds
- Status colors with 20% opacity fill + solid border
- Icon + text combination with duotone icons

### Forms

**Premium Inputs:**
- Height: `h-11`
- Background: Glass effect in dark mode, white in light
- Focus: Emerald ring with glow effect
- Floating labels for premium feel
- Icons positioned inside inputs (duotone treatment)

### Data Visualization

**Charts (Recharts):**
- Gradient fills beneath line charts
- Glass effect tooltips with backdrop blur
- Animated entry (smooth 800ms ease)
- Grid lines: Subtle with 10% opacity
- Premium axis styling with tabular numerals

**Sparklines:**
- Embedded in metric cards
- Emerald gradient with glow on positive trends
- Red gradient on negative trends
- 40px height, minimal styling

---

## E. Animations & Interactions

**Micro-interactions:**
- Button hover: Subtle scale (1.02) + enhanced shadow + gradient shift
- Card hover: Lift with shadow spread
- Modal entry: Fade + slide from bottom (300ms ease-out)
- Page transitions: Crossfade between views
- Loading: Skeleton with shimmer gradient animation
- Number counters: Animated count-up on metric changes

**Performance:**
- Use `transform` and `opacity` for animations only
- Hardware acceleration with `will-change` on interactive elements
- Reduced motion support via `prefers-reduced-motion`

---

## F. Glass Effects Implementation

**Glass Surfaces:**
- Backdrop blur: `backdrop-blur-xl` (24px)
- Background opacity: 40-60% of base color
- Border: 1px solid white/10 (dark) or black/5 (light)
- Inner shadow for depth perception

**Gradient Treatments:**
- Primary buttons: Linear emerald-to-lighter-emerald
- Accent cards: Radial purple-to-blue from top-left
- Sidebar: Vertical charcoal-to-slate gradient
- Status indicators: Matching color gradient fills

---

## G. Theme Toggle

- Smooth 200ms transition for all color properties
- System preference detection with override capability
- Gradient icon button with glass background
- Persisted in localStorage

---

## Images

**No hero images** - Enterprise data application. Visual interest created through premium glassmorphism, gradients, and sophisticated data visualization. Brand logo in sidebar with gradient treatment.