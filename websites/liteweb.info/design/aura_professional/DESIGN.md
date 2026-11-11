---
name: Aura Professional
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#3f4850'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006397'
  primary: '#006397'
  on-primary: '#ffffff'
  primary-container: '#3498db'
  on-primary-container: '#002d47'
  inverse-primary: '#92ccff'
  secondary: '#376b00'
  on-secondary: '#ffffff'
  secondary-container: '#a3f55d'
  on-secondary-container: '#396f00'
  tertiary: '#4e6073'
  on-tertiary: '#ffffff'
  tertiary-container: '#8093a8'
  on-tertiary-container: '#192c3d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#92ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#a6f85f'
  secondary-fixed-dim: '#8bdb46'
  on-secondary-fixed: '#0c2000'
  on-secondary-fixed-variant: '#285000'
  tertiary-fixed: '#d1e4fb'
  tertiary-fixed-dim: '#b5c8df'
  on-tertiary-fixed: '#091d2e'
  on-tertiary-fixed-variant: '#36485b'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system targets high-performance professional environments where clarity, reliability, and precision are paramount. The design narrative follows a **Corporate Modern** style, characterized by a refined balance of structure and breathability. 

The UI should evoke a sense of calm authority. We achieve this through a "Swiss-inspired" approach: generous whitespace, a strict adherence to a baseline grid, and a purposeful use of color to denote action and status rather than mere decoration. The interface feels institutional yet cutting-edge, favoring functional elegance over trend-driven flourishes.

## Colors

The palette is anchored by a deep navy and crisp white foundation, ensuring maximum legibility and a stable visual environment. 

- **Primary (#3498db):** This professional blue is the signature brand color. It is reserved for high-priority calls to action, active navigation states, and primary focus indicators.
- **Secondary (#72c02c):** This vibrant green acts as a functional accent. It represents growth, positive trajectories, success states, and completion milestones.
- **Neutral/Foundation:** Use White (#ffffff) for surfaces and the Deep Navy (#2c3e50) for primary text and dark-mode containers to maintain high contrast and professional weight.

## Typography

The typographic hierarchy utilizes a multi-font strategy to separate intent. 

**Hanken Grotesk** is used for headlines and display text to provide a sharp, contemporary edge. **Inter** handles the heavy lifting of body copy and data entry for its exceptional readability and neutral tone. **JetBrains Mono** is utilized sparingly for labels, metadata, and technical values to reinforce the system's precision and "pro-tool" feel.

On mobile devices, display sizes are scaled down to prevent excessive line wrapping while maintaining the bold weight associated with the brand's authoritative voice.

## Layout & Spacing

The design system employs a **Fixed Grid** model for desktop to ensure data-heavy layouts remain readable across ultra-wide monitors, transitioning to a **Fluid Grid** for mobile and tablet devices.

- **Desktop (1440px+):** 12-column grid with 24px gutters and 64px outer margins.
- **Tablet (768px - 1439px):** 8-column fluid grid with 24px gutters.
- **Mobile (< 767px):** 4-column fluid grid with 16px gutters and 16px margins.

Spacing follows a strict 4px base unit. Internal component padding should prioritize the "Stack" variables (8px, 16px, 32px) to maintain a rhythmic vertical flow.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** rather than heavy shadows. Surfaces are differentiated by slight shifts in lightness and subtle, low-contrast outlines.

- **Level 0 (Background):** The base canvas, typically the primary neutral color.
- **Level 1 (Cards/Sections):** White background with a 1px border in a lightened tint of Navy (5-10% opacity).
- **Level 2 (Popovers/Modals):** Subtle, diffused "Ambient Shadows" (0px 8px 24px rgba(44, 62, 80, 0.08)) are used only for temporary floating elements to indicate they exist on a separate plane.
- **Active State:** Elements in focus or active state utilize the Primary Blue for their border to indicate "interactability."

## Shapes

The shape language is **Soft (0.25rem)**. This subtle rounding removes the clinical harshness of sharp corners while maintaining a professional, structured appearance. 

- **Standard Elements:** Inputs, buttons, and checkboxes use 4px (0.25rem) corners.
- **Large Containers:** Cards and modals use 8px (0.5rem) corners.
- **System Indicators:** Small badges or status dots may use circular (pill) shapes, but the primary interface avoids hyper-rounded "playful" geometry.

## Components

- **Buttons:** Primary buttons use a solid Primary Blue (#3498db) fill with white text. Secondary actions use the Deep Navy for text with a 1px border. Success-related CTAs (e.g., "Confirm Upgrade") utilize the Secondary Green (#72c02c).
- **Input Fields:** Use a 1px border of light gray, shifting to Primary Blue on focus. Labels use the "label-sm" JetBrains Mono style for a technical feel.
- **Chips/Badges:** For status indicators (e.g., "Active", "Completed"), use a light tint of Secondary Green for the background with dark green text. For general tags, use light gray tints.
- **Cards:** Cards should be flat with 1px light borders. Use internal padding of 24px (gutter) to ensure content doesn't feel cramped.
- **Data Tables:** High-density rows with 1px horizontal separators only. Use the Primary Blue for row-selection indicators and the Secondary Green for positive data trends/metrics.