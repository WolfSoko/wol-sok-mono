import { TestBed } from '@angular/core/testing';
import { By, Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RESPONSE, ServerResponse } from '@analogjs/router/tokens';
import NotFoundPageComponent from './[...not-found].page';

describe('NotFoundPageComponent', () => {
  const response = { statusCode: 200, headersSent: false };

  beforeEach(() => {
    response.statusCode = 200;
    TestBed.configureTestingModule({
      imports: [NotFoundPageComponent],
      providers: [
        provideRouter([]),
        { provide: RESPONSE, useValue: response as unknown as ServerResponse },
      ],
    });
  });

  it('says the page does not exist, answers 404 and stays out of search indexes', () => {
    const fixture = TestBed.createComponent(NotFoundPageComponent);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="page-not-found"]'))
    ).not.toBeNull();
    expect(response.statusCode).toBe(404);
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Page not found | RollaPolla'
    );
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe(
      'noindex'
    );
  });
});
