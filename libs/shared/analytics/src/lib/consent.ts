import { Signal } from '@angular/core';

export type ConsentChoice = 'granted' | 'denied';

/**
 * The visitor's say over analytics, as the UI sees it. Provided only where
 * analytics runs (`provideFirebaseAnalytics`), so components inject it
 * optionally and show nothing without it.
 */
export abstract class ConsentPrompt {
  /**
   * Whether a choice is due: none was made yet, or the visitor asked to
   * change it. The app decides where and when it asks.
   */
  public abstract readonly asking: Signal<boolean>;
  /** The choice in force, null while the visitor has made none. */
  public abstract readonly choice: Signal<ConsentChoice | null>;
  /** Asks again, so the visitor can change the choice. */
  public abstract ask(): void;
  public abstract decide(choice: ConsentChoice): void;
}
