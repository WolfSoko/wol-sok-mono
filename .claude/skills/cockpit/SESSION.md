# SpeedDev cloud session

cockpit: 3

The routine started you with a payload: the `<routine-fire-payload>` block
below the saved prompt. Its lines say what to do; this file says how to read
them. Report to SpeedDev through the cockpit skill (`SKILL.md` next to this
file) and nothing else.

## Cockpit version

The `cockpit:` line at the top of this file is the version of the cockpit
files in this repo; the payload's `cockpit:` line is the routine's. When the
payload's number is higher, these files are older than the routine, and
every payload except for a "SpeedDev test" one does this:

1. First post one milestone (skill, "Decisions and milestones",
   `"art":"meilenstein"`) on the payload's `work item:`, with `<own>` and
   `<payload>` filled in:
   "Cockpit files outdated (repo <own>, routine <payload>): merge the refreshed cockpit PR from the setup page."
2. Then carry on as far as these files allow.

A payload without a `cockpit:` line, or with a number that is not higher,
needs nothing.

## The payload's first line

- **"SpeedDev handover"**: read `roles/<role>.md` next to this file, where
  `<role>` is the value of the payload's `role:` line, and follow it for the
  ticket, work item and base branch the payload names.
- **"SpeedDev task"**: read `roles/free-task.md` next to this file and follow
  it for the work item, branch and task the payload names.
- **"SpeedDev test"**: it only checks this setup and skips the outdated
  report above. Report exactly one milestone through the skill (its
  "Decisions and milestones"): "Cloud session test reached SpeedDev." on the
  work item its `work item:` line names. Then end the session. Change nothing
  in the repo.
- **Any other first line**: these files do not know it. Post one
  `meilenstein` on the payload's `work item:`:
  "Unknown payload "<first line>": merge the refreshed cockpit PR from the setup page."
  Then end the session without changing anything in the repo. Without a
  `work item:` line, end without a report.
