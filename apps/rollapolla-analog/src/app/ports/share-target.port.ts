import {
  EnvironmentProviders,
  inject,
  InjectionToken,
  Provider,
  provideEnvironmentInitializer,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

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

/** Namespace of the registered SVG icons: `share:<target id>`. */
export const SHARE_ICON_NAMESPACE = 'share';

/** Registers the targets and, once per app, their SVG icons. */
export function provideShareTargets(
  ...targets: ShareTarget[]
): (Provider | EnvironmentProviders)[] {
  return [
    ...targets.map((target) => ({
      provide: SHARE_TARGETS,
      useValue: target,
      multi: true,
    })),
    provideEnvironmentInitializer(() => {
      const registry = inject(MatIconRegistry);
      const sanitizer = inject(DomSanitizer);
      for (const { id, icon } of targets) {
        if (icon.kind === 'svg') {
          registry.addSvgIconLiteralInNamespace(
            SHARE_ICON_NAMESPACE,
            id,
            sanitizer.bypassSecurityTrustHtml(icon.svg)
          );
        }
      }
    }),
  ];
}
