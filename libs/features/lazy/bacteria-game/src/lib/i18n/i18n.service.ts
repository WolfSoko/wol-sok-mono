import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { DICTIONARIES, EN, TranslationKey } from './dictionaries';
import { detectLanguage, Language, LOCALES } from './language';
import { translate, TranslationParams } from './translation';

/**
 * The language the game speaks, switched at runtime: the player's choice,
 * or the browser's preferred language while there is none. Reading
 * {@link t} inside a template, a `computed` or an `effect` follows a switch.
 *
 * It keeps the choice only in memory and depends on nothing else, so any
 * service can inject it. The settings screen picks the language through
 * `GameSettingsService.setLanguage`, which also stores it on the device and
 * sets it here again on the next visit.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly detected = detectLanguage(
    inject(DOCUMENT).defaultView?.navigator.languages ?? []
  );
  private readonly chosen = signal<Language | null>(null);

  /** The player's choice, null to follow the browser. */
  public readonly choice: Signal<Language | null> = this.chosen.asReadonly();
  /** The language the game speaks. */
  public readonly language = computed(() => this.chosen() ?? this.detected);
  /** The locale for `Intl` number and date formatting, such as `'de-DE'`. */
  public readonly locale = computed(() => LOCALES[this.language()]);

  /** Speaks a language from now on, or follows the browser again for null. */
  public setLanguage(language: Language | null): void {
    this.chosen.set(language);
  }

  /**
   * The text at `key` in the active language, its placeholders filled from
   * `params` and the plural form picked by `params.count` - the English
   * text where the language lacks it.
   */
  public t(key: TranslationKey, params?: TranslationParams): string {
    return translate(
      DICTIONARIES[this.language()],
      EN,
      key,
      this.locale(),
      params
    );
  }
}
