# Spec #2776: codebase architecture improvements analysis

## Goal

Find where Bacteria Wars' code would gain most from deeper modules, using
the `codebase-design` skill (Matt Pocock's "improve codebase architecture"
vocabulary: deep and shallow modules, seams, adapters, locality), and turn
each finding into a GitHub issue that a later session can pick up alone.

## Non-goals

- No code change in this ticket: the issues do the refactors, one per PR.
- No repeat of the earlier lib and component splits (#2482, #2682).
- No change to the weekly modularity review (#2370), beyond linking the new
  issues there in a comment.

## Decisions

- **Scope:** the game lib, the engine lib, the admin lib and the Cloud
  Functions. `apps/bacteria-game-remote` is thin wiring, and the GL
  painters are rendering internals (CI has no GPU to guard a refactor).
- **Record the analysis in the repo**, in
  `docs/bacteria-game/architecture-deepening.md`, so the issues can link
  one ranked, evidence-based overview with line references.
- **One issue per candidate**, labelled `architecture` and `status:idea`,
  with what is shallow today, the proposed interface, its dependency
  category, how its tests change, its size and its dependencies on other
  candidates. Small findings that fit into other work stay in the document.
- **Constraints carried into every issue:** the goldens stay byte-equal
  and `BALANCE_VERSION` is not bumped, the engine stays Node-only, and tests
  move to the new interface (replace, don't layer).

## Acceptance

1. `docs/bacteria-game/architecture-deepening.md` lists the candidates,
   ranked, each with files, evidence, the deeper module, its dependency
   category, tests and size.
2. Each candidate in its table has an open GitHub issue, labelled
   `architecture`, and the document's table links it.
3. #2776 gets a comment that lists the issues.
4. `npx nx format:check` passes on the new Markdown files.

## Open questions

- None that blocks the analysis. The owner decides order and timing per issue.
