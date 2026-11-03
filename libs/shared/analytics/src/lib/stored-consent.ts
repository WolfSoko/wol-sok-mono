import { signal } from '@angular/core';
import { ConsentChoice, ConsentPrompt } from './consent';
import { loadChoice, saveChoice } from './consent-storage';

/**
 * The visitor's consent to one purpose (usage statistics, ads), kept in
 * `localStorage` under `storageKey`. While none is stored it asks; each
 * choice, the restored one too, goes to `apply`.
 */
export class StoredConsent implements ConsentPrompt {
  private readonly askingState = signal(false);
  private readonly choiceState = signal<ConsentChoice | null>(null);

  public readonly asking = this.askingState.asReadonly();
  public readonly choice = this.choiceState.asReadonly();

  public constructor(
    private readonly storageKey: string,
    private readonly apply: (choice: ConsentChoice) => void
  ) {}

  /** Applies the choice made on an earlier visit, or asks for one. */
  public restore(): void {
    const choice = loadChoice(this.storageKey);
    if (choice === null) {
      this.ask();
    } else {
      this.take(choice);
    }
  }

  public ask(): void {
    this.askingState.set(true);
  }

  public decide(choice: ConsentChoice): void {
    this.askingState.set(false);
    saveChoice(this.storageKey, choice);
    this.take(choice);
  }

  private take(choice: ConsentChoice): void {
    this.choiceState.set(choice);
    this.apply(choice);
  }
}
