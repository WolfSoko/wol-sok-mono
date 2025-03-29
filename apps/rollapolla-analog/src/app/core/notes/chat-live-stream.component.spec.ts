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

  function createComponent(): void {
    fixture = TestBed.createComponent(ChatLiveStreamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
});
