import { TestBed } from '@angular/core/testing';
import { By, Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RESPONSE, ServerResponse } from '@analogjs/router/tokens';
import NotFoundPageComponent from './[...not-found].page';

describe('NotFoundPageComponent', () => {
  const response = { statusCode: 200, headersSent: false };

  beforeEach(() => {
    response.statusCode = 200;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: NotFoundPageComponent }]),
        { provide: RESPONSE, useValue: response as unknown as ServerResponse },
      ],
    });
  });

  it('says the page does not exist, answers 404 and stays out of search indexes', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/no/such/page?ref=x');
    const meta = TestBed.inject(Meta);

    expect(
      harness.fixture.debugElement.query(
        By.css('[data-testid="page-not-found"]')
      )
    ).not.toBeNull();
    expect(response.statusCode).toBe(404);
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Page not found | RollaPolla'
    );
    expect(meta.getTag('name="robots"')?.content).toBe('noindex');
    // its own URL, not the home page's
    expect(meta.getTag('property="og:url"')?.content).toBe(
      'https://rollapolla.com/no/such/page'
    );
  });
});
