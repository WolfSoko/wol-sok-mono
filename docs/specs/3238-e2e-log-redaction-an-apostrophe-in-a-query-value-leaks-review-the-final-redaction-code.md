# Spec: e2e log redaction, an apostrophe in a query value leaks ([#3238](https://github.com/WolfSoko/wol-sok-mono/issues/3238))

## Goal

`redactUrls` (`libs/shared/e2e-server/src/lib/log-redaction.ts`) reduces
every URL in a text that an e2e test prints into the public Nx Cloud log to
origin and path. Its pattern `URL_IN_TEXT` ends a URL at an apostrophe, so
`https://example.test/api?token=public'secret-value` keeps
`'secret-value` in the output. After the fix, nothing of a query or hash
reaches the log, whatever unencoded character it holds, and the final
redaction code (`urlForLog`, `redactUrls`, their use in
`apps/angular-examples/e2e/fixtures/page-diagnostics.ts`) gets a fresh
review.

## Non-goals

- No new redaction of things that are no URL (bare tokens, e-mail
  addresses): the page diagnostics print only URLs, status codes and
  messages.
- No change to what `page-diagnostics.ts` records or when it prints.

## Decisions

1. **A URL ends at whitespace. A quote (`'`, `"`), an angle bracket or a
   backtick ends it only where the text goes on with whitespace, the end,
   punctuation (`,;:.!?)]}`) or another such delimiter.** Each of them can
   stand unencoded in a query of a text the page diagnostics print: a
   browser serialises `'"<>` in an http query as `%27 %22 %3C %3E` but
   leaves a backtick as it is (so a browser message can hold one), and app
   code (an `HttpErrorResponse` message, `console.error` with a raw URL)
   prints whatever it was given; `encodeURIComponent`, which `HttpParams`
   uses, leaves `'` unencoded. Ending at the first delimiter would leave the
   rest of the query in the log, as the apostrophe did. The text after a URL
   in JSON (`","error":…`), in `<…>`, in `'…'` and in backticks still stays,
   since there the delimiter is followed by punctuation, another delimiter
   or the end. The `\b` before the scheme goes too, so a URL glued to the
   word before it (`urlhttps://…`) is found.
2. **What stays possible:** a delimiter inside a query that is directly
   followed by whitespace or punctuation (`?t=a', secret`) still reads as
   the URL's end. That needs a value with a quote before a space or comma,
   and telling it apart from a quoted URL is impossible from the text
   alone. A quoted URL with a query (`'http://a.test/x?t=1'`) keeps both
   quotes and the text after it.
3. **The whole rest of the matched URL after `?` or `#` is dropped**, as
   `urlForLog` already does, so the rest of a query token up to the next
   delimiter goes with it.
4. Findings of the fresh review on the final code are fixed in this PR when
   they are leaks in the redaction; anything else goes to the manager as a
   follow-up.

## Acceptance

1. `?token=public'secret-value` is redacted (spec in
   `log-redaction.spec.ts`): no `secret-value` in the output.
2. A spec per delimiter (`'`, `"`, `<`, `>`, backtick) drops the whole
   query holding it unencoded; an apostrophe-quoted URL with a query keeps
   its quotes and the text after it, without the query.
3. The existing JSON and angle-bracket specs still pass.
4. A fresh subagent review of `urlForLog`, `redactUrls` and
   `page-diagnostics.ts` is posted on the PR.

## Open questions

None.
