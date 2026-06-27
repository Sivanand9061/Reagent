---
name: Modern Academic SaaS
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0b1c30'
  on-tertiary-container: '#75859d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  max-width: 1280px
---

## Brand & Style
The design system embodies a modern academic SaaS aesthetic, prioritizing clarity, efficiency, and professional rigor. It transitions traditional academic values into a sleek, digital-first experience. The style is rooted in **Minimalism** with a **Corporate/Modern** influence, focusing on high-density information presented with low visual friction.

The target audience consists of researchers, educators, and students who require a focused environment. The UI evokes a sense of calm authority and technological sophistication through generous whitespace, precise alignment, and a restrained decorative palette.

## Colors
The palette is anchored by a deep navy primary, providing a serious, grounded foundation. The secondary blue is used sparingly for primary actions and interactive highlights, while the tertiary slate manages metadata and secondary information.

The interface leans heavily into a clean "Light" mode. Surfaces are primarily white or very light gray (`#F8FAFC`), utilizing subtle tonal shifts rather than high-contrast borders to define structure. Functional colors (Success, Warning, Error) should follow standard SaaS conventions but with slightly desaturated tones to maintain the professional atmosphere.

## Typography
This design system utilizes **Inter** exclusively to ensure maximum legibility across dense data and academic texts. The type scale is systematic, relying on weight variations and subtle tracking adjustments to establish hierarchy.

Large headlines use tighter tracking and heavier weights to feel "architectural," while body copy uses standard tracking and generous line heights (1.5x - 1.6x) to facilitate long-form reading. Labels are slightly tracked out when in uppercase to improve scanability in navigation and table headers.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for desktop to maintain readability of long-form academic content, centering the main stage. A 12-column system is used for dashboards, while a 1-column focused reading view is used for document-heavy pages.

Spacing is built on a 4px baseline, but defaults to 16px (md) and 24px (lg) for most structural gaps to ensure a "breezy" minimalist feel. On mobile, margins shrink to 16px, and complex grids reflow into a single column stack. Vertical rhythm is strictly maintained to reinforce the professional, structured nature of the system.

## Elevation & Depth
Hierarchy is achieved through **Tonal Layers** and **Low-contrast Outlines**. 
- **Surfaces:** Use a slight background shift (e.g., White to Slate-50) to distinguish the navigation from the content area.
- **Shadows:** Use ultra-subtle, large-radius shadows (e.g., `0 4px 20px rgba(15, 23, 42, 0.05)`) for elevated components like modals or active dropdowns.
- **Borders:** Use thin 1px strokes in a light neutral (`#E2E8F0`) for cards and inputs. Avoid heavy borders; the goal is to let whitespace do the heavy lifting for separation.
- **Interactivity:** Elements "lift" slightly on hover using a subtle shadow increase rather than a color change, maintaining a clean aesthetic.

## Shapes
The shape language follows a "rounded-eight" principle. This 8px (0.5rem) base radius provides a friendly, approachable SaaS feel while remaining sharp enough to look professional and organized. 

Inner elements (like small buttons inside a card) should use a slightly smaller radius (4px) to maintain nested visual harmony. High-utility elements like tags or search bars may occasionally use "Pill-shaped" (rounded-full) treatments to distinguish them from structural containers.

## Components
- **Buttons:** Primary buttons use the Navy `#0F172A` background with white text. Secondary buttons use a subtle Slate-100 background or a thin border. 8px corner radius.
- **Input Fields:** 1px border in light gray. On focus, the border transitions to Primary Navy or Secondary Blue with a 2px soft outer glow.
- **Cards:** White background, 1px `#E2E8F0` border, and no shadow unless hovered. Use 16px or 24px internal padding.
- **Chips/Tags:** Small font size (`label-sm`), low-saturation background tints (e.g., very light blue for "In Progress").
- **Lists:** Clean rows separated by a 1px hairline divider. High-density tables should use alternate row striping in `#F8FAFC` for legibility.
- **Data Visuals:** Use the Secondary Blue as the primary data color, supported by a palette of muted teals and purples for multi-series charts, ensuring they don't clash with the minimalist UI.