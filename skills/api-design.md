---
name: api-design
description: Design a clean, consistent, evolvable HTTP/JSON API.
version: 1.0
---

# API design

- **Resources and nouns.** Model endpoints around resources (`/orders/{id}`), use HTTP verbs for actions (GET/POST/PATCH/DELETE), and keep them predictable and consistent.
- **Consistent shapes.** One casing convention, consistent field names, ISO-8601 timestamps, explicit types. A field called `id` is `id` everywhere.
- **Meaningful status codes:** 200/201 success, 400 bad input, 401/403 auth, 404 missing, 409 conflict, 422 validation, 429 rate limit, 5xx server. Don't return 200 with an error body.
- **Errors are structured:** `{ error: { code, message, details } }` — machine-readable code plus a human message. Never leak stack traces or internals.
- **Pagination, filtering, sorting** for collections — cursor-based for large/changing sets. Don't return unbounded lists.
- **Versioning & evolution:** additive changes only without a version bump; never repurpose a field. Plan for `/v1`.
- **Idempotency** for unsafe retries (idempotency keys on POST that creates).
- **Security:** authenticate every endpoint, authorize per resource, validate all input, rate-limit, and never trust the client.
- **Document it** as you go — each endpoint: method, path, params, request/response shape, errors, auth.
