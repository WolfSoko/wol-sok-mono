import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ChatMessage } from '../../../shared/chat.message';
import { ChatMessageRepoAdapterMock } from '../../adapter/chat-message-repo-adapter-mock.service';
import { ChatMessagesRepoPort } from '../../ports/chat-messages-repo.port';
import { ChatLiveStreamComponent } from './chat-live-stream.component';

describe('ChatLiveStreamComponent', () => {
  let component: ChatLiveStreamComponent;
  let fixture: ComponentFixture<ChatLiveStreamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatLiveStreamComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ChatMessagesRepoPort,
          useClass: ChatMessageRepoAdapterMock,
        },
      ],
    }).compileComponents();
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

  function createComponent(): void {
    fixture = TestBed.createComponent(ChatLiveStreamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
});
