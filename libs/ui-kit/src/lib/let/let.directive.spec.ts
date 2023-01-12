import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import * as webpack from 'webpack';
import { LetDirective } from './let.directive';

describe('LetDirective', () => {
  it('should make the "as" variable available in the context', () => {
    const spectator = createDirective(
      `<div *wsLet='true as testReference'><span class='use-value'>{{testReference}}</span></div>`
    );
    const span = spectator.query('span.use-value');
    expect(span?.textContent).toContain('true');
  });

  it(`should use let to assign the variable, renders also falsy values`, () => {
    const spectator = createDirective(
      `<div *wsLet='false; let testReference;'><span class='use-value'>{{testReference}}</span></div>`
    );
    const span = spectator.query('span.use-value');
    expect(span?.textContent).toContain('false');
  });

  it('should provide the values in stream with async pipe', fakeAsync(() => {
    const testSubject = new Subject<{ emission: number }>();
    const spectator = createDirective(
      `
<div *wsLet='(test$ | async) as testReference'>
  <span class='use-value'>emission:{{testReference?.emission ?? 'undefined'}}</span>
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

  function createDirective(template: string, { hostProps }: { hostProps?: Record<string, any> } = { hostProps: {} }) {
    @Component({
      template,
      standalone: true,
      imports: [LetDirective, AsyncPipe],
    })
    class DirectiveHostComponent implements Record<string, any> {
      [key: string]: any;

      constructor() {
        for (const key in hostProps) {
          this[key] = hostProps[key];
        }
      }
    }

    TestBed.configureTestingModule({
      imports: [DirectiveHostComponent],
    }).compileComponents();

    const fixture: ComponentFixture<DirectiveHostComponent> = TestBed.createComponent(DirectiveHostComponent);
    fixture.detectChanges();
    return {
      fixture: fixture,
      component: fixture.componentInstance,
      query: (css: string) => fixture.debugElement.query(By.css(css)).nativeElement,
      detectChanges: () => fixture.detectChanges(),
    };
  }
});
