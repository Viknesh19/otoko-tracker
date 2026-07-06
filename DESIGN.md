# Design System: Otoko Tracker

## 1. Visual Theme & Atmosphere

A premium dark media-library interface with restrained cinematic depth, compact app density, and subtle spatial motion. The mood is quiet and technical, like a private screening room crossed with a precise tracking console.

## 2. Color Palette & Roles

- **Ink Canvas** (#070A0F): Primary dark background.
- **Graphite Surface** (#101720): Main panels and cards.
- **Raised Slate** (#17212D): Inputs, filters, and secondary controls.
- **Mist Text** (#EEF4FA): Primary readable text.
- **Steel Text** (#9BACBD): Secondary descriptions and metadata.
- **Line Work** (rgba(156, 178, 204, 0.18)): Borders and separators.
- **Signal Cyan** (#5DD4C6): Single accent for CTAs, progress, focus, and active states.
- **Amber Note** (#F2B56B): Sparse status highlights for release metadata only.

## 3. Typography Rules

- **Display:** Manrope, system sans. Controlled clamp scale, firm weight, no oversized hero type inside app panels.
- **Body:** Manrope, system sans. 1rem minimum, 1.6 line-height, 65ch maximum for long descriptions.
- **Mono:** JetBrains Mono or ui-monospace for counters, compact metadata, and small system labels.
- **Banned:** Emoji icons, repeated uppercase section kickers, gradient text, and generic Inter-only styling.

## 4. Component Stylings

- **Buttons:** 12px radius, tactile press feedback, one primary accent fill, quiet secondary surfaces.
- **Cards:** Used for individual media entries and settings groups only. No nested card stacks.
- **Inputs:** Visible labels where forms collect identity data, high-contrast placeholders, accent focus rings.
- **Badges:** Compact metadata chips with text labels, no emoji.
- **Empty States:** Action-oriented with one primary next step.

## 5. Layout Principles

Use a max-width app shell, responsive grid tracks, sticky desktop header, single-column mobile collapse, and stable dimensions for cover art, nav buttons, and controls. Avoid layout shifts when hover states, progress labels, or status text changes.

## 6. Motion & Interaction

Motion uses CSS transforms and opacity only. Page entrance and card reveals are short and staggered. Hover tilt is limited to pointer devices. All animations respect `prefers-reduced-motion` and keep content visible by default.

## 7. Anti-Patterns

No emojis, no pure black, no purple-blue neon theme, no three-column template rows for every section, no gradient text, no `transition: all`, no decorative scroll cues, no hidden content dependent on animation, and no additional dependencies without a clear product reason.
