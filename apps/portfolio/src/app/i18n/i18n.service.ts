import { DOCUMENT } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  Signal,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
 * every text, and {@link language} picks the entry of a {@link Localized}.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly chosen = signal<Language | null>(this.stored());
  private readonly detected: Language = this.browser
    ? detectLanguage(this.document.defaultView?.navigator.languages ?? [])
    : 'en';

  /** The visitor's choice, null to follow the browser. */
  public readonly choice: Signal<Language | null> = this.chosen.asReadonly();
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

  /** Speaks a language from now on, or follows the browser again for null. */
  public setLanguage(language: Language | null): void {
    this.chosen.set(language);
    if (!this.browser) {
      return;
    }
    try {
      if (language) {
        this.document.defaultView?.localStorage.setItem(
          LANGUAGE_STORAGE_KEY,
          language
        );
      } else {
        this.document.defaultView?.localStorage.removeItem(
          LANGUAGE_STORAGE_KEY
        );
      }
    } catch {
      // private mode or storage blocked: the choice holds for this visit
    }
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
    if (!this.browser) {
      return null;
    }
    try {
      const value =
        this.document.defaultView?.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return isLanguage(value) ? value : null;
    } catch {
      return null;
    }
  }
}
