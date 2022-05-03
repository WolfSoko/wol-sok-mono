import { map, OperatorFunction } from 'rxjs';
import { round } from '../round';

export function roundOp(decimals = 2): OperatorFunction<number, number> {
  return map(round(decimals));
}
