import { signal } from '@angular/core';
import type { Selection } from '../lib/selection';

/**
 * An `Auswahl` for a spec that needs one to behave in a way no adapter
 * does (a change failing, nothing read yet): `teile` as given, the rest
 * with nothing followed or marked and every change resolving.
 */
export function fakeSelection(parts: Partial<Selection> = {}): Selection {
  return {
    teams: signal([]),
    children: signal([]),
    unreadable: signal(false),
    source: signal('fake'),
    follow: () => Promise.resolve(),
    unfollow: () => Promise.resolve(undefined),
    mark: () => Promise.resolve(),
    setNickname: () => Promise.resolve(),
    unmark: () => Promise.resolve(),
    clubColors: signal([]),
    setClubColors: () => Promise.resolve(),
    resetClubColors: () => Promise.resolve(),
    ...parts,
  };
}
