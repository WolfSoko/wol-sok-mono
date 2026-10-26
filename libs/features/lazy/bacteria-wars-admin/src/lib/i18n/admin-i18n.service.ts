import { inject, Injectable, Pipe, PipeTransform } from '@angular/core';
import {
  type Dictionary,
  type EntryPath,
  I18nService,
  type Language,
  translate,
  type TranslationParams,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import type { HideReason } from '../moderation/admin-records';
import { DE } from './de';
import { EN } from './en';

/** The dotted path of an admin text, such as `'overview.refresh'`. */
export type AdminTextKey = EntryPath<typeof EN>;

const DICTIONARIES: Readonly<Record<Language, Dictionary>> = { en: EN, de: DE };

/**
 * The admin area's texts, in the language the game speaks (its
 * `I18nService`), from the admin's own dictionaries - so none of them
 * lands in the game's chunk.
 */
@Injectable({ providedIn: 'root' })
export class AdminI18n {
  private readonly i18n = inject(I18nService);

  /** The locale for dates and numbers, such as `'de-DE'`. */
  public readonly locale = this.i18n.locale;

  /** A count, grouped for the locale. */
  public number(value: number): string {
    return value.toLocaleString(this.locale());
  }

  /** A moment, as date and time for the locale - in UTC with `utc`. */
  public dateTime(millis: number, { utc = false } = {}): string {
    return new Intl.DateTimeFormat(this.locale(), {
      dateStyle: 'short',
      timeStyle: 'short',
      ...(utc ? { timeZone: 'UTC' } : {}),
    }).format(millis);
  }

  /** Why an entry is hidden, such as "owner, ban". */
  public hideReasons(reasons: readonly HideReason[]): string {
    return reasons.map((reason) => this.t(`hidden.${reason}`)).join(', ');
  }

  public t(key: AdminTextKey, params?: TranslationParams): string {
    return translate(
      DICTIONARIES[this.i18n.language()],
      EN,
      key,
      this.locale(),
      params
    );
  }
}

/** `{{ 'overview.refresh' | adminT }}` - follows a language switch. */
@Pipe({ name: 'adminT', pure: false })
export class AdminTextPipe implements PipeTransform {
  private readonly i18n = inject(AdminI18n);

  public transform(key: AdminTextKey, params?: TranslationParams): string {
    return this.i18n.t(key, params);
  }
}
