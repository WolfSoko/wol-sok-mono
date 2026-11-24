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
- No change to what `page-diagnostics.ts` records or when it prints; only
  where it redacts (decision 6).

## Decisions

1. **A URL's query or hash ends only at whitespace** (the manager's choice
   A on the fresh review's first finding). Each delimiter (`'`, `"`, `<`,
   `>`, backtick) and all punctuation can stand unencoded in a query of a
   text the page diagnostics print: a browser serialises `'"<>` in an http
   query as `%27 %22 %3C %3E` but leaves a backtick as it is, and app code
   (an `HttpErrorResponse` message, `console.error` with a raw URL) prints
   whatever it was given, even JSON (`?data={"a":"b","token":"…"}`), which
   cannot be told apart from a URL inside JSON. So no delimiter may end a
   query.
2. **`redactUrls` works per word** (the `/simplify` altitude review): in each
   whitespace-separated word it finds where a URL starts, cuts everything
   from the first `?` or `#` after it, and strips credentials. Since a query
   runs to the end of the word anyway, no regex has to decide where a path
   ends, so a quote inside a path (`it'.x?…`) can no longer cut it short in
   front of a query. A URL without query or hash keeps the text after it as
   it was; the URL is no longer normalised (`new URL` lower-cased the
   scheme and added a `/` to a bare origin).
3. **The cost:** whatever follows a query up to the next whitespace goes
   with it: a quoted URL with a query loses its closing quote, a URL inside
   JSON (`{"url":"https://a.test/x?t=1","error":"timeout"}`) the rest of the
   JSON word, and a regex literal in a message (`/a?b/`) its part after `?`.
4. **Where a URL starts:** an http(s) or ws(s) scheme (glued to the word
   before it too, `urlhttps://…`), its slashes also written as backslashes
   or JSON-escaped (`https:\/\/…`), or a `/` no letter, digit or `_` comes
   before: relative URLs (Angular's `HttpErrorResponse` names the request's
   own URL on status 0, relative where the app asked for a relative path),
   scheme-relative ones (`//host/…`) and those after `:`, `;`, `&` or `|`
   (`redirect:/login?…`, `http:/host`). A path without query or hash is
   left as it is.
5. **Credentials** (`//user:pass@`, with the same slashes) run to the last
   `@` before the path and end at a quote or bracket, so a password holding
   `@` goes whole and an `@` later in a JSON word is no password.
6. **`page-diagnostics.ts` records raw lines and redacts the report once**
   before it prints and attaches it, so no line can miss the redaction;
   `urlForLog`, which only it used, goes. The test title stays as it is:
   Playwright's own reporter prints titles raw in the same log, so a title
   must hold no secret, which the fixture's comment says.
7. **Known gaps:** a raw space inside a query ends it (`?q=a b&token=…`),
   since the text alone does not tell where the URL ends; other schemes
   (`ftp:`, which Chrome no longer fetches) and relative URLs without a
   leading `/` (`api/x?…`) are not found.
8. Findings of the reviews on the final code are fixed in this PR when they
   are leaks in the redaction; anything else goes to the manager as a
   follow-up.

## Acceptance

1. `?token=public'secret-value` is redacted (spec in
   `log-redaction.spec.ts`): no `secret-value` in the output.
2. A spec per delimiter (`'`, `"`, `<`, `>`, backtick) drops the whole
   query holding it unencoded; an apostrophe-quoted URL with a query keeps
   its opening quote and the text after the next whitespace, without the
   query.
3. The existing JSON and angle-bracket specs still pass for URLs without a
   query; with a query they pin the cost of decision 3 (manager's choice A).
4. A fresh subagent review of `urlForLog`, `redactUrls` and
   `page-diagnostics.ts` is posted on the PR.

## Open questions

None.
