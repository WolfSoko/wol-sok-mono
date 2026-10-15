import { InjectionToken, Provider } from '@angular/core';

/** What gets shared. Every target receives the same content. */
export type ShareContent = {
  readonly url: string;
  readonly title: string;
  readonly text: string;
};

/** A Material Symbols ligature, or SVG markup for brand logos. */
export type ShareIcon =
  | { readonly kind: 'font'; readonly name: string }
  | { readonly kind: 'svg'; readonly svg: string };

/**
 * One place a poll can be shared to (WhatsApp, Teams, mail, ...).
 *
 * A target only builds a link. The browser opens it, so a target needs no SDK
 * or API key and can be rendered on the server. See docs/adr/0001.
 */
export interface ShareTarget {
  /** Stable and unique, used in test ids and icon names. */
  readonly id: string;
  readonly label: string;
  readonly icon: ShareIcon;
  shareUrl(content: ShareContent): string;
}

/** All registered targets, in the order they are offered. */
export const SHARE_TARGETS = new InjectionToken<readonly ShareTarget[]>(
  'SHARE_TARGETS'
);

export function provideShareTargets(...targets: ShareTarget[]): Provider[] {
  return targets.map((target) => ({
    provide: SHARE_TARGETS,
    useValue: target,
    multi: true,
  }));
}
