# Design Guidelines: IFRS 15 Contract Management System

## Design Approach

**Selected System:** Custom Innovative Color Palette  
**Justification:** Enterprise financial compliance application with a modern, vibrant aesthetic that stands out while maintaining professionalism. The color palette uses white as a clean background with vibrant green, blue, and purple accents for an innovative yet trustworthy appearance.

**Key Principles:**
- Clean white backgrounds for clarity and readability
- Vibrant green (#10b981) as primary action color - represents growth and financial success
- Blue (#3b82f6) for data visualization and information hierarchy
- Purple (#8b5cf6) as accent color for highlights and special features
- No emoji icons - using Lucide React icon library exclusively
- Full light/dark mode support

---

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Background: Pure white (#ffffff)
- Foreground: Deep purple-gray for text
- Primary: Vibrant green (HSL 152 76% 40%) - buttons, links, active states
- Accent: Purple (HSL 262 80% 55%) - highlights, badges, special features
- Charts: Blue, Green, Purple variations for data visualization

**Dark Mode:**
- Background: Deep purple-gray (#141318)
- Foreground: Near white (#fafafa)
- Primary: Bright green (HSL 152 76% 45%) - enhanced for dark backgrounds
- Accent: Bright purple (HSL 262 80% 60%) - enhanced visibility
- Charts: Lighter versions of blue, green, purple for dark backgrounds

### B. Typography

**Font Stack:** Open Sans, system sans-serif fallback

**Hierarchy:**
- Page Headers: 32px, Semibold (font-semibold)
- Section Headers: 24px, Semibold
- Subsection/Card Headers: 18px, Medium (font-medium)
- Body Text: 14px, Regular
- Data Tables: 14px, Regular
- Labels/Metadata: 12px, Regular
- Fine Print/Timestamps: 11px, Regular

**Usage Patterns:**
- Contract amounts and financial figures: Tabular numbers, Medium weight
- Status indicators: 12px, Medium, uppercase
- Form labels: 12px, Medium
- Error messages: 14px, Regular

### C. Layout System

**Spacing Primitives:** Tailwind units of **2, 4, 6, 8, 12, 16**

**Common Patterns:**
- Component padding: `p-6` or `p-8`
- Section margins: `mb-8` or `mb-12`
- Card spacing: `space-y-6`
- Form field gaps: `gap-4`
- Table cell padding: `px-4 py-2`
- Page container: `max-w-7xl mx-auto px-6`

**Grid Structure:**
- Dashboard: 12-column grid (`grid-cols-12`)
- Data tables: Full-width with horizontal scroll when needed
- Forms: 2-column layout for efficiency (`grid-cols-2 gap-6`)
- Reports: Single column, `max-w-5xl` for readability

---

## D. Component Library

### Icons

**IMPORTANT: No emoji icons allowed**
- Use Lucide React icons exclusively for all UI icons
- Use react-icons/si for company/brand logos only
- Icons should be sized appropriately: 16px for inline, 20px for buttons, 24px for headers

### Navigation

**Sidebar Navigation:**
- Left sidebar using Shadcn sidebar primitives
- Width: `20rem`, collapsible to icon-only
- Module icons with labels (Lucide icons only)
- Active state: Green accent background

**Header:**
- Fixed header with sidebar trigger and theme toggle
- Height: `h-14`

### Core UI Elements

**Cards:**
- Container: White background (light) / dark purple-gray (dark)
- Subtle border with rounded corners
- Header with action buttons in opposite corner

**Data Tables:**
- Alternating row backgrounds for scannability
- Sticky headers for long scrolls
- Sortable columns with clear indicators
- Row actions in rightmost column

**Badges/Status Indicators:**
- Pill-shaped with small radius
- Color-coded by status:
  - Active/Success: Green variant
  - Warning/Pending: Purple accent variant
  - Error/Cancelled: Destructive red
  - Neutral/Draft: Secondary gray

### Forms

**Input Fields:**
- Standard height: `h-10`
- Label above input: `text-sm font-medium mb-1`
- Focus ring: Green primary color
- Error state: Red border + error message

### Data Displays

**Financial Data Cards:**
- Large metric display: 28px, Semibold
- Label above: 12px, Medium, uppercase
- Trend indicator with Lucide icon (TrendingUp, TrendingDown)
- Green for positive trends, red for negative

**Charts:**
- Primary chart color: Blue (#3b82f6)
- Secondary: Green (#10b981)
- Tertiary: Purple (#8b5cf6)
- Use Recharts library

---

## E. Animations

**Minimal Motion:**
- Hover: Subtle background elevation
- Modal entry: Fade + slight scale
- Loading: Skeleton placeholders
- No decorative animations

---

## F. Theme Toggle

**Implementation:**
- Sun/Moon icon button in header
- Smooth transition between modes
- Persists preference in localStorage
- System preference detection

---

## Images

No hero images - this is a data-focused enterprise application. All visual emphasis on clear data presentation with the vibrant color palette providing visual interest.
