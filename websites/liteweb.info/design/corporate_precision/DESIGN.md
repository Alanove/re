---
name: Corporate Precision
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#3f4850'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006397'
  primary: '#006397'
  on-primary: '#ffffff'
  primary-container: '#3498db'
  on-primary-container: '#002d47'
  inverse-primary: '#92ccff'
  secondary: '#4e6073'
  on-secondary: '#ffffff'
  secondary-container: '#cfe2f9'
  on-secondary-container: '#526478'
  tertiary: '#376b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#58a305'
  on-tertiary-container: '#163000'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#92ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#d1e4fb'
  secondary-fixed-dim: '#b5c8df'
  on-secondary-fixed: '#091d2e'
  on-secondary-fixed-variant: '#36485b'
  tertiary-fixed: '#a6f85f'
  tertiary-fixed-dim: '#8bdb46'
  on-tertiary-fixed: '#0c2000'
  on-tertiary-fixed-variant: '#285000'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Manrope
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
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  max-width: 1280px
---

## Brand & Style
The design system is built upon a **Corporate / Modern** aesthetic, emphasizing reliability, systematic order, and professional clarity. It targets enterprise environments where information density must be balanced with ease of use.

The UI evokes a sense of stability and institutional trust. It utilizes a refined minimalist approach with a structured grid, generous but purposeful white space, and a focused color application to drive user confidence. The emotional response is one of calm efficiency—minimizing cognitive load while maintaining an authoritative presence.

## Colors
The palette is dominated by **Professional Blue (#3498db)**, which serves as the primary driver for all core interactions, headers, and active states. 

- **Primary (Blue):** Used for main CTAs, active navigation, links, and primary brand elements.
- **Secondary (Dark Slate):** Used for typography, icons, and deep structural elements to provide contrast.
- **Tertiary (Vibrant Green):** Reserved exclusively for small success indicators, positive delta metrics, or completed status chips. It must not be used for large surface areas or primary buttons.
- **Neutral:** A range of cool greys used for backgrounds, borders, and subtle surface divisions to maintain a clean, professional atmosphere.

## Typography
The typography system uses a pairing of **Manrope** for headlines to provide a modern, refined character, and **Inter** for body text and UI labels to ensure maximum legibility and a systematic, utilitarian feel.

Hierarchy is established through clear weight shifts and disciplined scaling. Large headlines should use tighter letter spacing to maintain visual impact, while small labels use slightly increased tracking for clarity in data-dense environments.

## Layout & Spacing
The system employs a **Fixed Grid** philosophy for desktop to maintain structural integrity, transitioning to a **Fluid Grid** for mobile devices.

- **Desktop:** 12-column grid with a 1280px max-width, 24px gutters, and 48px outside margins.
- **Tablet:** 8-column grid with 24px gutters and 32px margins.
- **Mobile:** 4-column grid with 16px gutters and 16px margins.

Spacing follows a strict 4px/8px baseline rhythm. Internal component padding should prioritize the `md` (16px) and `lg` (24px) tokens to ensure a professional, airy feel that prevents information from feeling cramped.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Low-contrast Outlines**. This design system avoids heavy shadows in favor of a flatter, more architectural stack.

- **Level 0 (Background):** Neutral base (#f8f9fa).
- **Level 1 (Cards/Surfaces):** White (#ffffff) with a 1px border (#e9ecef).
- **Level 2 (Dropdowns/Modals):** White with a very soft, diffused ambient shadow (0px 4px 20px rgba(0,0,0,0.05)) to distinguish overlaying elements from the primary canvas.
- **Interactive States:** Hover states on secondary elements should utilize subtle tonal shifts (e.g., light grey backgrounds) rather than shadow increases.

## Shapes
The shape language is **Soft**, utilizing a 0.25rem (4px) base radius. This creates a disciplined, professional appearance that feels modern but remains grounded and efficient. 

- **Standard Elements:** 4px radius (Inputs, Buttons, Small Cards).
- **Large Containers:** 8px radius (Large sections, Modals).
- **Full Rounding:** Only used for tags or specific status pills to differentiate them from functional UI buttons.

## Components
- **Buttons:** Primary buttons must be solid Professional Blue (#3498db) with white text. Secondary buttons should use a Blue outline or a subtle grey fill. Avoid green buttons entirely.
- **Navigation:** Top headers or active sidebar items should utilize Blue as the primary highlight or background indicator to reinforce brand hierarchy.
- **Input Fields:** Use 1px borders (#dee2e6). On focus, the border transitions to Primary Blue with a subtle 2px blue outer glow.
- **Chips & Tags:** Standard tags use neutral grey. Success tags use a light green tint with Tertiary Green text, reserved strictly for positive metrics.
- **Cards:** White background, 1px neutral border, 4px corner radius. No shadows unless the card is floating or draggable.
- **Data Tables:** High density, using subtle zebra striping (#f8f9fa) and 1px horizontal dividers. Headers should be bolded using the Secondary color for high contrast.