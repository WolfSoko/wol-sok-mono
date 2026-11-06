# Plan #2776: codebase architecture improvements analysis

1. **Survey** the game lib, the engine and the functions with the admin lib
   in parallel, against the `codebase-design` skill's deepening checklist.
   Spot-check the key claims in the code.
2. **Write** `docs/bacteria-game/architecture-deepening.md`: a ranking
   table and one section per candidate.
3. **Agree** the spec, the plan and the candidate list with the manager
   before any issue exists.
4. **Create the issues**, one per candidate, labelled `architecture` and
   `status:idea`, and link their numbers in the document's table.
5. **Check** `npx nx format:check` (with the pinned oxfmt) on the docs.
6. **Commit** `docs(feat-lazy-bacteria-game): record the architecture deepening candidates`
   with spec, plan and document. Open a PR to `main` with `Closes #2776`,
   and comment the issue list on #2776.
