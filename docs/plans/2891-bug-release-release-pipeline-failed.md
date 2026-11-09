# Plan #2891: release pipeline failed (tag already exists)

Spec: [docs/specs/2891-bug-release-release-pipeline-failed.md](../specs/2891-bug-release-release-pipeline-failed.md)

1. **Script for the moved-on check.** `tools/release/branch-moved-on.sh <branch> <validated sha>`:
   `git fetch origin <branch>`, compare `FETCH_HEAD` with the sha, on a
   difference write the `::notice::` and the `$GITHUB_STEP_SUMMARY` line and
   exit 0, else exit 1. Test: a throwaway repo with a bare remote, run the
   script against a tip equal to and different from the sha; `shellcheck`.
2. **Use it in `release.yml`.** New first step after checkout, "Stand down when
   the branch moved on" (`id: branch`, output `moved_on`); `Install Deps`,
   `Version` and the push step run only when `moved_on == 'false'`; the push
   step's fallback calls the script instead of its inline comparison. Test:
   actionlint on the file. Commit: `fix(github): stand down the release before
   versioning when main moved on`.
3. **Docs.** `docs/DEPLOYMENT.md`, "Release Pipeline": the job checks the tip
   before versioning, and again after a rejected push; stood-down changes wait
   for the newer commit's run, and for the next green run if its CI fails.
   Same commit.

Spec and plan go in a `docs(github): …` commit before the fix; the squash merge
lands everything as one commit.
