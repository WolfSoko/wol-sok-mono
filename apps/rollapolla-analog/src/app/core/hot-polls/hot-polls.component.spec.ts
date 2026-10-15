import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { PollsRepoAdapterMock } from '../../adapter/polls-repo-adapter-mock.service';
import { PollsRepoPort } from '../../ports/polls-repo.port';
import { HotPollsComponent } from './hot-polls.component';

describe('HotPollsComponent', () => {
  let repo: PollsRepoAdapterMock;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HotPollsComponent],
      providers: [
        provideRouter([]),
        { provide: PollsRepoPort, useClass: PollsRepoAdapterMock },
      ],
    });
    repo = TestBed.inject(PollsRepoPort) as PollsRepoAdapterMock;
  });

  async function render() {
    const fixture = TestBed.createComponent(HotPollsComponent);
    await fixture.whenStable();
    return fixture.debugElement;
  }

  it('ranks the listed polls by votes and leaves out unlisted ones', async () => {
    const calm = await repo.createPoll({
      question: 'Calm poll?',
      options: ['a', 'b'],
      listed: true,
    });
    const hot = await repo.createPoll({
      question: 'Hot poll?',
      options: ['a', 'b'],
      listed: true,
    });
    await repo.createPoll({ question: 'Private poll?', options: ['a', 'b'] });
    await repo.vote(repo.polls()[hot], 1);

    const element = await render();

    const links = element.queryAll(By.css('[data-testid^="hot-poll-"]'));
    expect(links.map((link) => link.nativeElement.textContent)).toEqual([
      expect.stringContaining('Hot poll?'),
      expect.stringContaining('Calm poll?'),
    ]);
    expect(links[1].nativeElement.getAttribute('href')).toBe(`/poll/${calm}`);
  });

  it('invites to create one when there are none', async () => {
    const element = await render();

    expect(
      element.query(By.css('[data-testid="hot-polls-empty"]'))
    ).not.toBeNull();
  });

  it('still links to all polls when loading fails', async () => {
    vi.spyOn(repo, 'watchHotPolls').mockReturnValue(
      throwError(() => new Error('failed-precondition'))
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const element = await render();

    expect(element.query(By.css('a[href="/polls"]'))).not.toBeNull();
    expect(element.query(By.css('mat-spinner'))).toBeNull();
  });
});
