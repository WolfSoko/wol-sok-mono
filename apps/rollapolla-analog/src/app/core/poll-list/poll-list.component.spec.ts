import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideRecordingAnalytics,
  RecordingAnalytics,
} from '@wolsok/shared-analytics/testing';
import { Poll } from '../../../shared/poll';
import { PollListComponent } from './poll-list.component';

function poll(id: string): Poll {
  return {
    id,
    question: `Question ${id}?`,
    options: ['Yes', 'No'],
    counts: [0, 0],
    totalVotes: 0,
    createdAt: new Date('2026-10-01'),
    closesAt: new Date('2026-10-31'),
    creatorUid: 'creator',
    listed: true,
    round: 0,
  };
}

describe('PollListComponent', () => {
  it('counts which poll of which list was opened, without the poll', async () => {
    const analytics = new RecordingAnalytics();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'poll/:pollId', children: [] }]),
        provideRecordingAnalytics(analytics),
      ],
    });
    const fixture = TestBed.createComponent(PollListComponent);
    fixture.componentRef.setInput('polls', [poll('a'), poll('b')]);
    fixture.componentRef.setInput('list', 'hot');
    await fixture.whenStable();

    const link = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('[data-testid="poll-link-b"]');
    link?.click();
    await fixture.whenStable();

    expect(analytics.events).toEqual([
      {
        name: 'select_content',
        params: { content_type: 'poll', list: 'hot', position: 1 },
      },
    ]);
  });
});
