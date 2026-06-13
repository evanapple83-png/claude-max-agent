---
name: design-orchestrator
description: Master router for any UI build (website, web app, dashboard, landing page). Pick one aesthetic direction, enforce an anti-slop + accessibility floor, govern motion. Invoke FIRST on any frontend work.
version: 1.0
---

# Design orchestrator

Run this before writing any UI. It resolves the usual contradictions (when to use shadows, corners, motion, density) by making one decision up front and enforcing a non-negotiable quality floor.

## 1. Read the brief, then pick exactly ONE aesthetic direction

Don't blend directions — that's how interfaces end up generic. Choose the one that fits the product, and commit to its rules for corners, shadows, density, and motion. The companion director skills go deeper:

- **`/design-minimal`** — calm, editorial, content-first. SaaS, docs, writing tools, portfolios.
- **`/design-premium`** — high-end, spacious, crafted. Marketing sites, luxury, brand-led.
- **`/design-brutalist`** — raw, dense, technical. Data dashboards, dev tools, editorial-tech.

Pick based on the *content and audience*, not personal taste. A trading dashboard is not editorial; a meditation app is not brutalist.

## 2. Universal anti-slop + accessibility floor (always on, every direction)

These hold regardless of the chosen direction:

- **No AI-slop tells:** no purple-on-dark gradients as a default, no glassmorphism by reflex, no three-equal-feature-cards, no fake metrics or testimonials, no gradient text, no `01 / 02 / 03` numbered scaffolding, no emojis as UI iconography.
- **Banned default fonts:** not Inter, Roboto, Arial, or raw system-ui as the brand face. Pick a typeface with character that fits the direction; pair a display face with a readable text face.
- **Accessibility is not optional:** text contrast ≥ 4.5:1 (≥ 3:1 for large text), visible focus states, real semantic HTML, keyboard operability, hit targets ≥ 44px, respect `prefers-reduced-motion`.
- **Hierarchy over decoration:** one clear focal point per screen; size, weight, and spacing do the work before color does.
- **Copy:** plain language, no dev-jargon in user-facing text, no em-dashes by default.
- **Ship complete code** — no `TODO`/placeholder stubs in delivered UI.

## 3. Govern motion and 3D (decide IF, then HOW MUCH)

- **Forms, CRUD, dashboards, settings get functional micro-interactions only** — never decorative or heavy motion, never 3D/WebGL.
- Decorative motion and any 3D must hit Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1) and ship a reduced-motion + no-JS fallback, or it doesn't ship.
- Animate `transform` and `opacity` only; avoid animating layout-triggering properties.
- Pick the lightest tool that achieves the effect: CSS → a small JS lib → a 3D engine, in that order. Don't reach for a 3D engine for a fade.

## 4. Precedence when rules collide

accessibility + performance + completeness  >  the anti-slop floor  >  motion choices  >  the chosen direction  >  personal preference.

## Pipeline

read brief → pick ONE direction → (optional: section-by-section visual concept) → implement with the floor enforced → add governed motion last → final polish + accessibility/performance audit before shipping.
