import { inject, Injectable } from '@angular/core';
import {
  type AdminCommandType,
  commandEnvelope,
  type CommandResult,
  type CurationCommandType,
  DESTRUCTIVE_COMMAND_TYPES,
  type FirebaseConnection,
  GameCloud,
  parseCommandResult,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import type { DocumentReference } from 'firebase/firestore';
import { AdminAccessService } from '../access/admin-access.service';
import { DESTRUCTIVE_REPLAY_TYPES } from './command-types';

/** A command as the admin views send it; the envelope is added here. */
export interface AdminCommandInput {
  type: AdminCommandType;
  target: Record<string, unknown> | null;
  /** Why, 1 to 200 characters; may be empty for `stats.*`. */
  reason: string;
  args: Record<string, unknown>;
}

/**
 * How long `send` waits for the function's `result`: past the trigger's
 * 540 s, after which no result will come.
 */
export const RESULT_TIMEOUT_MS = 600_000;

/**
 * Sends the owner's commands (ADR 0012): writes `adminCommands/{id}` and
 * waits for the `adminCommand` function to write its `result` back -
 * `timeout` when none comes within {@link RESULT_TIMEOUT_MS}.
 * `sign-in-again` without sending when a destructive type needs a fresher
 * sign-in than the owner's, which the rules would refuse.
 */
@Injectable({ providedIn: 'root' })
export class AdminCommandsService {
  private readonly cloud = inject(GameCloud);
  private readonly access = inject(AdminAccessService);

  public send(
    command: AdminCommandInput,
    now: number = Date.now()
  ): Promise<CommandResult> {
    return this.write(
      'adminCommands',
      {
        type: command.type,
        target: command.target,
        ...(command.reason === '' ? {} : { reason: command.reason }),
        args: command.args,
      },
      DESTRUCTIVE_COMMAND_TYPES.includes(command.type),
      now
    );
  }

  /**
   * Sends the owner's gallery curation (ADR 0011): a `replayCommands`
   * document, which `replayCommand` runs and answers like `adminCommand`.
   * `feature` takes a stored replay's id, `unfeature` and `anonymise` a
   * public one's or a stored one's; those two, which cannot be taken back,
   * want a fresh sign-in too.
   */
  public sendReplay(
    type: CurationCommandType,
    replayId: string,
    now: number = Date.now()
  ): Promise<CommandResult> {
    return this.write(
      'replayCommands',
      { type, replayId },
      DESTRUCTIVE_REPLAY_TYPES.includes(type),
      now
    );
  }

  /** Writes a command in the owner's name and waits for its result. */
  private async write(
    collection: 'adminCommands' | 'replayCommands',
    fields: Record<string, unknown>,
    destructive: boolean,
    now: number
  ): Promise<CommandResult> {
    const connection = this.cloud.firebase();
    const uid = this.access.uid();
    if (connection === null || uid === null) {
      return { ok: false, error: 'not-admin' };
    }
    if (destructive && !this.access.signedInLately(now)) {
      return { ok: false, error: 'sign-in-again' };
    }
    const { db, dbSdk } = connection;
    const ref = await dbSdk.addDoc(dbSdk.collection(db, collection), {
      ...commandEnvelope(dbSdk, uid, now),
      ...fields,
    });
    return this.result(connection, ref);
  }

  /**
   * Waits for the function's `result` on a command document - `timeout`
   * when none comes within {@link RESULT_TIMEOUT_MS}, `internal` for a
   * result it cannot read.
   */
  private result(
    { dbSdk }: FirebaseConnection,
    ref: DocumentReference
  ): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        stop();
        resolve({ ok: false, error: 'timeout' });
      }, RESULT_TIMEOUT_MS);
      const stop = dbSdk.onSnapshot(
        ref,
        (snapshot) => {
          const result: unknown = snapshot.get('result');
          if (typeof result === 'object' && result !== null) {
            clearTimeout(timer);
            stop();
            const parsed = parseCommandResult(result);
            resolve(
              parsed?.ok === true
                ? { ok: true }
                : { ok: false, error: parsed?.error ?? 'internal' }
            );
          }
        },
        (error) => {
          clearTimeout(timer);
          stop();
          reject(error);
        }
      );
    });
  }
}
