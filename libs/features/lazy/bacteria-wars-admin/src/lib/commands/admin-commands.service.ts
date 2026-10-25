import { inject, Injectable } from '@angular/core';
import {
  type AdminCommandType,
  DESTRUCTIVE_COMMAND_TYPES,
  GameCloud,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminAccessService } from '../access/admin-access.service';

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

  public async send(
    command: AdminCommandInput,
    now: number = Date.now()
  ): Promise<AdminResult> {
    const connection = this.cloud.firebase();
    const uid = this.access.uid();
    if (connection === null || uid === null) {
      return { ok: false, error: 'not-admin' };
    }
    if (
      DESTRUCTIVE_COMMAND_TYPES.includes(command.type) &&
      !this.access.signedInLately(now)
    ) {
      return { ok: false, error: 'sign-in-again' };
    }
    const { db, dbSdk } = connection;
    const ref = await dbSdk.addDoc(dbSdk.collection(db, 'adminCommands'), {
      uid,
      type: command.type,
      target: command.target,
      ...(command.reason === '' ? {} : { reason: command.reason }),
      args: command.args,
      createdAt: dbSdk.serverTimestamp(),
      expireAt: dbSdk.Timestamp.fromMillis(now + COMMAND_TTL_MS),
    });
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
            const { ok, error } = result as { ok?: unknown; error?: unknown };
            resolve(
              ok === true
                ? { ok: true }
                : {
                    ok: false,
                    error: typeof error === 'string' ? error : 'internal',
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
