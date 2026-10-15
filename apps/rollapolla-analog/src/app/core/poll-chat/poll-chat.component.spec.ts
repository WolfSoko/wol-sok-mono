import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { throwError } from 'rxjs';
import {
  featuredPollDraft,
  FEATURED_POLLS,
} from '../../../shared/featured-polls';
import { Poll } from '../../../shared/poll';
import { ChatMessageRepoAdapterMock } from '../../adapter/chat-message-repo-adapter-mock.service';
import { ChatMessagesRepoPort } from '../../ports/chat-messages-repo.port';
import { PollChatComponent } from './poll-chat.component';

describe('PollChatComponent', () => {
  let fixture: ComponentFixture<PollChatComponent>;
  let repo: ChatMessageRepoAdapterMock;
  const poll: Poll = { ...featuredPollDraft(FEATURED_POLLS[0]), id: 'poll-1' };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PollChatComponent, NoopAnimationsModule],
      providers: [
        { provide: ChatMessagesRepoPort, useClass: ChatMessageRepoAdapterMock },
      ],
    });
    repo = TestBed.inject(ChatMessagesRepoPort) as ChatMessageRepoAdapterMock;
    fixture = TestBed.createComponent(PollChatComponent);
    fixture.componentRef.setInput('poll', poll);
    await fixture.whenStable();
  });

  it("posts into the poll's own thread and shows it", async () => {
    const addPollChatMessage = vi.spyOn(repo, 'addPollChatMessage');

    post('  Pineapple is a fruit, pizza is not.  ');
    await fixture.whenStable();

    expect(addPollChatMessage).toHaveBeenCalledWith(
      poll,
      'Pineapple is a fruit, pizza is not.'
    );
    expect(text('messages-list')).toContain(
      'Pineapple is a fruit, pizza is not.'
    );
  });

  it('shows only messages of this poll', async () => {
    repo.pollChats$.next({
      'other-poll': [
        { id: 'x', message: 'Somewhere else entirely', createdAt: new Date() },
      ],
    });
    await fixture.whenStable();

    expect(text('messages-list')).not.toContain('Somewhere else');
  });

  it('says so when the backend rejects a message', async () => {
    vi.spyOn(repo, 'addPollChatMessage').mockResolvedValueOnce({
      saved: Promise.reject(new Error('permission-denied')),
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    post('Hello there, everyone!');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('poll-chat-error')).not.toBeNull();
  });

  it('says so when the discussion cannot be loaded', async () => {
    vi.spyOn(repo, 'watchPollChat').mockReturnValue(
      throwError(() => new Error('permission-denied'))
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(PollChatComponent);
    fixture.componentRef.setInput('poll', poll);
    await fixture.whenStable();

    expect(query('poll-chat-load-error')).not.toBeNull();
  });

  it('takes no new messages once the poll closed', async () => {
    fixture.componentRef.setInput('poll', {
      ...poll,
      closesAt: new Date(Date.now() - 1000),
    });
    await fixture.whenStable();

    expect(
      fixture.debugElement.query(By.css('rap-chat-message-form'))
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('This poll is closed');
  });

  function post(message: string): void {
    fixture.debugElement
      .query(By.css('rap-chat-message-form'))
      .triggerEventHandler('messageAdded', message);
  }

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }

  function text(testId: string): string {
    return query(testId).nativeElement.textContent;
  }
});
