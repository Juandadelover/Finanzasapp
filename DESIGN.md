---
name: Finanzas
description: Mobile-first, dark-by-default money app for small-business owners, with a violet brand gradient on calm tonal surfaces.
colors:
  brand: "#8a05be"
  brand-dark: "#560a82"
  brand-light-dark-theme: "#b34af0"
  brand-light-light-theme: "#7c1fb0"
  income-light: "#059669"
  income-dark: "#34d399"
  expense-light: "#dc2626"
  expense-dark: "#f26d6d"
  warning-light: "#d97706"
  warning-dark: "#f59e0b"
  bg-light: "#f6f5f8"
  surface-light: "#ffffff"
  surface-2-light: "#f1eff5"
  surface-3-light: "#e6e3ee"
  border-light: "#e2dfea"
  text-light: "#17151c"
  text-muted-light: "#5c5868"
  text-faint-light: "#8b8697"
  bg-dark: "#0a0e13"
  surface-dark: "#121820"
  surface-2-dark: "#1a212b"
  surface-3-dark: "#232b37"
  border-dark: "#232b37"
  text-dark: "#f4f6f8"
  text-muted-dark: "#97a2b0"
  text-faint-dark: "#5f6b7a"
typography:
  display:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  title:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "24px"
  full: "9999px"
spacing:
  page-gutter: "16px"
  card-padding: "20px"
  tile-padding: "14px"
  stack-gap: "12px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
    typography: "{typography.title}"
  button-fab:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    size: "56px"
  input-field:
    backgroundColor: "{colors.surface-2-dark}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
  card-stat:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.xl}"
    padding: "14px"
  card-hero:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.2xl}"
    padding: "20px"
  nav-bottom:
    backgroundColor: "{colors.surface-2-dark}"
    textColor: "{colors.text-faint-dark}"
    rounded: "{rounded.full}"
    height: "48px"
---

# Design System: Finanzas

## Overview

**Creative North Star: "The Pocket Ledger"**

A ledger you can read with one thumb at the counter. The surface is quiet, tonal and dark by default; one violet brand gradient marks the two things that matter most, the balance and the act of adding a movement. Everything else is stepped neutral surfaces, soft rounded forms and green/red money semantics.

Density is mobile-first and comfortable: a 16px page gutter, stacked rounded cards, 44px+ touch targets, and amounts as the largest, boldest type on any screen. Tone is close and direct (Colombian Spanish, tuteo), so the interface avoids ornament and accounting jargon.

**Key Characteristics:**
- Dark theme is the default; light theme is a full mirror via CSS variables and a `.dark` class.
- Tonal layering (bg, surface, surface-2, surface-3) carries depth; borders are 1px hairlines.
- One accent: the violet gradient (brand to brand-dark, 135deg). Green and red mean money in and out only.
- Generous rounding (12 to 24px) and pill shapes for navigation and chips.
- Lucide line icons in tinted rounded-square wells.

## Colors

A violet brand over cool blue-black (dark) or lilac-tinted white (light) neutrals, with emerald and red reserved for income and expense.

### Primary
- **Ledger Violet** (`#8a05be`): the gradient start; hero balance card, primary submit buttons, FAB, logo tile, selected-state borders and 15% tints.
- **Deep Violet** (`#560a82`): gradient end only.
- **Lifted Violet** (`#b34af0` dark, `#7c1fb0` light): brand-colored text and icons on neutral surfaces (active nav item, text links, "Pendiente" chip).

### Secondary
- **Income Green** (`#34d399` dark, `#059669` light): positive amounts, income icon wells, favorable deltas.
- **Expense Red** (`#f26d6d` dark, `#dc2626` light): negative amounts, errors, destructive actions.
- **Warning Amber** (`#f59e0b` dark, `#d97706` light): overdue and caution states.

### Neutral
- **Night Ink** (`#0a0e13`) / **Lilac Mist** (`#f6f5f8`): page background.
- **Surface** (`#121820` / `#ffffff`): cards and sheets.
- **Surface 2** (`#1a212b` / `#f1eff5`): inputs, nav pill, hover fills, empty-state wells.
- **Surface 3** (`#232b37` / `#e6e3ee`): active nav pill, scrollbar thumb. Dark border equals surface 3; light border is `#e2dfea`.
- **Text** (`#f4f6f8` / `#17151c`), **Muted** (`#97a2b0` / `#5c5868`), **Faint** (`#5f6b7a` / `#8b8697`): primary, secondary, tertiary text.

### Named Rules
**The Money Semantics Rule.** Green and red appear only for money direction and error state, never as decoration. Pending amounts stay distinguishable from paid (60% opacity plus the violet "Pendiente" chip).

**The Gradient Is Earned Rule.** The brand gradient fills only the hero balance card, primary submit buttons, the FAB and the logo tile. Everything else uses neutral surfaces with violet as border or tint.

## Typography

**Display / Body / Label Font:** Geist (via next/font, with Arial, Helvetica, sans-serif)
**Mono Font:** Geist Mono is loaded but not used in the audited components.

**Character:** One neutral geometric sans in a narrow weight range (400 to 700). Hierarchy comes from size and weight, and amounts dominate.

### Hierarchy
- **Display** (700, 36px / `text-4xl`, tight tracking): the balance figure only.
- **Headline** (700, 20 to 24px): page titles (`text-xl font-bold` is the most common).
- **Title** (600, 14px): section headings, card titles, button labels.
- **Body** (400 to 500, 14px): rows, descriptions, inputs. `text-sm` is the workhorse (about 240 uses).
- **Label** (500, 12px, and 11px for dense captions): metadata, field labels, deltas. `text-xs` is the second most used size.

### Named Rules
**The Amount First Rule.** The largest, boldest text on a screen is a money figure, colored by direction where it is a movement.

## Layout

Single-column mobile layout inside an app shell with a persistent floating bottom nav and FAB. Pages follow: `AppHeader`, optional month selector, then full-width blocks with a `mx-4` (16px) gutter and `mt-3`/`mt-4`/`mt-6` vertical steps. Lists use `gap-1` rows inside a gutter; tile grids use `grid-cols-2 gap-3`; category grids use 4 columns with `gap-3`. Sheets center and cap at `max-w-md` from the `sm` breakpoint. Loading states are pulsing surface blocks sized like the content (rounded-3xl). Respect `env(safe-area-inset-bottom)` for fixed bars.

## Elevation & Depth

Hybrid: tonal layering at rest, soft shadows only on floating or brand elements. Cards on the page are flat with a 1px border. The brand gradient surfaces carry a violet-tinted glow; floating nav and menu items carry a neutral drop shadow.

### Shadow Vocabulary
- **Brand glow, large** (`0 16px 40px rgba(138,5,190,0.35)`): hero balance card.
- **Brand glow, button** (`0 8px 24px rgba(138,5,190,0.35)`): primary submit buttons (the dominant shadow, about 17 uses).
- **FAB glow** (`0 10px 30px rgba(138,5,190,0.45)`) and **logo glow** (`0 4px 16px rgba(138,5,190,0.35)`).
- **Floating nav** (`0 8px 30px rgba(0,0,0,0.45)`) plus `backdrop-blur`.
- **Menu items / sheets**: Tailwind `shadow-lg` and `shadow-2xl`.

### Named Rules
**The Flat Cards Rule.** Content cards never get a shadow; only brand-gradient and floating elements do.

## Shapes

Soft and rounded. Scale in use: `rounded-xl` 12px (inputs, buttons, small wells; most common), `rounded-2xl` 16px (tiles, list rows, icon wells), `rounded-3xl` 24px (hero card, chart cards, sheet top), `rounded-full` (nav, chips, FAB, avatars, progress bars). Borders are 1px `--color-border`; selected states use a brand border plus a 15% brand tint; empty states use a dashed border. Icon wells are tinted squares: category color at about 13% alpha (`${color}22`) or accent via `color-mix` at 15%.

## Components

### Buttons
- **Shape:** 12px radius for rectangular actions; full pill for FAB menu items and chips.
- **Primary:** brand gradient fill, white 14px semibold text, `py-3`, brand glow shadow, `active:scale-[0.99]`, `disabled:opacity-60`.
- **FAB:** 56px circle gradient with `Plus`, rotates 45deg when open; menu items are pill buttons on surface-2 with a green/red tinted icon well.
- **Secondary:** 1px border on transparent, hover fill surface-2. Destructive: red text or icon with the same shape.
- **Icon button:** `rounded-full p-1.5/p-2`, muted text, hover fill surface-2.

### Chips / Selectors
- Pill (`rounded-full border px-3.5 py-1.5 text-sm`) or 12px tile; selected = brand border, 15% brand fill, lifted-violet text; unselected = border plus surface-2 and muted text.

### Cards / Containers
- **Stat tile / list card:** 16px radius, 1px border, surface fill, 14px padding.
- **Chart card:** 24px radius, border, surface, 16px padding; header with an 8x8 (32px) tinted icon well, a 14px semibold title and a 12px faint subtitle.
- **Hero (BalanceCard):** gradient, 24px radius, 20px padding, white text with `white/10` and `black/10` inner tiles.

### Inputs / Fields
- 12px radius, 1px border, surface-2 fill, `px-3.5 py-2.5`, 14px text, faint placeholder. Focus: border shifts to brand (outline removed). Labels: 12px medium faint text above, `mb-1.5`. Error: 14px expense-red message under the field.

### Navigation
- **BottomNav:** floating pill (`rounded-full`, 1px border, surface-2 at 95% with blur), five icon-only 56x48 targets with `aria-label`; active = surface-3 fill plus lifted-violet icon at heavier stroke; inactive = faint.
- **AppHeader:** logo tile (40px gradient, 16px radius) plus workspace switcher on the left, privacy eye toggle and page actions on the right.

### Bottom Sheet
- Portal modal: black/70 blurred scrim, surface panel with 24px top radius (full 24px from `sm`), sticky header with 16px semibold title and a close icon button, `px-5 py-4` body, max height 92vh.

### Transaction Row
- 44px tinted category icon well (16px radius), 14px medium description, 12px faint meta, right-aligned 14px semibold signed amount in income/expense color; row hover fill surface-2.

### Empty State
- Dashed 16px-radius box, 48px circular surface-2 icon well, 14px muted title, 12px faint description.

## Do's and Don'ts

### Do:
- **Do** read colors from the CSS variables (`var(--color-*)`) so both themes work.
- **Do** keep touch targets at 44px or larger and give icon-only controls an `aria-label`.
- **Do** mask amounts with `MASKED_AMOUNT` when privacy mode is on.
- **Do** use `text-sm` for body and `text-xs` for metadata; reserve bold large type for amounts and page titles.
- **Do** reuse existing radii (12, 16, 24, full) rather than adding new steps.

### Don't:
- **Don't** use the brand gradient on content cards, tiles or decorative fills.
- **Don't** use green or red for anything other than income/expense semantics and errors.
- **Don't** add shadows to ordinary content cards.
- **Don't** hard-code hex colors for UI chrome; category colors are user data and the only exception.

## Known drift

Observed in the build; not canonized as rules. For the polish pass.
- Page titles vary: `text-xl font-bold`, `text-lg font-semibold`, `text-2xl font-bold tracking-tight`, `text-3xl`; some with `mt-6`. Pick one headline.
- `app/(app)/admin/page.tsx` has no `AppHeader`.
- Radius strays: `rounded-lg` (equipo, cobros, ThemeToggle), `rounded-md` (filter checkbox), `rounded-[10px]` (suscripcion) beside the 12/16/24 scale.
- Hard-coded colors: gray hexes in `cobros/[id]/page.tsx` (print document, partly intentional), `text-red-400` in equipo, `#25D366` in contactos, `#64748b` category fallback; rgba(138,5,190,...) glows repeated inline with 0.2 to 0.45 alpha variants.
- Primary button varies: `rounded-xl py-3`, `rounded-full py-3.5`, with or without shadow, `active:scale`, and disabled opacity 50 vs 60. Shared `inputClass`/`labelClass` are copy-pasted per page.
- Faint text (`#8b8697` on white, `#5f6b7a` on night) is below AA 4.5:1 for 11 to 12px text; the 10px and 11px sizes are very small.
- Form labels use 12px uppercase tracking-wide; not adopted as a system rule.
- Bottom nav is icon-only; the `text-xs` class is unused and there are no visible labels.
- `maximumScale: 1` in the viewport blocks pinch zoom.
