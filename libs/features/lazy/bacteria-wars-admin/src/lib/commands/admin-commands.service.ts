import { inject, Injectable } from '@angular/core';
import {
  type AdminCommandType,
  DESTRUCTIVE_COMMAND_TYPES,
  type FirebaseConnection,
  GameCloud,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import type { DocumentReference } from 'firebase/firestore';
import { AdminAccessService } from '../access/admin-access.service';
import {
  DESTRUCTIVE_REPLAY_TYPES,
  type ReplayCommandType,
} from './command-types';

/** What the server made of a command (`adminCommands/{id}.result`). */
export interface AdminResult {
  ok: boolean;
  /** An id such as `not-found`, never a text to show. */
  error?: string;
}

/** A command as the admin views send it; the envelope is added here. */
export interface AdminCommandInput {
  type: AdminCommandType;
  target: Record<string, unknown> | null;
  /** Why, 1 to 200 characters; may be empty for `stats.*`. */
  reason: string;
  args: Record<string, unknown>;
}

/** How long a command document lives (TTL); the rules allow up to 2 days. */
const COMMAND_TTL_MS = 24 * 3_600_000;

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
  ): Promise<AdminResult> {
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
    type: ReplayCommandType,
    replayId: string,
    now: number = Date.now()
  ): Promise<AdminResult> {
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
  ): Promise<AdminResult> {
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
      uid,
      ...fields,
      createdAt: dbSdk.serverTimestamp(),
      expireAt: dbSdk.Timestamp.fromMillis(now + COMMAND_TTL_MS),
    });
    return this.result(connection, ref);
  }

  /**
   * Waits for the function's `result` on a command document - `timeout`
   * when none comes within {@link RESULT_TIMEOUT_MS}. `adminCommand` names
   * a failure `error`, `replayCommand` `reason`.
   */
  private result(
    { dbSdk }: FirebaseConnection,
    ref: DocumentReference
  ): Promise<AdminResult> {
    return new Promise<AdminResult>((resolve, reject) => {
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
            const { ok, error, reason } = result as Record<string, unknown>;
            const why = error ?? reason;
            resolve(
              ok === true
                ? { ok: true }
                : {
                    ok: false,
                    error: typeof why === 'string' ? why : 'internal',
                  }
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
