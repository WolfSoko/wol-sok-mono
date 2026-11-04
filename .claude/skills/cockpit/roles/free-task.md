# Free task

You do one task in this repo that the manager started for the user, without
a ticket. The payload arrives inside `<routine-fire-payload>` and starts with
"SpeedDev task"; act on these lines:

- `work item:` your cockpit work item.
- `branch:` the branch you work on.
- `base branch:` the branch it starts from, and the target of your PR.
- `task:` what to do; it binds like a ticket.

Follow the repo's `CLAUDE.md` and its development skill, if it has one (in
speed-dev `.claude/skills/developing-speed-dev`), for design, checks and
commits; this file replaces its merge and push steps.

## Deliver

1. Register nothing: the work item exists, so skip "Create the work item" in
   the skill and use the `work item:` id in every call. Report your plan.
2. Create the branch from `branch:` off the base branch and work there.
3. Submit the design as a `draft` request (`text`: what and why; `draft`: the
   design) and build only after the approval; conditions in the answer bind.
4. Build test first and run the repo's checks before each commit.
5. Push the branch and open a PR to the base branch (`gh pr create --base`
   as in the skill's "GitHub writes"), its description saying what the task
   asked and what changed.
6. When every check on the PR is green, ask to merge with a `merge` request
   that names the PR, its head SHA and the green checks. The user decides it,
   never the manager; until then finish nothing that depends on the merge. A
   rejection names what to change: change it, push, and ask again.
7. After the request, wait for the routine's nudge; never run `gh pr merge`.
   The routine merges what the user approved. After "merged", watch the run
   the merge started with read-only `gh`: `gh run list --branch <base branch>
   --limit 1` names it, `gh run watch` follows it. "Not merged" names the
   reason: fix it, push, and ask again. Report a failed run as a `blocker`
   with its link.

A request can take hours when the user decides it. A session that stopped
waiting fetches the answer at its next hook; finish what you can meanwhile.

End state: the PR is merged and its run is green. Then complete your work
item through the cockpit (`/abschluss`) with `erledigt`; with the merge
still open or a failed run, complete it with `pausiert` and say what is
left. Every completion carries a handoff note (`uebergabe`) for the next
session.
