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
- No change to what `page-diagnostics.ts` records or when it prints; it
  only redacts one more text it prints (decision 4).

## Decisions

1. **A URL's query or hash ends only at whitespace** (the manager's choice
   A on the review's first finding). Each delimiter (`'`, `"`, `<`, `>`,
   backtick) and all punctuation can stand unencoded in a query of a text
   the page diagnostics print: a browser serialises `'"<>` in an http query
   as `%27 %22 %3C %3E` but leaves a backtick as it is, and app code (an
   `HttpErrorResponse` message, `console.error` with a raw URL) prints
   whatever it was given, even JSON (`?data={"a":"b","token":"…"}`), which
   cannot be told apart from a URL inside JSON. So no delimiter may end a
   query.
2. **The cost:** whatever follows a query up to the next whitespace goes
   with it: a quoted URL with a query loses its closing quote, and a URL
   inside JSON (`{"url":"https://a.test/x?t=1","error":"timeout"}`) loses
   the rest of the JSON word. A URL without query or hash keeps the text
   after it, since its path still ends at a delimiter followed by
   whitespace, punctuation, another delimiter or the end; a delimiter
   followed by anything else (`it's`) stays in the path, so it cannot cut a
   path short and leave a query behind it.
3. **More URL forms are found** (the review's other findings): a URL glued
   to the word before it (`urlhttps://…`, no `\b`), slashes written as
   backslashes or JSON-escaped (`https:\/\/…`), and relative URLs, a `/` at
   the start of a word or after a delimiter, bracket, `=` or `,` (Angular's
   `HttpErrorResponse` names the request's own URL on status 0, relative
   where the app asked for a relative path; scheme-relative `//host/…`
   included). A plain path without query, which `new URL` refuses, is left
   as it is.
4. **`page-diagnostics.ts` redacts the test title it prints** too, so a
   parameterised title holding a URL cannot leak.
5. **Known gaps:** a raw space inside a query ends it (`?q=a b&token=…`),
   since the text alone does not tell where the URL ends; other schemes
   (`ftp:`, which Chrome no longer fetches) and relative URLs without a
   leading `/` are not found.
6. **The whole rest of the matched URL after `?` or `#` is dropped**, as
   `urlForLog` already does.
7. Findings of the fresh review on the final code are fixed in this PR when
   they are leaks in the redaction; anything else goes to the manager as a
   follow-up.

## Acceptance

1. `?token=public'secret-value` is redacted (spec in
   `log-redaction.spec.ts`): no `secret-value` in the output.
2. A spec per delimiter (`'`, `"`, `<`, `>`, backtick) drops the whole
   query holding it unencoded; an apostrophe-quoted URL with a query keeps
   its opening quote and the text after the next whitespace, without the
   query.
3. The existing JSON and angle-bracket specs still pass for URLs without a
   query; with a query they pin the cost of decision 2 (manager's choice A).
4. A fresh subagent review of `urlForLog`, `redactUrls` and
   `page-diagnostics.ts` is posted on the PR.

## Open questions

None.
