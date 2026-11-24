# Plan: e2e log redaction, an apostrophe in a query value leaks ([#3238](https://github.com/WolfSoko/wol-sok-mono/issues/3238))

Spec: [`docs/specs/3238-…`](../specs/3238-e2e-log-redaction-an-apostrophe-in-a-query-value-leaks-review-the-final-redaction-code.md).
Branch `3238-e2e-log-redaction-apostrophe` off `main`, one PR.

1. **Apostrophe case** (test first).
   - `libs/shared/e2e-server/src/lib/log-redaction.spec.ts`: a spec per
     delimiter (`'"<>` and backtick) inside a query, a quote in a hash, an
     apostrophe- and a backtick-quoted URL, an apostrophe in a path, a URL
     glued to a word, linear time on a long run of quotes.
   - `libs/shared/e2e-server/src/lib/log-redaction.ts`: `URL_IN_TEXT` ends
     at whitespace, and at a delimiter only before whitespace, punctuation,
     another delimiter or the end; no `\b`.
   - Commit: `fix(shared-e2e-server): redact a query holding an apostrophe (#3238)`.
2. **Fresh review** of the final redaction code by a subagent
   (code-review skill), findings that are leaks fixed with a spec each,
   review posted as a PR comment.
3. **Checks and PR.** `npx nx format:write`, then
   `npx nx affected --base=origin/main -t lint,lint-templates,test,typecheck-specs`.
   Open the PR with `Closes #3238` and the acceptance list.
