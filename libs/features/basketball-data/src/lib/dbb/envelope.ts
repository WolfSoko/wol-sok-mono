import { BasketballDataError } from '../domain/basketball-data-error';
import { DbbObject, shapeError } from './dbb-object';

/** What a DBB envelope's `status` says happened. */
export type DbbStatus = 'ok' | 'not-found' | 'server-error';

/** The DBB's `status` values: it answers HTTP 200 even when a read fails. */
const DBB_STATUS: Readonly<Record<string, DbbStatus>> = {
  '0': 'ok',
  '1': 'not-found',
  '-1': 'server-error',
};

/**
 * The `status` of a DBB response envelope, or `undefined` where `response`
 * is no envelope with a known status. For the app's proxy, which passes the
 * body on unread and only picks its HTTP status by this.
 */
export function dbbStatusOf(response: unknown): DbbStatus | undefined {
  if (typeof response !== 'object' || response === null) {
    return undefined;
  }
  const status: unknown = (response as { readonly status?: unknown }).status;
  return typeof status === 'string' ? statusNamed(status) : undefined;
}

/**
 * The `data` of a DBB response envelope (`{ status, message, data, ... }`).
 * Status `"1"` throws a `not-found` error, `"-1"` an `unavailable` one, and
 * anything else that is not a `"0"` with data an `unexpected-shape` one.
 */
export function readEnvelope(response: unknown): unknown {
  const envelope = DbbObject.of(response, 'envelope');
  const status = envelope.string('status');
  const message = envelope.optionalString('message') ?? '';
  switch (statusNamed(status)) {
    case 'ok':
      return envelope.value('data');
    case 'not-found':
      throw new BasketballDataError(
        'not-found',
        `DBB: ${message || 'not found'}`
      );
    case 'server-error':
      throw new BasketballDataError(
        'unavailable',
        `DBB: ${message || 'server error'}`
      );
    default:
      throw shapeError('envelope.status', '"0", "1" or "-1"', status);
  }
}

function statusNamed(status: string): DbbStatus | undefined {
  return Object.hasOwn(DBB_STATUS, status) ? DBB_STATUS[status] : undefined;
}
