import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Poll, PRIVATE_POLL_HINT } from '../../../shared/poll';
import { ShareComponent } from '../share/share.component';
import { PollShareComponent } from './poll-share.component';

const poll: Poll = {
  id: 'poll-1',
  question: 'Pizza or pasta?',
  options: ['Pizza', 'Pasta'],
  counts: [0, 0],
  totalVotes: 0,
  createdAt: new Date(),
  closesAt: new Date(Date.now() + 24 * 3600_000),
  creatorUid: 'creator',
  listed: true,
  round: 0,
};

describe('PollShareComponent', () => {
  let fixture: ComponentFixture<PollShareComponent>;
  const pollUrl = `${location.origin}/poll/poll-1`;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PollShareComponent],
    });
    fixture = TestBed.createComponent(PollShareComponent);
    fixture.componentRef.setInput('poll', poll);
    await fixture.whenStable();
  });

  it('shares the poll link with its question', () => {
    expect(share().content()).toEqual({
      url: pollUrl,
      title: 'Pizza or pasta?',
      text: 'Vote now: Pizza or pasta?',
    });
  });

  it('tells that only people with the link see a private poll', async () => {
    expect(query('poll-share-private')).toBeNull();

    fixture.componentRef.setInput('poll', { ...poll, listed: false });
    await fixture.whenStable();

    expect(query('poll-share-private').nativeElement.textContent).toContain(
      PRIVATE_POLL_HINT
    );
  });

  it('greets the creator when highlighted', async () => {
    expect(query('poll-ready')).toBeNull();
    expect(share().highlighted()).toBe(false);

    fixture.componentRef.setInput('highlighted', true);
    await fixture.whenStable();

    expect(query('poll-ready').nativeElement.textContent).toContain(
      'Your poll is ready'
    );
    expect(share().highlighted()).toBe(true);
  });

  function share(): ShareComponent {
    return fixture.debugElement.query(By.directive(ShareComponent))
      .componentInstance;
  }

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }
});
