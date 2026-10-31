import { Signal, signal } from '@angular/core';
import { PostReceipt } from '../../ports/chat-messages-repo.port';

/**
 * Posts chat messages and tells whether one failed: at once (e.g. signing in
 * failed) or later, when the backend refuses a message that was already
 * shown. A late refusal still counts after newer posts: that message
 * vanished, and the visitor should know.
 */
export class PostTracker {
  private readonly failedSignal = signal(false);
  public readonly failed: Signal<boolean> = this.failedSignal.asReadonly();

  /** True when the message went out (the backend may still refuse it). */
  public async post(send: () => Promise<PostReceipt>): Promise<boolean> {
    this.failedSignal.set(false);
    try {
      const { saved } = await send();
      saved.catch((error: unknown) => {
        console.error('Chat message was rejected', error);
        this.failedSignal.set(true);
      });
      return true;
    } catch (error) {
      console.error('Could not post chat message', error);
      this.failedSignal.set(true);
      return false;
    }
  }
}
