---
name: security-review
description: Review code or a system for common security vulnerabilities (defensive use).
version: 1.0
---

# Security review

Review for real, exploitable issues — defensively. Check:

- **Injection:** SQL/NoSQL/command/template injection from unsanitized input. Are queries parameterized? Is user input ever concatenated into a shell command or query?
- **Authentication & authorization:** is every protected route/action actually checked? Can a user access another user's data by changing an id (IDOR)? Are sessions/tokens validated, scoped, and expired?
- **Secrets:** keys/passwords in code, logs, client bundles, or git history. Are secrets in env/a vault, not source?
- **Input validation & output encoding:** validate at trust boundaries; encode output to prevent XSS. Never trust client-side validation alone.
- **Sensitive data:** is PII/credentials encrypted at rest and in transit? Is it over-collected or over-logged?
- **Dependencies:** known-vulnerable packages, unpinned versions, supply-chain risk.
- **Rate limiting & abuse:** can endpoints be hammered, enumerated, or used to exfiltrate?
- **Error handling:** do errors leak stack traces, internal paths, or secrets to users?

For each finding: the vulnerability, where, how it's exploited, severity, and a concrete fix. Verify before reporting. This is for securing systems you're authorized to review — not for attacking others.
