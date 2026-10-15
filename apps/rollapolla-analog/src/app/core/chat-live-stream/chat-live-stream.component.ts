import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { isGoogleAccount } from '../../../shared/account';
import { ChatMessage } from '../../../shared/chat.message';
import { AccountPort, SignInCancelled } from '../../ports/account.port';
import { ChatMessagesRepoPort } from '../../ports/chat-messages-repo.port';
import { ChatMessageFormComponent } from './chat-message-form.component';
import { MessagesListComponent } from './messages-list.component';

@Component({
  selector: 'rap-chat-live-stream',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MessagesListComponent,
    ChatMessageFormComponent,
  ],
  templateUrl: './chat-live-stream.component.html',
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1.5rem;
      align-items: start;

      @media (min-width: 900px) {
        grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      }
    }
    mat-card {
      padding: 0.75rem 0.5rem 0.5rem;
    }
    .content {
      padding-top: 1rem;
    }
    .sign-in {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
      padding: 0.5rem 0.25rem 0.25rem;

      p {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }
    }
    .error {
      color: var(--mat-form-field-error-text-color, #ffb4ab);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatLiveStreamComponent {
  readonly minLength: Signal<number> = signal(
    ChatMessagesRepoPort.MIN_MESSAGE_LENGTH
  ).asReadonly();
  readonly maxLength: Signal<number> = signal(
    ChatMessagesRepoPort.MAX_MESSAGE_LENGTH
  ).asReadonly();

  private readonly chatMessagesRepo = inject(ChatMessagesRepoPort);
  private readonly accountPort = inject(AccountPort);

  chatMessages: Signal<ChatMessage[] | undefined> =
    this.chatMessagesRepo.getChatMessages();

  private readonly account = toSignal(this.accountPort.account$, {
    initialValue: null,
  });
  /** Only a visitor signed in with Google may post; everyone can read. */
  protected readonly canChat = computed(() => isGoogleAccount(this.account()));
  protected readonly signingIn = signal(false);
  protected readonly signInFailed = signal(false);
  protected readonly postFailed = signal(false);

  public addChatMessage(message: string): void {
    this.postFailed.set(false);
    // Not awaited: Firestore shows the message locally right away and resolves
    // only once the backend acknowledged it.
    this.chatMessagesRepo.addChatMessage(message.trim()).catch((error) => {
      console.error('Could not send message', error);
      this.postFailed.set(true);
    });
  }

  protected async signIn(): Promise<void> {
    this.signingIn.set(true);
    this.signInFailed.set(false);
    try {
      await this.accountPort.signInWithGoogle();
    } catch (error) {
      if (!(error instanceof SignInCancelled)) {
        console.error('Sign-in failed', error);
        this.signInFailed.set(true);
      }
    } finally {
      this.signingIn.set(false);
    }
  }
}
