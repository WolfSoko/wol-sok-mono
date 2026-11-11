# Plan #3025: Korbjäger ADR 0019: reword the privacy stance to what the Spiel page shows

Spec: [docs/specs/3025-korbjaeger-adr-0019-reword-the-privacy-stance-to-what-the-spiel-page-shows.md](../specs/3025-korbjaeger-adr-0019-reword-the-privacy-stance-to-what-the-spiel-page-shows.md).

1. **Spec and plan.** Files: this plan and the spec. No tests. Commit
   `docs(korbjaeger): spec and plan for #3025`.
2. **Reword ADR 0019.** File: `docs/adr/0019-korbjaeger-privacy-stance.md`:
   new title, a "Changed" line in the header naming #3025, the first bullet
   of "No way to find a child …" rewritten (both Kader of a Spiel; marking
   and highlight only on a followed side). Check: `npx nx format:check`
   on the file, `grep` that no "Team someone follows" claim remains.
   Commit `docs(korbjaeger): ADR 0019 describes the Kader the Spiel page shows (#3025)`.
3. **Consistency check.** Read the privacy policy (sections 3 and 9),
   `apps/korbjaeger/README.md` and CLAUDE.md's Korbjäger section against the
   new wording; no edit expected. Record the result in the PR.
