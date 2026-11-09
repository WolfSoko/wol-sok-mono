# Plan: Korbjäger — DBB.Scores terms of use and an official NBN23 partner or API access (no scraping)

Spec: [`docs/specs/2977-spike-korbjaeger-dbb-scores-terms-of-use-and-an-official-nbn23-partner-api-access-no-scraping.md`](../specs/2977-spike-korbjaeger-dbb-scores-terms-of-use-and-an-official-nbn23-partner-api-access-no-scraping.md). A spike: the findings are the deliverable, no code.

1. **Read** (done, 2026-11-09). Public pages only, no account and no app backend: the App Store listing of DBB.Scores, NBN23's app terms, website terms and privacy policy, its DBB.Scores info page, the DBB Area shop, NBN23's partnership news (Exposure Events), and the DBB's WNBL consent form. Raw copies stayed in the scratchpad.
2. **Docs.** Spec with the findings, the additions for #2963's letter and the recommendation, and this plan. Check: `npx nx format:check` on both files. Commit `docs(korbjaeger): spike findings on DBB.Scores terms and NBN23 access`.
3. **PR** to `main` with `Closes #2977`; the description lists each acceptance point with its result.
4. **Issue comment on #2963** with the spec's section 5, so the letter picks up the additions. No new issue: #2963 is the letter.
