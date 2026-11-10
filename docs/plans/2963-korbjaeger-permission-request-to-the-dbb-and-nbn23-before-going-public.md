# Plan: Korbjäger permission request to the DBB and NBN23 (#2963)

Spec: [docs/specs/2963-korbjaeger-permission-request-to-the-dbb-and-nbn23-before-going-public.md](../specs/2963-korbjaeger-permission-request-to-the-dbb-and-nbn23-before-going-public.md). Docs only: no tests to write first; the check is the spec's acceptance list and `nx format:check`. `nx format:write` before each commit.

1. **Spec and plan** (`docs/specs/2963-…md`, `docs/plans/2963-…md`). Commit `docs(korbjaeger): spec and plan for the permission request to the DBB and NBN23`.
2. **Letter to the DBB** (`docs/specs/2963-letter-dbb.de.md`): what Korbjäger is and who it is for, its state today (unlisted, already reading), the eight reads with their purpose and cache times, the club index crawl and its load, what is kept and what never is (ADR 0019), the consent question, live data and NBN23, the DBB.Scores link, nothing from DBB.Scores without written consent, offer to stop or adjust, sender placeholders. Check every figure against the code. Commit `docs(korbjaeger): letter to the DBB …`.
3. **Letter to NBN23** (`docs/specs/2963-letter-nbn23.de.md`, DBB in copy): the deep link first (format, permission), then a licence or API limited to a followed Team's Spiel behind a 15 to 30 s shared cache, terms and price, the link alone sufficing, nothing read until both agree. Commit `docs(korbjaeger): letter to NBN23 …`.
4. **PR** to `main` with `Closes #2963`; review by a fresh subagent against the spec; fixes; acceptance list in the PR body; review posted as a PR comment.
5. **Merge** through a `merge` request; then watch the newest `main` run.
