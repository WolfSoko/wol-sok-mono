import { isEqual } from 'lodash';
import { distinctUntilChanged } from 'rxjs';

export function distinctUntilChangedDeepEqualObj<T>() {
  return distinctUntilChanged<T>(isEqual);
}
