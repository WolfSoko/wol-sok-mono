/**
 * Why a read of basketball data failed:
 * - `not-found`: the source knows no such Liga, Team, Verein or Spiel.
 * - `unavailable`: the source could not be reached or reported a failure of
 *   its own; trying again later may help.
 * - `unexpected-shape`: the source answered, but not in the shape this lib
 *   reads; trying again will not help.
 */
export type BasketballDataErrorKind =
  | 'not-found'
  | 'unavailable'
  | 'unexpected-shape';

/** The one error type every `BasketballData` read rejects with. */
export class BasketballDataError extends Error {
  public override readonly name = 'BasketballDataError';

  public constructor(
    public readonly kind: BasketballDataErrorKind,
    message: string,
    options?: { readonly cause?: unknown }
  ) {
    super(message, options);
  }
}

/** Whether `error` is a `BasketballDataError`, optionally of one `kind`. */
export function isBasketballDataError(
  error: unknown,
  kind?: BasketballDataErrorKind
): error is BasketballDataError {
  return (
    error instanceof BasketballDataError &&
    (kind === undefined || error.kind === kind)
  );
}
