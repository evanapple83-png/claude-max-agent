---
name: translate
description: Translate text accurately while preserving tone, meaning, and formatting.
version: 1.0
---

# Translate

1. **Convey meaning, not words.** Translate idioms and intent naturally into the target language; don't produce literal word-for-word output that reads foreign.
2. **Preserve register and tone** — formal stays formal, casual stays casual, marketing stays persuasive. Match how a native speaker in that context would say it.
3. **Keep formatting and structure** — markdown, line breaks, placeholders/variables (`{name}`, `%s`), code, and untranslatable proper nouns stay intact.
4. **Localize where appropriate** — dates, numbers, currency, units, and conventions for the target locale, unless asked to keep the source format.
5. **Flag ambiguity** — if a term is genuinely ambiguous or untranslatable, pick the best fit and note the choice rather than guessing silently.
6. **Don't add or omit.** No editorializing, no extra explanations inside the translation.

State the source and target language/locale if unclear. For UI strings, keep them concise — translations often run longer than the original, which can break layouts.
