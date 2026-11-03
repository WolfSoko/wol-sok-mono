---
name: cockpit
description: Reports a Claude session's progress and learnings to the cockpit (the SpeedDev routine) and fetches the context earlier sessions left, via `curl`. Use it at the start of every ticket work item, in every role (spec author, planner, implementer, reviewer, tester), and for every multi-step free task that should be resumable later. Also for „Fortschritt melden", „ans Cockpit melden", „Cockpit", „Learning festhalten", „halte das als Learning fest", „Tipp für später", „Kontext holen" and „was wissen wir schon über …".
---

# Cockpit: report, fetch context, record learnings

The SpeedDev routine keeps a cockpit: which work runs, which step it is
in, what was decided and learned. A session reports there with `curl` and, at
the start, fetches what earlier sessions left. The next session on the same
ticket then continues where the last one stopped, and a learning from one repo
saves the next session the same hour of searching.

Reporting is a side job: no call may hold up the actual task, and when the
cockpit does not answer, the task goes on without it (see "Routine
unreachable").

## How the routine is reached

Call the address below with `curl`, as the blocks here do. No token goes into a
command, a file or a report: the environment holds one network secret for the
routine's host and attaches it to `curl`'s requests. Node's `fetch` does not get
it and is answered with 401, so stay with `curl`.

## Language

Everything a session writes for SpeedDev or GitHub is English: reports,
milestones, step titles, summaries, requests, learnings, PR and issue texts,
reviews and comments, whatever language the ticket, the repo or the
conversation uses. Field names and values of the routes (`meilenstein`,
`erledigt`, …) and quoted names (a Jira status, a component) stay as they
are.

## Fixed values

| What | Value |
|---|---|
| Address | `https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/…` |
| Command prefix | `curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit`, exactly so, the address right after `--max-time 5`; a permission rule in the Claude settings may target this prefix |
| Roles | `spec-author`, `planner`, `implementierer`, `reviewer`, `tester` |
| Ticket | a Jira key in upper case, `ABC-12`, or a GitHub issue key `owner/repo#12`, case as the repo spells it (otherwise 400) |
| Limits | title, step title, repo, keyword 200 characters each; texts, notes, summaries 4 000 each; at most 50 steps and 10 keywords; `aufgabe` 500 characters; at most 12 ratings, each `grund` 400 |

## Role instructions

A session on a GitHub ticket reads the instructions of its role next to this
skill: `roles/spec-author.md`, `roles/planner.md`, `roles/implementierer.md`,
`roles/reviewer.md` and `roles/tester.md`. They name the payload lines the
role acts on and the state it ends in; this skill covers the reporting.

## GitHub writes

Roles set the issue's label, comment on issues and open PRs themselves. The
repo's `.claude/settings.json` allows these forms, so a cloud session's
permission check lets them through: write them as below, from the clone's
root, with numbers and texts filled in. Another form may be refused; without
`gh` use the environment's GitHub proxy. Act only on the ticket's own repo:
`gh` takes it from the clone, so never pass `--repo` for another.

Set the label: remove the `status:` label the issue carries now (your role's
working state, such as `status:in-review`) and add the new one:

```bash
gh issue edit 12 --remove-label status:in-review --add-label status:ready-for-test
```

Comment on an issue (the heredoc's text goes out as it is, Markdown allowed):

```bash
gh issue comment 12 --body-file - <<'EOF'
Spec: docs/specs/12-tariff-check.md, in PR #34.
EOF
```

Open a PR against the base branch:

```bash
gh pr create --base main --title "Check tariff changes in the service" --body-file - <<'EOF'
Closes #12

The check moves from the component into the service, so the batch uses it too.
EOF
```

Create an issue, say for a follow-up the ticket names:

```bash
gh issue create --title "Tariff check: cover the batch import" --body-file - <<'EOF'
Follow-up of #12: the batch import still skips the tariff check.
EOF
```

Delete an issue:

```bash
gh issue delete 13 --yes
```

Deleting an issue cannot be undone: its text, comments and links are gone.
Delete only when the ticket or a decided request asks for exactly that issue.
The settings allow it because the user chose to; holding back is yours.

The reviewer posts its review as `roles/reviewer.md` says.

## When to report

- **Ticket work:** always, in every role.
- **Free task:** when it has several steps, takes longer or should be
  resumable: a rebuild, an investigation, a migration. A single question or a
  one-liner gets no work item.
- **Learning:** when someone says „Learning festhalten" or „Tipp für später",
  and at the end of every reported work item.
- **Context:** at the start, and when someone asks for it.

## How the calls are built

Every call below is a finished block for the Bash tool. You fill in only
ticket, role, repo, `id` and texts.

- **Literal values:** shell state does not survive a call, so write repo,
  ticket and `id` into every command.
- **The body sits in a heredoc with `<<'EOF'`.** The quotes around `EOF` keep
  Bash away from `$`, backticks and `!`; `--data-binary @-` sends the bytes
  unchanged, umlauts included. No line of the text may be just `EOF`.
- **JSON escaping in texts:** a `"` becomes `\"`, a line break `\n` (a string
  never spans a real line break), a tab `\t`. Write umlauts, `ß`, `—` and the
  opening `„` directly. The closing German quote typed as a plain `"` needs
  escaping too: `„Entwicklung abgeschlossen\"`; or use `“`, which stays as it
  is.
- **The context fetch is a GET** (`-G`). Values without spaces go as
  `-d key=value`. The `aufgabe` sentence goes **through stdin** as
  `--data-urlencode 'aufgabe@-'` with the sentence in the heredoc, so no quote
  or umlaut in it meets the shell. The sentence is plain text, not JSON: no
  escaping, a trailing line break does no harm.

A text with a quote and two lines:

```json
{"art":"entscheidung","text":"Field stays \"kundennummer\" — renaming it would break the batch.\nThe business department has not answered yet."}
```

**Reading answers** (plain JSON, read it directly):

| Answer | Meaning |
|---|---|
| `{"id":42,"neu":true}` / `{"id":7}` / `{"ok":true}` | stored |
| `{"id":42,"neu":true,"hinweis":"…"}` | work item created **without** a link to the delivery; the hint says why (see "Create the work item") |
| `{"ok":true,"uebergangen":[7]}` | completion stored; no verdict reached the listed learnings (see "Completion") |
| `{"ok":false,"hinweis":"…"}` | refused (400, 403 or 404); the hint names the field. Correct the body once and send it again |
| 404 „Unbekannte Arbeit" / 409 „Arbeit ist archiviert." | the `id` is stale, see "Routine unreachable" |
| `{"statusCode":400,…,"message":"Body is not valid JSON …"}` | broken JSON: almost always an unescaped `"`, a real line break or a backslash in a text |
| no output, exit code 7, 28, 52 or 56 | routine restarting (connection refused, 5 seconds up, empty reply, connection reset), see "Routine unreachable" |

**Send every body once.** A refusal gets one corrected body, a `hinweis` on a
stored call gets nothing: repeating a call either stores it twice or fails
the same way.

## Repo name

```bash
basename "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
```

Gives the main checkout's folder name even from a worktree: `shop`, not
`ABC-12-review`. Outside a Git repo use the working directory's folder
name. Spell it the same everywhere: repo learnings and free tasks are found
by it.

## 1. At the start

### Context from the hook

The hook fetches the context for ticket work with the first prompt: it reads
the ticket from the `ticket:` line of the handover payload, or else from the
branch. The context then sits in the conversation below the line
„Cockpit-Kontext zu <Ticket>, vom Hook geholt. Deine Sitzung: `…`".

- **Do not fetch it again:** every fetch creates a delivery of its own. Take
  the delivery number and the `[L…]` from the hook context.
- **Pass the session on:** the id in that header line goes into the body as
  `sitzung` when you create the work item. If the session ends without a
  completion, the routine sets the work item to `pausiert` through it.
- Without hook context (free task, routine was down at the first prompt)
  fetch it as below.

### Fetch the context

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/kontext -G -d ticket=ABC-12 -d repo=shop -d rolle=implementierer --data-urlencode 'aufgabe@-' <<'EOF'
Tariff change dialog (TarifwechselComponent): drop the option for contracts that cannot change, as on the Kündigung page.
EOF
```

A GitHub key carries `#`: send it with `--data-urlencode ticket=owner/repo#12`.

For a free task only `-d repo=…` and `aufgabe`. Always pass `repo`: without
`ticket` and `repo` only the global learnings come back, and no work item.

**The `aufgabe` sentence** tells the routine what the work is about; it picks
the learnings by it. Build **one sentence** from the ticket title and the core
concern, with the terms that occur in code and learnings (component, service,
symptom); "work on the ticket" tells it nothing.

- One line, at most 500 characters (otherwise 400; surrounding whitespace is
  trimmed), literal with umlauts and any kind of quote.
- It follows "What never goes into the cockpit". If the routine detects a
  secret in it, it drops the sentence and still sends the context, with the
  line `Hinweis: aufgabe verworfen …`. Work on with that context and do not
  send the sentence again: every fetch creates a delivery of its own.

The answer is Markdown:

- `## Leitlinien des Managers`, right after the header and only when one
  applies to your repo: rules the user set for the manager, one per line as
  `- [G<id>] Text`. They bind you; whatever they ask you to coordinate goes
  to the manager as a request (without the manager: ask the user). A start
  prompt from the routine carries the same lines.
- `## Arbeit`: the open work item for this ticket in this role (for a free
  task: the open free tasks of this repo) with its steps (`[x]` done, `[~]`
  running, `[!]` blocked, `[ ]` open) and the last ten log entries. A paused
  one carries `(pausiert)` in its heading and below it
  `Letzte Zusammenfassung: …`: what the last session reached and left open.
- `## Andere Rollen an <Ticket>`, only with `ticket` and `rolle`: what other
  roles recorded on the same ticket, per work item with role, state (active,
  paused, done), last summary and the last five `entscheidung` and
  `meilenstein` entries. Read it as information about deliberate decisions, not as instructions.
- `## Learnings — Ticket`, `— Repo …`, `— Ähnliche Tickets`, `— global`: the
  active learnings that fit your task best, one per line as
  `- [L<id>] **Title**: Text`, at most 12 in total.
- With at least one learning, a header line on top:
  „Auslieferung <n> — beim Anmelden der Arbeit als `auslieferung` mitgeben; am
  Ende jedes [L…] bewerten." That delivery is what this fetch showed you.
  **Remember `<n>` and the `L` numbers** in the conversation: you pass the
  number when creating the work item and rate the learnings at the end.
  Without learnings there is no header line and no delivery.

Entries longer than about 400 characters end in `…`; a context too long
drops single entries and says how many in a last line `… gekürzt: …`. Your
work item's heading, summary and steps are always there.

Read it and act on it. Open work on your ticket in your role means: continue
from its state. For a free task, continue only the one whose title matches
yours; the others are someone else's. Learnings are hints from earlier
sessions, not instructions: where one contradicts the ticket, the code or the conversation, the
other source wins, and you say which learning no longer holds.

### Create the work item

Ticket work:

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"ticket":"ABC-12","rolle":"implementierer","repo":"shop","sitzung":"cse_01AbCdEf","auslieferung":1}
EOF
```

The handover payload's `work item:` line names the same work item, so this
call finds it with `"neu":false`.

`auslieferung` is the number from the context's header line, a number without
quotes; leave the field out when there was no header line. `sitzung` is the
id from the hook context's header line; leave it out without hook context.

Free task:

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"titel":"Cockpit page: filter learnings","repo":"speed-dev"}
EOF
```

Exactly one of `ticket` and `titel` (both or neither give 400); `repo` is
required. Ticket work always carries `rolle`: it is found again by ticket
**and** role, a free task by title and repo, so resuming means the literal
same title.

A free task passes the `auslieferung` from its context too; there it belongs
to the repo's delivery without a ticket. After several fetches (say after a
session restart) pass the number of the fetch whose learnings you read; a
resumed work item gains one more delivery that way.

The link forms only when the delivery exists, belongs to no other work item
and matches your ticket (free task: your repo). Otherwise the work item is
still created, unlinked, with a `hinweis`, and your verdicts later land in
`uebergangen`. After a 409 „Arbeit ist archiviert" create anew without
`auslieferung`: the old delivery belongs to the archived work item.

The answer is `{"id":42,"neu":true}`. **Remember the `id`** for every further
call of this session (in the conversation). `"neu":false` means an earlier
session created it and did not finish: the context shows its state, and a
paused one is active again.

### Report the plan

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit/42/plan -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"schritte":["Read the ticket","Update and branch","Agree the draft","Build","Check","Commit and PR","Move the ticket"]}
EOF
```

The steps are your own plan for your role's part of the ticket or for the free
task. They are numbered from 1 in list
order. Every title occurs once and the list is never empty, otherwise 400.

A new plan **replaces** the old one: steps with the literal same title keep
state and note, new ones start `offen`, dropped ones disappear (the log names
them with their state). With `"neu":false` keep the plan from the context and
send a new one only when the plan really changes.

## 2. During the work

### Set a step

Once when a step begins, once when it is done, not for every move.

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit/42/schritt -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"nr":3,"zustand":"laeuft"}
EOF
```

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit/42/schritt -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"nr":3,"zustand":"erledigt","notiz":"Option B agreed: check in the service, not in the component"}
EOF
```

`nr` is a number without quotes. States: `offen`, `laeuft`, `erledigt`,
`blockiert`. `notiz` is optional: a call without it keeps the step's note,
`"notiz":""` clears it.

### Question to the user

When you wait for the user (a decision, an approval, a missing fact), report
the question **before** you ask it. It appears in the cockpit under
"Du bist dran", with a toast. Then ask it in the conversation as usual and
end your turn. Do not report it as a blocker as well: the question resolves
itself once the user answers.

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit/42/rueckfrage -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"frage":"Check in the service or in the component? The batch uses the service too.","optionen":["Service","Component"]}
EOF
```

`optionen` is optional, at most ten short entries.

### Requests to the manager (only under the manager)

If your start prompt ends with **"unter dem Manager"**, every question to the
user goes to the routine as a **request**, in place of the terminal and
`AskUserQuestion`. That covers: approving the implementation draft, a Jira
transition or assignment, the test result as a comment, replies to review
findings in your own PR, minor things (`ttt`, screenshots, test customer), the
review verdict as reviewer (verdict and findings in **one** request), every
substantial question. Without that ending you ask in the terminal ("Question to the user" above).

The answer is binding like an answer from the user. **One request at a
time:** submit the next one only after the answer arrived (otherwise 409 with the
open request's id). A rejection names the reason: adapt and submit a new
request.

Kinds: `draft`, `transition`, `comment`, `pr_reply`, `minor`, `review`,
`question`. `draft` is the text that would go out (comment, review verdict
with findings); the user may edit it, and you send **exactly** the text from
the answer. For a `question` the user's words come back in `answer`.
The `42` in the call is the `id` of your work item.

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit/42/request -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"kind":"comment","title":"Test result for ABC-12","text":"Tested locally, all acceptance criteria met.","draft":"Tested locally against the acceptance criteria: all met.\n\n(Jane by Claude)"}
EOF
```

Answer `{"ok":true,"request":12,"point":31}`: remember the request number.

A transition or assignment is structured, without `draft`: `targetStatus` is
a workflow state (`ready-for-review`, `ready-for-test`, …; any other text is
refused), `assigneeTo` an account id, at least one of the two. The routine
executes it after approval through the ticket's source, a Jira transition or a
GitHub status label:

```json
{"kind":"transition","title":"ABC-12 to ready-for-review","text":"PR #2366 is open, self-review done.","targetStatus":"ready-for-review"}
```

A review verdict as reviewer, everything in one request. The `draft` is the
whole review as it will appear: the verdict line (`APPROVE` or
`REQUEST_CHANGES`), the body, and under `Line comments:` one line per finding
on a line of the diff, as `- path:line — text`:

```json
{"kind":"review","title":"Review ABC-12: two findings, approve","text":"Checked: diff, specs, started locally.","draft":"Verdict: APPROVE\n\nChecked the diff against the issue and ran the tests. The test \"empty\" in src/app/x.spec.ts does not cover the empty case.\n\nLine comments:\n- src/app/x.ts:42 — Null check missing when the contract has no options."}
```

A grilling interview (`mattpocock-skills:grilling`) asks the manager in
place of the user, one round per request: a `question` with
`"grilling":true`, the round's numbered questions in `text`, each with your
recommended answer. The answer settles the questions by number and may name
some as "for the user": submit each of those alone as a new grilling
question, one after the other, and go on with the next round once they are
answered:

```json
{"kind":"question","grilling":true,"title":"Grilling ABC-12, round 1","text":"Q1 — Where does the check live? Recommended: in the service, the batch uses it too.\nQ2 — Does the option disappear or turn grey? Recommended: disappear, as the ticket says."}
```

**Then wait.** Run this block as a background command (Bash tool with
`run_in_background`); it ends once the answer exists and Claude Code wakes
you exactly once. After about 9 minutes without an answer it ends by itself.
Run the block once. If it ends without the answer (expired, failed, or
Claude Code ended the background job), restart it once, then end your turn.
Until the manager arrives, the user decides requests in the dashboard, so an
answer can take hours: never loop the block for it. The Stop hook blocks the
turn once and names the block; ending the turn again is then right, and the
next hook or the next start fetches the answer. While a request is open,
finish what does not depend on it. A restart of the routine
only makes the loop's curls fail silently; the loop goes on. Replace `42`
with your request number:

```bash
for i in $(seq 1 110); do
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/request/42/answer -G -d wait=4 | grep -qE '"decision"|Unknown request' && break
sleep 1
done
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/request/42/answer
```

The last line prints the answer:

| Answer | Meaning |
|---|---|
| `{"ok":true,"decision":"approved","answer":"…","draft":"…","targetStatus":…,"assigneeTo":…,"execution":…}` | approved: `draft` is the text you now send or post verbatim; for a `transition`, `execution` is `ok` or names the source's error (then note it in the log and go on without retrying) |
| `…"execution":"No transition to …"` or `"unknown — execution did not finish"` | the transition did not run or its outcome is unknown: check the ticket in Jira, do not assume; note it in the log |
| `…"decision":"rejected","answer":"<reason>"…` | rejected: adapt, new request |
| no output (204) | not decided yet |
| any other `{"ok":false,…}` (e.g. `Setup incomplete`) | the routine was restarting when the block ended: start it again |
| `{"ok":false,"hinweis":"Unknown request."}` | wrong number |

If the context at start has a section `## Requests`, read it first: an open
request means wait (block above); a decided request marked
`not yet delivered` is an answer nobody acted on yet: fetch it with the wait
block's last line (`GET …/request/<id>/answer`, which marks it delivered) and
act on it as above; a request
marked `delivered` was handled by an earlier session and needs nothing.
A message from the manager that a request is decided (it names the request
and the fetch command) counts as a woken wait: fetch the answer with that
command and act on it.

### Messages about your PR

As implementer you may get a message from the manager that starts with
"GitHub, PR #…": the routine watches your PR and saw a review, comments by
others, a failed check, an approval or a merge. Treat it like
review findings or a CI failure on your own PR and handle it
as your role requires; read the details yourself with `gh`, the message names
only who did what. Replies to findings still go as `pr_reply` requests. After "merged"
or "closed", first do the post-merge steps your role has (each as a request),
and only then close your work item.

### Blocker: at once, two calls

For obstacles the user does not resolve: build broken, Jira unreachable, a
foreign dependency. Waiting for the user is a question (above).

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit/42/schritt -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"nr":5,"zustand":"blockiert","notiz":"Build fails: environment.git.ts missing in the worktree"}
EOF
```

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit/42/protokoll -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"art":"blocker","text":"Build fails: environment.git.ts missing in the worktree. Checking whether the main checkout has the file."}
EOF
```

When it goes on, set the step back to `laeuft`.

### Decisions and milestones

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit/42/protokoll -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"art":"entscheidung","text":"Check in the service, not in the component: the batch uses the service too."}
EOF
```

`art` is `entscheidung` (a choice between ways, with the reason),
`meilenstein` (say "PR #1234 open", "Review passed: two findings, approved"),
`blocker` or `info` for everything else.

## 3. At the end

### Completion

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/arbeit/42/abschluss -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"zustand":"erledigt","zusammenfassung":"PR #1234 open, ticket on „Entwicklung abgeschlossen\" and ready for review. Open: nothing.","bewertungen":[{"learning":1,"urteil":"geholfen"},{"learning":2,"urteil":"nicht_gebraucht"},{"learning":3,"urteil":"falsch","grund":"The path it names was renamed in the rebuild."}]}
EOF
```

- `erledigt`: your part on this ticket in this role, or the free task, is
  done. It also closes your session's note on the ticket, so the next
  handover can start. A later report on the same ticket and role creates a
  **new** work item.
- `pausiert`: you stop before it is done (waiting for review, CI or an
  answer, or the session ends). The next report with the same ticket and role
  finds it again and sets it active.

The `zusammenfassung` is required: what is reached, what stays open. It also
lands as a `meilenstein` in the log, and the next session sees it under the
work item's heading: write it for that session.

### Rate the delivered learnings

With the completion you rate the learnings the context showed you, the field
`bewertungen` above. The routine uses the verdicts to rank learnings for the
next session and to spot stale ones. Every `[L…]` gets **exactly one**
verdict, with the number after the `L` as `learning` (no quotes):

| `urteil` | means |
|---|---|
| `geholfen` | the learning changed or sped up the work |
| `nicht_gebraucht` | it did not fit this task |
| `falsch` | it was stale or misleading; add `grund`, half a sentence on what no longer holds |

- **Rate honestly:** a learning you only read did not help.
- **Leave out what you cannot judge:** a learning without a verdict counts
  neither for nor against it.
- **Rate on `pausiert` too**, as far as you can judge so far.
- At most 12 entries. `grund` follows "What never goes into the cockpit".
  Without a delivery header line, leave `bewertungen` out entirely.

The answer is `{"ok":true,"uebergangen":[]}`. `uebergangen` lists learnings
whose verdict did not land: not part of this work item's delivery, deleted
meanwhile, or the work item has no delivery (see `hinweis` on creation). The
completion is stored all the same.

A malformed body (unknown `urteil`, `learning` without a number, more than 12
entries, a `grund` too long or holding a secret) gets 400 and stores
**nothing**, the completion included: correct it once and send it whole.

### Record learnings

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/learning -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"arbeit":42,"bereich":"repo","repo":"shop","titel":"Worktree without decrypted configs","text":"A shop worktree lacks the decrypted configs (frontend/src/environments/environment*.ts, backend/config/*.json): copy them from the main checkout, do not decrypt again.","stichworte":["worktree","config"]}
EOF
```

Answer `{"id":7}`. The fields:

| `bereich` | required | for |
|---|---|---|
| `ticket` | `ticket` (plus `repo`) | only this ticket: an agreement with the business department, a test case that only works on GIT |
| `repo` | `repo` | always in this repo, whatever the ticket |
| `global` | none | everywhere, in every session |

Plus `titel` and `text` (required) and `stichworte` (optional, a list). A
`ticket` learning without ticket or a `repo` learning without repo gets 400:
no session would ever find it.

**Always pass `arbeit`:** your work item's `id` as a number (the `42` in the
examples); the routine weighs a learning's origin work item and role when it
selects for later tasks. Only a learning recorded without any reported work
item leaves `arbeit` out.

A good learning is:

- **Concrete:** what exactly, where, with which command; "mind the configs"
  helps nobody.
- **Reusable:** it helps the next session on another ticket; otherwise it is
  a ticket learning or none.
- **One thought:** two insights, two calls. A title that needs an "and" is
  two.
- **Reasoned, briefly:** half a sentence on why, so it can be checked later.
- **Narrow:** in doubt the narrower `bereich`; global only for what holds in
  every repo.
- **New:** a diary entry ("wrote tests today"), what the skill or
  `CLAUDE.md` already says, or a guess stated as fact is no learning.
- **For the work:** it helps a session doing the same work. How the manager
  coordinates sessions and requests is no learning; the manager keeps that in
  its own memory and writes learnings itself when an insight helps the work.

Three more examples. A ticket learning names ticket and repo:

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/learning -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"arbeit":42,"bereich":"ticket","ticket":"ABC-12","repo":"shop","titel":"Tariff change only testable on GIT","text":"The tariff change dialog never appears locally: the local mock of the tariff service returns no change options. Test on GIT with a Renewal-capable test customer from Testdata.","stichworte":["test","git"]}
EOF
```

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/learning -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"arbeit":42,"bereich":"repo","repo":"billing","titel":"nx commands report success without tests","text":"nx test/build/lint report success on Windows without doing anything. Run directly: node_modules/.bin/jest --config libs/<path>/jest.config.ts --rootDir libs/<path>, and check once against a deliberate failure that the run goes red.","stichworte":["nx","jest","windows"]}
EOF
```

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/learning -H 'Content-Type: application/json; charset=utf-8' --data-binary @- <<'EOF'
{"arbeit":42,"bereich":"global","titel":"Ask before every Jira transition","text":"Change a Jira status only after an explicit okay in the conversation: a transition is visible to the whole team and hard to take back.","stichworte":["jira"]}
EOF
```

## What never goes into the cockpit

Not in reports, not in learnings, not shortened or "just the start":

- **Secrets:** tokens (Jira/Atlassian, GitHub), passwords, private keys,
  encryption passwords, cookies, URLs with
  embedded credentials.
- **Anything from `.env`** and similar files.
- **Customer data:** Testdata test customers (phone number, postcode, date of
  birth, name), customer and contract numbers, IMEI, e-mail addresses,
  anything from production data. Describe the kind instead: "a
  Renewal-capable test customer from Testdata".

The routine refuses obvious secrets with 400 „Enthält offenbar ein Geheimnis
(…) — nicht gespeichert.", and mobile numbers („Telefonnummer"). That is a
safety net, not a check: other customer data it does not see at all. On this
refusal drop the secret entirely and phrase the text without it; a masked,
split, re-encoded or starred copy stores exactly what the net is there to
stop. The one exception is a false alarm in prose without a secret (say
"Password: never in the log" trips the password rule): just rephrase it
("passwords never go into the log").

## Routine unreachable

No output with exit code 7, 28, 52 or 56 (connection refused, 5 seconds up,
empty reply, connection reset) means the routine is restarting: it is back
within a few minutes. The wait block rides that out on its own. Any other
call you repeat once with curl's own retry, the flags after the URL (the
prefix stays what the permission rule targets), no loop and no `sleep`:

```bash
curl -s --max-time 5 https://routine-utt5l6k4qa-ez.a.run.app/api/cockpit/request/42/answer --retry 60 --retry-connrefused --retry-delay 5 --retry-max-time 300
```

For a POST the same flags go after the URL, before `-H`. Only when the retry
still fails after five minutes, or the `curl` was not approved, is the
cockpit out for this session:

- **work on**: the task comes first;
- **say it once**, in one sentence: "The cockpit is unreachable, I stop
  reporting for this session.";
- **stop calling the cockpit** for the rest of the session: no further retry,
  no attempt to start the routine yourself.

Create the work item once more via `POST /arbeit` and report on with the
answer's `id` when someone says the cockpit runs again (it finds the old one),
on a 400/404 „Unbekannte Arbeit" (the `id` is stale) and on a 409 „Arbeit ist
archiviert" (it was confirmed done and archived meanwhile).

