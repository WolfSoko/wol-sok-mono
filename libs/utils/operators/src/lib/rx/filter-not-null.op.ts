import { filter } from 'rxjs/operators';
import { notNull } from '../not-null';

export const filterNotNil = filter(notNull);
