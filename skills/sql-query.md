---
name: sql-query
description: Write correct, readable, and efficient SQL.
version: 1.0
---

# SQL

1. **Understand the schema first** — tables, keys, relationships, and what one row means. Don't guess column names.
2. **Be explicit:** name columns instead of `SELECT *`; qualify columns in joins; use explicit `JOIN ... ON` (never comma joins).
3. **Get the grain right.** Know whether a join fans out rows; use `GROUP BY` deliberately and aggregate the right thing. Beware double-counting after joins.
4. **Filter correctly:** `WHERE` before aggregation, `HAVING` after; mind `NULL` semantics (`NULL <> 'x'` is not true); use `IS NULL`.
5. **Readable formatting** — one clause per line, consistent indentation, CTEs (`WITH`) to break complex logic into named steps instead of nested subqueries.
6. **Performance:** filter early, index the columns you filter/join on, avoid functions on indexed columns in `WHERE`, prefer `EXISTS` over `IN (subquery)` for large sets. Check the query plan for anything slow.
7. **Safety:** parameterize values (never string-concatenate user input); be extremely careful with `UPDATE`/`DELETE` — write the `SELECT` first, confirm the rows, then mutate, inside a transaction.

State your assumptions about the schema if it wasn't provided, and show a small sample of expected output.
