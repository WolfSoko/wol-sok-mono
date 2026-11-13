import { InjectionToken, type Provider } from '@angular/core';
import {
  selectionChange,
  type SelectionChange,
} from '../errors/selection-change';

/**
 * The changes to the Kinder that a page's mark controls make
 * (`KindMarkierungComponent`), with what the page says when one fails. The
 * page shows that, not the control: a failed change can take the controls
 * away (a newer version's selection shows no followed Team), and its
 * reload hint must stay.
 */
export const KIND_AENDERUNG = new InjectionToken<SelectionChange>(
  'KindAenderung'
);

/** One `KIND_AENDERUNG` for the page that provides it. */
export function provideKindAenderung(): Provider {
  return { provide: KIND_AENDERUNG, useFactory: selectionChange };
}
