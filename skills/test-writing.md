---
name: test-writing
description: Write focused, meaningful tests that catch real regressions.
version: 1.0
---

# Test writing

1. **Test behavior, not implementation.** Assert on what the code is supposed to *do*, so refactors don't break the tests but bugs do.
2. **Cover the cases that matter:** the happy path, the boundaries (empty, zero, one, max), the error paths, and any bug you just fixed (write the regression test).
3. **One reason to fail per test.** A test should pinpoint what broke. Prefer several small tests over one that asserts ten things.
4. **Arrange-Act-Assert,** with clear names that read as a spec (`returns 401 when token is missing`).
5. **Make them deterministic** — no real network/time/randomness; stub or inject them. A flaky test is worse than no test.
6. **Don't test the framework or trivial getters.** Spend effort where logic lives.

Run the tests and make sure they pass (and that they actually fail when the behavior is broken — a test that can't fail is decoration).
