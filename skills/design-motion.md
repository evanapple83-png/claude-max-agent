---
name: design-motion
description: Principles for tasteful UI motion and micro-interactions that feel crafted, not decorative.
version: 1.0
---

# Motion & micro-interactions

Good motion is felt, not noticed. It clarifies state and reinforces hierarchy; it never shows off.

- **Purpose first.** Every animation answers "what changed and why?" — entrance/exit, state change, spatial relationship, feedback on an action. If it has no answer, cut it.
- **Fast and out of the way.** UI transitions: ~120-250ms. Larger choreographed reveals can be longer but should still feel decisive. Slow motion on functional UI feels broken.
- **Natural easing.** Use ease-out for entrances (fast then settle), ease-in for exits. Avoid linear for anything that should feel physical; avoid heavy bounce on functional elements.
- **Animate only `transform` and `opacity`.** They're GPU-friendly and don't trigger layout. Avoid animating width/height/top/left, box-shadow, or color en masse.
- **Respect the user:** honor `prefers-reduced-motion` (reduce to a simple fade or none); never trap, never auto-play large motion the user can't stop.
- **Micro-interactions:** hover, focus, press, loading, success/error — small, consistent, and instant feedback. These matter more than hero animations.
- **Stagger with restraint.** Sequenced reveals (small delays between items) add polish; long cascades make the user wait. Keep total reveal time short.
- **Performance budget:** decorative motion must not cost interactivity. If it risks INP > 200ms or CLS, simplify it.
