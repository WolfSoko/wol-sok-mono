import { BasketballDataError } from '../domain/basketball-data-error';
import { DbbObject, shapeError } from './dbb-object';

/** The DBB's `status` values: it answers HTTP 200 even when a read fails. */
const DBB_STATUS = { ok: '0', notFound: '1', serverError: '-1' } as const;

/**
 * The `data` of a DBB response envelope (`{ status, message, data, ... }`).
 * Status `"1"` throws a `not-found` error, `"-1"` an `unavailable` one, and
 * anything else that is not a `"0"` with data an `unexpected-shape` one.
 */
export function readEnvelope(response: unknown): unknown {
  const envelope = DbbObject.of(response, 'envelope');
  const status = envelope.string('status');
  const message = envelope.optionalString('message') ?? '';
  switch (status) {
    case DBB_STATUS.ok:
      return envelope.value('data');
    case DBB_STATUS.notFound:
      throw new BasketballDataError(
        'not-found',
        `DBB: ${message || 'not found'}`
      );
    case DBB_STATUS.serverError:
      throw new BasketballDataError(
        'unavailable',
        `DBB: ${message || 'server error'}`
      );
    default:
      throw shapeError('envelope.status', '"0", "1" or "-1"', status);
  }
}
