import { InjectionToken, type Provider } from '@angular/core';
import {
  selectionChange,
  type SelectionChange,
} from '../errors/selection-change';

/**
 * The changes to the Kinder that a page's mark controls make
 * (`ChildMarkComponent`), with what the page says when one fails. The
 * page shows that, not the control: a failed change can take the controls
 * away (a newer version's selection shows no followed Team), and its
 * reload hint must stay.
 */
export const CHILD_CHANGE = new InjectionToken<SelectionChange>(
  'KindAenderung'
);

/** One `CHILD_CHANGE` for the page that provides it. */
export function provideChildChange(): Provider {
  return { provide: CHILD_CHANGE, useFactory: selectionChange };
}
