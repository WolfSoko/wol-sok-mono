export type ConsentChoice = 'granted' | 'denied';

/** Asks for analytics consent again; provided only where analytics runs. */
export abstract class ConsentPrompt {
  public abstract ask(): void;
}
