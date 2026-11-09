# Plan #2961: English for everything code-related: rule in CLAUDE.md, Korbjäger Firestore fields and identifiers

Spec: [docs/specs/2961-english-for-everything-code-related-rule-in-claude-md-korbjaeger-firestore-fields-and-identifiers.md](../specs/2961-english-for-everything-code-related-rule-in-claude-md-korbjaeger-firestore-fields-and-identifiers.md)

1. **Glossary** — `CONTEXT.md`: intro on `_Avoid_` versus `_Code_`; a
   `_Code_:` line for each of the 7 Pacetrainer and 13 Korbjäger terms.
   Test: a `grep -c` of `_Code_:` per section equals its term count.
   Commit: `docs(korbjaeger): add the English code name of each glossary term`.
2. **Rule** — `CLAUDE.md` Coding Rule 10; `docs/agents/domain.md` section
   "Glossary terms in code". Test: acceptance 1 and 2 read against the text.
   Commit: `docs(korbjaeger): write the English-in-code rule into CLAUDE.md`.
3. **Spec and plan** — these two files, in the first commit.
4. **Checks** — `npx nx format:write`, `npx nx format:check`,
   `npx nx affected -t lint,lint-templates` (docs only, expected no tasks).
5. **Split** — after approval, check that no open issue covers them yet,
   create the issues for part 2 and part 3 with the scope from #2961, attach
   them as sub-issues of #2961 (part 2 blocking part 3) and link them from
   the PR.
6. **PR** — one PR to `main`, `Refs #2961` (it stays open as the umbrella), with the acceptance list and
   results.
