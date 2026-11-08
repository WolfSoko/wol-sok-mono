import { BasketballDataError } from '../lib/domain/basketball-data-error';

/** The `BasketballDataError` `read` throws; fails the spec if it throws none. */
export function caughtError(read: () => unknown): BasketballDataError {
  try {
    read();
  } catch (error) {
    return asBasketballDataError(error);
  }
  throw new Error('expected a BasketballDataError, but nothing was thrown');
}

/** The `BasketballDataError` `read` rejects with; fails if it resolves. */
export async function rejectedError(
  read: () => Promise<unknown>
): Promise<BasketballDataError> {
  try {
    await read();
  } catch (error) {
    return asBasketballDataError(error);
  }
  throw new Error('expected a BasketballDataError, but the read resolved');
}

function asBasketballDataError(error: unknown): BasketballDataError {
  if (error instanceof BasketballDataError) {
    return error;
  }
  throw error;
}
