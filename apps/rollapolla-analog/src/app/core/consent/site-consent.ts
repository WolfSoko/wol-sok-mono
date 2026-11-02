import { computed, inject, Injectable } from '@angular/core';
import { ConsentChoice, ConsentPrompt } from '@wolsok/shared-analytics';
import { AD_CONSENT } from './ad-consent';

/** What a visitor can agree to, each on its own. */
export type ConsentPurpose = 'statistics' | 'ads';

export type ConsentDecision = Readonly<Record<ConsentPurpose, boolean>>;

/**
 * Everything RollaPolla asks consent for - usage statistics (Google
 * Analytics) and ads (Google AdSense) - as the banner and the privacy page
 * see it. A purpose is there only where it runs (the browser in
 * production); without any, nothing asks.
 */
@Injectable({ providedIn: 'root' })
export class SiteConsent {
  private readonly prompts = promptsOf({
    statistics: inject(ConsentPrompt, { optional: true }) ?? undefined,
    ads: inject(AD_CONSENT, { optional: true }) ?? undefined,
  });

  public readonly purposes: readonly ConsentPurpose[] = [
    ...this.prompts.keys(),
  ];
  public readonly available = this.prompts.size > 0;
  /** Whether a choice is due for any purpose. */
  public readonly asking = computed(() =>
    [...this.prompts.values()].some((prompt) => prompt.asking())
  );
  /** The choices in force; a purpose not decided yet counts as refused. */
  public readonly granted = computed((): ConsentDecision => ({
    statistics: this.prompts.get('statistics')?.choice() === 'granted',
    ads: this.prompts.get('ads')?.choice() === 'granted',
  }));

  /** Asks again for every purpose, so the visitor can change their choices. */
  public ask(): void {
    this.prompts.forEach((prompt) => prompt.ask());
  }

  public decideAll(choice: ConsentChoice): void {
    this.prompts.forEach((prompt) => prompt.decide(choice));
  }

  public decide(decision: ConsentDecision): void {
    this.prompts.forEach((prompt, purpose) =>
      prompt.decide(decision[purpose] ? 'granted' : 'denied')
    );
  }
}

/** The purposes that run here, each with its prompt. */
function promptsOf(
  prompts: Partial<Record<ConsentPurpose, ConsentPrompt>>
): ReadonlyMap<ConsentPurpose, ConsentPrompt> {
  const running = new Map<ConsentPurpose, ConsentPrompt>();
  for (const purpose of ['statistics', 'ads'] as const) {
    const prompt = prompts[purpose];
    if (prompt) running.set(purpose, prompt);
  }
  return running;
}
