# Plan #2783: command documents, one envelope, result and runner

Spec: `docs/specs/2783-arch-command-documents-one-envelope-result-and-runner.md`.

1. **Engine module, test first.**
   `libs/features/bacteria-engine/src/lib/state/command-documents.spec.ts`,
   then `command-documents.ts`: `COMMAND_ENVELOPE_KEYS`, `COMMAND_TTL_MS`,
   `commandExpiresAt`, `REPLAY_COMMAND_TYPES`, `PLAYER_REPLAY_COMMAND_TYPES`,
   `CURATION_COMMAND_TYPES` and their types, `parseReplayCommand`,
   `CommandResult`, `parseCommandResult`. `admin-commands.ts` takes the
   envelope keys from it. Export through `src/index.ts`.
   Check: `nx test feat-shared-bacteria-engine`.
2. **Functions runner, test first.** `src/commands/commands.emulator.ts`
   (not-writer, internal, duplicate, deleted command), then
   `src/commands/run-command-document.ts`. `admin/command.ts` and
   `replays/command.ts` run through it and use the engine's types and
   parser; the curation's `error`-to-`reason` conversion goes. Drop the
   moved cases from `admin.emulator.ts` and `replays.emulator.ts`
   (`not-admin` stays with the admin), and turn `reason` into `error` in the
   replay and gallery suites. Check: `nx test bacteria-wars-functions`,
   `nx run bacteria-wars-functions:test-emulator`.
3. **Game.** `storage/command-envelope.ts` (+ spec) with `commandEnvelope`;
   `firestore-game-replays.ts` writes submissions and commands through it;
   `replay-records.ts` drops its command types and parser for the engine's;
   `my-matches.component.ts` reads `error`; `game-replays.ts`,
   `local-game-replays.ts`, `testing/fake-game-replays.ts` and the specs
   follow. Export `commandEnvelope` from `admin-kit.ts`.
   Check: `nx test feat-lazy-bacteria-game`.
4. **Admin.** `admin-commands.service.ts` writes through `commandEnvelope`,
   returns `CommandResult` and parses with `parseCommandResult`;
   `command-types.ts` takes the curation types from the admin kit.
   Check: `nx test feat-lazy-bacteria-wars-admin`.
5. **Docs.** `CLAUDE.md` (Cloud Functions section), ADR 0011's result
   field, the privacy spec's TTL comment.
6. **Checks and commit.** `nx format:write`,
   `nx affected -t lint,lint-templates,test`, the functions' emulator
   target, the goldens' specs; one commit
   `refactor(feat-shared-bacteria-engine): one envelope, result and runner for command documents`
   with spec, plan and code; PR to `main` with `Closes #2783`.
