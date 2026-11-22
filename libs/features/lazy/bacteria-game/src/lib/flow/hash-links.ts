import { EMPTY, fromEvent, merge, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

/**
 * The links that open the game, as their hash: the one the page was opened
 * with, then each later one. A link into the running game - the Android
 * app, an installed PWA's window, an open tab - only changes the hash: no
 * new start reads it. The game's own drop (`dropHash`) replaces the state
 * and fires none. The router syncs with the new address in a task of its
 * own, queued at the popstate before the hashchange; the link is read a
 * task later, so a drop replaces the router's navigation rather than being
 * undone by it.
 */
export function hashLinks(document: Document): Observable<string> {
  const view = document.defaultView;
  const later =
    view === null ? EMPTY : fromEvent(view, 'hashchange').pipe(delay(0));
  return merge(of(null), later).pipe(map(() => document.location.hash));
}
