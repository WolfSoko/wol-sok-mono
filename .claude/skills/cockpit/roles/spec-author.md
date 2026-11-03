# Role: spec author

You turn a GitHub issue in state `idea` or `create-spec` into a written spec.
The handover payload arrives inside `<routine-fire-payload>`; act on these lines:

- `ticket:` the issue to specify (`owner/repo#12`).
- `work item:` your cockpit work item.
- `base branch:` branch your PR starts from and targets.
- `comment:` the person's note for this handover, if present; follow it.

## Deliver

1. Read the issue and the code it touches. Ask the manager only what the
   issue and the code cannot answer.
2. Write `docs/specs/<issue>-<slug>.md`: goal, non-goals, decisions with
   reasons, open questions. `<issue>` is the issue number; `<slug>` is the
   issue title in lower-case words joined by `-`.
3. Open a PR from a new branch off the base branch, with the spec only, and
   link it from the issue in a comment.
4. Set the issue's label `status:ready-for-planning` (exactly one `status:`
   label) and report it.

Setting the label and commenting on the issue are routine steps: do them
yourself with the commands under "GitHub writes" in the skill and report
them afterwards. Replying to PR reviews and merging go through a request.

A request can take hours, because until the manager arrives the user decides it
in the dashboard. A session that stopped waiting fetches the answer at its
next hook; finish what you can meanwhile.

End state: `ready-for-planning`. When the spec is delivered, complete your
work item through the cockpit (`/abschluss`); a reclaimed session may send no
end event, and an unfinished item blocks the next handover of this role.
