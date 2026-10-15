import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ChatMessage } from '../../../shared/chat.message';
import { AccountAdapterMock } from '../../adapter/account-adapter-mock.service';
import { ChatMessageRepoAdapterMock } from '../../adapter/chat-message-repo-adapter-mock.service';
import { AccountPort } from '../../ports/account.port';
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

  afterEach(() => {
    vi.restoreAllMocks();
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
      await signInWithGoogle();
      await account.signOut();
      await fixture.whenStable();

      expect(query('message-input')).toBeNull();
      expect(query('chat-sign-in')).not.toBeNull();
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

    const messageElement = fixture.debugElement.query(
      By.css('[data-testid="message-item-1"]')
    );
    expect(messageElement.nativeElement.textContent).toEqual(
      'What a nice poll!'
    );
  });

  it('shows who wrote a message, "Anonymous" without a name', () => {
    vi.spyOn(
      TestBed.inject(ChatMessagesRepoPort),
      'getChatMessages'
    ).mockReturnValue(
      signal<ChatMessage[]>([
        {
          id: '1',
          message: 'Signed in',
          createdAt: new Date(),
          authorName: 'Ada Lovelace',
        },
        {
          id: '2',
          message: 'Anonymous',
          createdAt: new Date(),
          authorName: null,
        },
        { id: '3', message: 'From before sign-in', createdAt: new Date() },
      ])
    );
    createComponent();

    const author = (id: string) =>
      fixture.debugElement
        .query(By.css(`[data-testid="message-author-${id}"]`))
        .nativeElement.textContent.trim();
    expect(author('1')).toBe('Ada Lovelace');
    expect(author('2')).toBe('Anonymous');
    expect(author('3')).toBe('Anonymous');
  });

  it('says so when a message cannot be posted', async () => {
    await signInWithGoogle();
    vi.spyOn(
      TestBed.inject(ChatMessagesRepoPort),
      'addChatMessage'
    ).mockRejectedValueOnce(new Error('auth/admin-restricted-operation'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    fixture.debugElement
      .query(By.css('rap-chat-message-form'))
      .triggerEventHandler('messageAdded', 'Hello there, everyone!');
    await fixture.whenStable();

    expect(
      fixture.debugElement.query(By.css('[data-testid="chat-error"]'))
    ).not.toBeNull();
  });

  it('says so when the backend rejects a posted message', async () => {
    await signInWithGoogle();
    // created right before the post: a rejected promise nobody handles for a
    // tick counts as an unhandled error
    vi.spyOn(
      TestBed.inject(ChatMessagesRepoPort),
      'addChatMessage'
    ).mockResolvedValueOnce({
      saved: Promise.reject(new Error('permission-denied')),
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    fixture.debugElement
      .query(By.css('rap-chat-message-form'))
      .triggerEventHandler('messageAdded', 'Hello there, everyone!');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="chat-error"]'))
    ).not.toBeNull();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ChatLiveStreamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function signInWithGoogle(): Promise<void> {
    await account.signInWithGoogle();
    await fixture.whenStable();
  }

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }
});
