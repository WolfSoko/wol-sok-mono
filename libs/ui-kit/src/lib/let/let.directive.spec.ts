import { fakeAsync } from '@angular/core/testing';
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

  it(`should use let to assign the variable, renders also falsy values`, () => {
    const spectator = createDirective(
      `<div *wsLet="false; let testReference;"><span class="use-value">{{testReference}}</span></div>`
    );
    const span = spectator.query('span.use-value');
    expect(span?.textContent).toContain('false');
  });

  it('should provide the values in stream with async pipe', fakeAsync(() => {
    const testSubject = new Subject<{ emission: number }>();
    const spectator = createDirective(
      `
<div *wsLet="(test$ | async) as testReference">
  <span class="use-value">emission:{{testReference?.emission ?? 'undefined'}}</span>
</div>
`,
      { hostProps: { test$: testSubject.asObservable() } }
    );
    const span = spectator.query('span.use-value');
    expect(span?.textContent).toContain('emission:undefined');

    testSubject.next({ emission: 1 });
    spectator.detectChanges();
    spectator.query('span.use-value');
    expect(span?.textContent).toContain('emission:1');

    testSubject.next({ emission: 2 });
    spectator.detectChanges();
    spectator.query('span.use-value');
    expect(span?.textContent).toContain('emission:2');

    testSubject.complete();
    spectator.detectChanges();
    spectator.query('span.use-value');
    expect(span?.textContent).toContain('emission:2');
  }));
});
