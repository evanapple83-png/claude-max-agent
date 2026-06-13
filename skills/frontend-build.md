---
name: frontend-build
description: Implementation best-practices for building UI — semantic, accessible, responsive, and fast.
version: 1.0
---

# Frontend build

How to *implement* a design well, after the look is decided (see `/design-orchestrator`).

- **Semantic HTML first.** Real `button`, `a`, `nav`, `main`, `label`, headings in order. Don't rebuild native elements out of `div`s — you lose accessibility and keyboard support for free.
- **Mobile-first and responsive.** Design the small screen, then enhance up. Use fluid type/space (`clamp`), logical breakpoints driven by content, and test at real widths.
- **Accessibility baked in:** labels tied to inputs, focus-visible styles, ARIA only where semantics fall short, color never the sole signal, contrast ≥ 4.5:1.
- **Performance budget:** lazy-load below-the-fold media, size and format images well (modern formats, explicit dimensions to avoid layout shift), defer non-critical JS, keep the critical path small. Target LCP < 2.5s, INP < 200ms, CLS < 0.1.
- **State completeness:** every data view has loading, empty, and error states — not just the happy path.
- **Consistency via tokens.** Define spacing, type, color, radius as a small token set and reuse them; don't hand-pick one-off values.
- **No dead UI.** Ship working interactions and real content structure, not placeholder boxes. Wire the states even if data is mocked.
- **Verify in a browser** at mobile and desktop widths, with keyboard only, before declaring it done.
