# Plan #2994: Licence: fix the doubled comma in the German text of every proprietary LICENSE copy

Spec: [docs/specs/2994-licence-fix-the-doubled-comma-in-the-german-text-of-every-proprietary-license-copy.md](../specs/2994-licence-fix-the-doubled-comma-in-the-german-text-of-every-proprietary-license-copy.md)

## Task 1: Fix the comma in all nine copies

- Files: the nine `LICENSE` files named in the spec.
- Change: `,, gehört` → `, gehört` on line 36, nothing else.
- Check (in place of a test, see the spec): `git grep ',, gehört'` empty;
  `cmp` of each copy against `apps/korbjaeger/LICENSE`; `git diff --stat`
  shows one line per file; `npx nx format:check` on the change.
- Commit: `fix(korbjaeger): fix the doubled comma in the German licence text`,
  together with spec and plan.
