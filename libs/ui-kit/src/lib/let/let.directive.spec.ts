import { createDirectiveFactory } from '@ngneat/spectator/jest';
import { Subject } from 'rxjs';
import { LetDirective } from './let.directive';

describe('LetDirective', () => {
  const createDirective = createDirectiveFactory(LetDirective);

  it('should make the "as" variable available in the context', () => {
    const spectator = createDirective(
      `<div *wsLet="true as testReference"><span class="use-value">{{testReference}}</span></div>`
    );
    const span = spectator.query('span.use-value');
    expect(span?.textContent).toContain('true');
  });

  it(`should use let to assign the variable, renders als falsy values`, () => {
    const spectator = createDirective(
      `<div *wsLet="false; let testReference;"><span class="use-value">{{testReference}}</span></div>`
    );
    const span = spectator.query('span.use-value');
    expect(span?.textContent).toContain('false');
  });

  it('should provide the values in stream with async pipe', () => {
    const testSubject = new Subject();
    const spectator = createDirective(
      `
<div *wsLet="test$ | async as testReference">
  <span class="use-value">{{testReference}}</span>
</div>
`,
      { hostProps: { test$: testSubject.asObservable() } }
    );
    const span = spectator.query('span.use-value');
    expect(span?.textContent).toContain('');

    testSubject.next('firstEmission');
    spectator.detectChanges();
    expect(span?.textContent).toContain('firstEmission');

    testSubject.next('secondEmission');
    spectator.detectChanges();
    expect(span?.textContent).toContain('secondEmission');

    testSubject.complete();
    spectator.detectChanges();
    expect(span?.textContent).toContain('secondEmission');
  });
});
