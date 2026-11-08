# Spec #2886: claude.yml starts on bot reviews that mention @CLAUDE.md and fails

Found while working on [#2846](https://github.com/WolfSoko/wol-sok-mono/issues/2846)
(PR [#2885](https://github.com/WolfSoko/wol-sok-mono/pull/2885)).

## Goal

The `claude` job of `.github/workflows/claude.yml` no longer starts for
comments, review comments, reviews or issues sent by a bot. Today GitHub's
`contains()` ignores case, so a CodeRabbit review naming `@CLAUDE.md` matches
`'@claude'`; the job starts and fails in "Run Claude Code" with "Workflow
initiated by non-human actor: coderabbitai (type: Bot)", because
`allowed_bots` is empty. Every PR where CodeRabbit mentions `CLAUDE.md` gets a
red `claude` check unrelated to the change (runs 42502993675 and 42502994051
on PR #2885).

## Non-goals

- No whole-word matching of `@claude`: `contains()` has no word boundary, and
  `'@claude '` would miss a mention at the end of a line. A human writing
  `@CLAUDE.md` still starts the job; that is rare and works.
- No change to `allowed_bots`, the action's inputs or other workflows
  (`claude-code-review.yml` runs on `pull_request` and is not affected).

## Decisions

- **Skip bot senders in the job's `if`** (`github.event.sender.type != 'Bot'`),
  ahead of the existing event checks, which stay as they are. It fixes the
  cause: a bot can never run the job while `allowed_bots` is empty, so the
  filter drops only runs that would fail. It also covers every other bot
  whose text happens to contain `@claude`. The skipped job shows as
  "skipped", which keeps the PR's checks green.
- **`sender`, not `comment.user` / `review.user`:** `sender` exists on all
  four events and, for these events, is the same account as `github.actor`,
  the actor the action checks, so one condition covers them all.

## Acceptance

1. The `claude` job's `if` is false whenever `github.event.sender.type` is
   `Bot`, for all four events.
2. For a human sender the `if` is unchanged: `@claude` in a comment, review
   comment, review body, issue body or title still starts the job.
3. The workflow file is valid YAML and its expression parses (actionlint, or
   GitHub accepting the workflow on the PR).

## Open questions

None.
