# Plan: Korbjäger — does the DBB offer a live data source, and would it agree to its use?

Spec: [`docs/specs/2947-spike-korbjaeger-does-the-dbb-offer-a-live-data-source-and-would-it-agree-to-its-use.md`](../specs/2947-spike-korbjaeger-does-the-dbb-offer-a-live-data-source-and-would-it-agree-to-its-use.md). A spike: the findings are the deliverable, no code.

1. **Probe** (done, 2026-11-09). The DBB's SPA bundle for match routes and polling; `match/id/{id}/playbyplay` for 15 played games across DBBL, BBL, NBBL and youth Ligen, one request a second, with the app's User-Agent; the raw answers stayed in the scratchpad. Public sources on the digital scoresheet, DBB.Scores and the DBB's legal notice.
2. **Docs.** Spec with the findings and the recommendation, and this plan. Check: `npx nx format:check` on both files. Commit `docs(korbjaeger): spike findings on a live DBB data source`.
3. **PR** to `main` with `Closes #2947`; the description lists each acceptance point with its result.
4. **Follow-ups**, raised to the manager rather than built: put the live-data question (DBB and NBN23, or a DBB.Scores deep link per Spiel) into the owner's permission request to the DBB.
