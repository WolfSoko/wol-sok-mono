import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  Signal,
  signal,
} from '@angular/core';
import { readStored, writeStored } from '../stored-choice';
import {
  detectLanguage,
  isLanguage,
  Language,
  LOCALES,
  Localized,
} from './language';
import { de } from './texts.de';
import { en } from './texts.en';
import { fill, TranslationParams } from './translation';

/** The texts of the site in one language, keyed like {@link en}. */
export type Texts = typeof en;

const TEXTS: Localized<Texts> = { en, de };

/** Where the visitor's choice is kept between visits. */
export const LANGUAGE_STORAGE_KEY = 'wolsok.language';

/**
 * The language the site speaks, switched at runtime: the visitor's choice,
 * kept in `localStorage`, or the browser's preferred language while there
 * is none. The pages are prerendered in English; a German browser switches
 * right after hydration.
 *
 * Templates read {@link texts} (`t().home.title`), so a switch re-renders
 * every text, and {@link pick} takes the entry of a {@link Localized}.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  private readonly chosen = signal<Language | null>(this.stored());
  private readonly detected: Language = isPlatformBrowser(inject(PLATFORM_ID))
    ? detectLanguage(this.document.defaultView?.navigator.languages ?? [])
    : 'en';

  /** The language the site speaks. */
  public readonly language: Signal<Language> = computed(
    () => this.chosen() ?? this.detected
  );
  /** The locale for `Intl` number and date formatting, such as `'de-DE'`. */
  public readonly locale: Signal<string> = computed(
    () => LOCALES[this.language()]
  );
  /** The site's texts in the active language. */
  public readonly texts: Signal<Texts> = computed(() => TEXTS[this.language()]);

  public constructor() {
    effect(() => {
      this.document.documentElement.lang = this.language();
    });
  }

  /** Speaks a language from now on, on this device. */
  public setLanguage(language: Language): void {
    this.chosen.set(language);
    writeStored(LANGUAGE_STORAGE_KEY, language);
  }

  /** The entry of a localized value in the active language. */
  public pick<T>(localized: Localized<T>): T {
    return localized[this.language()];
  }

  /** A text with its `{name}` placeholders filled, formatted for the locale. */
  public fill(text: string, params: TranslationParams): string {
    return fill(text, this.locale(), params);
  }

  private stored(): Language | null {
    const value = readStored(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : null;
  }
}
