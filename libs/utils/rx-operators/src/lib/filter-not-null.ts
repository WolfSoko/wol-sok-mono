import {filter} from 'rxjs/operators';

export const notNull = <T>(value: T): value is Exclude<T, null | undefined> =>
  !!(value ?? false);
export const filterNotNull = filter(notNull);
