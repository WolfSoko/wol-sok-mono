import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ChatMessage } from '../../../shared/chat.message';
import { AccountAdapterMock } from '../../adapter/account-adapter-mock.service';
import { ChatMessageRepoAdapterMock } from '../../adapter/chat-message-repo-adapter-mock.service';
import { AccountPort, SignInCancelled } from '../../ports/account.port';
import { ChatMessagesRepoPort } from '../../ports/chat-messages-repo.port';
import { ChatLiveStreamComponent } from './chat-live-stream.component';

describe('ChatLiveStreamComponent', () => {
  let component: ChatLiveStreamComponent;
  let fixture: ComponentFixture<ChatLiveStreamComponent>;
  let account: AccountAdapterMock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatLiveStreamComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ChatMessagesRepoPort,
          useClass: ChatMessageRepoAdapterMock,
        },
        { provide: AccountPort, useClass: AccountAdapterMock },
      ],
    }).compileComponents();
    account = TestBed.inject(AccountPort) as AccountAdapterMock;
    createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show list of chatMessages', async () => {
    vi.spyOn(
      TestBed.inject(ChatMessagesRepoPort),
      'getChatMessages'
    ).mockReturnValue(
      signal<ChatMessage[]>([
        {
          id: '1',
          message: 'What a nice poll!',
          createdAt: new Date(),
        },
      ])
    );
    createComponent();

    const messageElement = query('message-item-1');
    expect(messageElement.nativeElement.textContent).toEqual(
      'What a nice poll!'
    );
  });

  describe('who may chat', () => {
    it('asks a guest to sign in instead of showing the form', () => {
      expect(query('chat-sign-in')).not.toBeNull();
      expect(query('message-input')).toBeNull();
    });

    it('asks an anonymous visitor to sign in as well', async () => {
      account.accountSubject.next({
        uid: 'anon',
        isAnonymous: true,
        displayName: null,
        photoUrl: null,
      });
      await fixture.whenStable();

      expect(query('chat-sign-in')).not.toBeNull();
      expect(query('message-input')).toBeNull();
    });

    it('shows the form once signed in with Google', async () => {
      query('chat-sign-in-button').nativeElement.click();
      await fixture.whenStable();

      expect(query('message-input')).not.toBeNull();
      expect(query('chat-sign-in')).toBeNull();
    });

    it('hides the form again after signing out', async () => {
      await account.signInWithGoogle();
      await fixture.whenStable();
      await account.signOut();
      await fixture.whenStable();

      expect(query('message-input')).toBeNull();
      expect(query('chat-sign-in')).not.toBeNull();
    });

    it('stays quiet when the visitor closes the popup', async () => {
      vi.spyOn(account, 'signInWithGoogle').mockRejectedValueOnce(
        new SignInCancelled()
      );
      query('chat-sign-in-button').nativeElement.click();
      await fixture.whenStable();

      expect(query('chat-sign-in-error')).toBeNull();
      expect(query('chat-sign-in-button').nativeElement.disabled).toBe(false);
    });

    it('shows an error when signing in fails', async () => {
      vi.spyOn(account, 'signInWithGoogle').mockRejectedValueOnce(
        new Error('auth/unauthorized-domain')
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      query('chat-sign-in-button').nativeElement.click();
      await fixture.whenStable();

      expect(query('chat-sign-in-error')).not.toBeNull();
    });
  });

  it('posts the message of a signed-in visitor', async () => {
    const repo = TestBed.inject(ChatMessagesRepoPort);
    vi.spyOn(repo, 'addChatMessage');
    await account.signInWithGoogle();
    await fixture.whenStable();

    component.addChatMessage('  What a nice poll!  ');

    expect(repo.addChatMessage).toHaveBeenCalledWith('What a nice poll!');
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ChatLiveStreamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }
});
