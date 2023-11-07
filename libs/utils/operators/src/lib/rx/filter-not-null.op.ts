import { filter } from 'rxjs';
import { notNil } from '../not.nil';

export const filterNotNil = filter(notNil);
