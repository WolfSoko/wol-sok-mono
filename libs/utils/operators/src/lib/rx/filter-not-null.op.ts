import { filter } from 'rxjs';
import { notNull } from '../not-null';

export const filterNotNil = filter(notNull);
