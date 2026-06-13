---
name: extract-data
description: Pull structured data out of unstructured text into clean JSON.
version: 1.0
---

# Extract data

1. **Confirm the schema** — the exact fields, types, and which are required. If not given, propose a sensible schema and use it.
2. **Extract only what's present.** Use `null` for missing values; never fabricate or "best-guess" a value that isn't in the source.
3. **Normalize** consistently: ISO dates (`YYYY-MM-DD`), trimmed strings, numbers as numbers (not strings), consistent units.
4. **Preserve fidelity** — don't paraphrase or "improve" extracted values; copy them faithfully.
5. **Flag ambiguity** — if a field could be read two ways, pick the most likely and note the assumption.

Output valid JSON only (or an array of objects for multiple records). Validate it parses before returning. If the input has rows/records, keep them as separate objects.
