---
name: accessibility-audit
description: Audit a UI for accessibility (WCAG) issues and give concrete fixes.
version: 1.0
---

# Accessibility audit

Check against the things that actually block users:

- **Semantics:** real landmarks (`header`/`nav`/`main`/`footer`), headings in logical order, lists as lists, native controls over `div`-buttons.
- **Keyboard:** everything operable without a mouse; visible focus indicator; logical tab order; no keyboard traps; skip-to-content link.
- **Forms:** every input has an associated `<label>`; errors are announced and tied to the field; required/invalid states are programmatic, not just color.
- **Contrast:** text ≥ 4.5:1 (≥ 3:1 large); UI/icon contrast ≥ 3:1; never use color as the only signal.
- **Images & media:** meaningful `alt` text; decorative images empty-alt; captions/transcripts for media.
- **ARIA:** used only to fill gaps native HTML can't; correct roles/states; no redundant or broken ARIA.
- **Motion:** respects `prefers-reduced-motion`; nothing flashes more than 3x/sec; auto-playing motion is pausable.
- **Zoom & reflow:** usable at 200% zoom and 320px width without loss of content.

Report each issue with the element, the WCAG concern, who it affects, and the fix. Prioritize blockers (can't complete a task) over nits.
