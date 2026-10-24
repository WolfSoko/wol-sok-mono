import { Signal } from '@angular/core';

export type ConsentChoice = 'granted' | 'denied';

/**
 * The visitor's say over analytics, as the UI sees it. Provided only where
 * analytics runs (the browser in production), so the server bundle and the
 * other environments stay free of the analytics code.
 */
export abstract class ConsentPrompt {
  /** Whether the banner asking for consent is open. */
  public abstract readonly asking: Signal<boolean>;
  public abstract ask(): void;
  public abstract decide(choice: ConsentChoice): void;
}
