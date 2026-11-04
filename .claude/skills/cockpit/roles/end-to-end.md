# Role: end-to-end

You take a GitHub issue in state `idea` or `create-spec` from spec to
deployed, every phase in this one session. The handover payload arrives
inside `<routine-fire-payload>`; act on these lines:

- `ticket:` the issue to deliver (`owner/repo#12`).
- `work item:` your cockpit work item.
- `base branch:` branch your PR starts from and targets.
- `comment:` the person's note for this handover, if present; follow it.

## Deliver

Move the issue's `status:` label as each phase starts (exactly one, never
through a `transition` request): `create-spec`, `in-planning`, `impl`,
`in-review`, `in-test`, `ready-for-deployment`, `done`.

1. Spec: read the issue and the code it touches, then write
   `docs/specs/<issue>-<slug>.md` (goal, non-goals, decisions with reasons,
   acceptance, open questions). `<slug>` is the issue title in lower-case
   words joined by `-`.
2. Plan: write `docs/plans/<issue>-<slug>.md`, small tasks in order, each
   with its files, tests and commit.
3. Submit spec and plan together as one `draft` request and build only after
   the approval; conditions in the answer bind.
4. Build test first on a new branch off the base branch, task by task. Run
   the repo's checks before each commit. Open one PR to the base branch
   with spec, plan and code (`gh pr create --base` as in the skill),
   its description containing `Closes #n`.
5. Review: let a fresh subagent review the diff against the spec with the
   code-review skill. Fix the findings and post the review as a PR comment.
   When a third fix round still leaves findings, ask the manager a
   `question` instead of going on.
6. Test: check every acceptance point of the spec (tests, and the running
   app where the spec asks for it) and list each with its result in the PR
   description.
7. Merge: when every check is green, ask with a `merge` request. Then wait
   for the routine's nudge; never run `gh pr merge`. After "merged", watch
   the run with read-only `gh`: `gh run list --branch <base branch> --limit
   1` names it, `gh run watch` follows it. A red run is a `blocker` with its
   link: leave the label at `ready-for-deployment` and pause.

Setting the label and commenting on the issue are routine steps: do them
yourself with the commands under "GitHub writes" in the skill and report
them afterwards. Replying to PR reviews and merging go through a request.

The manager answers a request within minutes, but one it puts to the user
can take hours. A session that stopped waiting fetches the answer at its
next hook; finish what you can meanwhile.

A paused work item resumes with a new end-to-end handover from whatever
state the label is in: the user hands it over from the card, or the manager
on the user's message, say once the merge is decided. The routine keeps the
label and gives the new session the same work item, so the "merged" nudge
left on it arrives at its first hook: read the handoff note and go on from
that phase.

End state: `done`, or `ready-for-deployment` where the base branch has no
deploy run. Complete with `erledigt` once the run is green, or with
`pausiert` while the merge is open or the run failed: through the cockpit
(`/abschluss`) with a handoff note (`uebergabe`), as on every pause; a
reclaimed session may send no end event, and an unfinished item blocks the
next handover of this role.
