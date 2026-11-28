import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AceEditorDirective } from 'ngx-ace-editor-wrapper';
import { CodeEditorComponent } from './code-editor.component';

@Component({
  imports: [CodeEditorComponent],
  template: `
    <ws-shared-ui-code-editor
      [code]="code()"
      [codeTitle]="title()"
      [changeDebounceMs]="debounceMs()"
      [minLines]="30"
      (codeChange)="changes.push($event)"
    />
  `,
})
class HostComponent {
  public readonly code = signal('void main() {}');
  public readonly title = signal<string | undefined>(undefined);
  public readonly debounceMs = signal(0);
  public readonly changes: string[] = [];
}

describe('CodeEditorComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  /** Ace's editor behind the directive */
  function ace() {
    return fixture.debugElement
      .query(By.directive(AceEditorDirective))
      .injector.get(AceEditorDirective).aceEditor;
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('shows the code in GLSL, at least minLines tall', () => {
    expect(ace().getValue()).toBe('void main() {}');
    expect(ace().getSession().getMode().$id).toBe('ace/mode/glsl');
    expect(ace().getOption('minLines')).toBe(30);
  });

  it('emits a typed edit at once with a debounce of 0', () => {
    ace().navigateFileEnd();
    ace().insert('\n// edited');
    expect(fixture.componentInstance.changes).toEqual([
      'void main() {}\n// edited',
    ]);
  });

  it('shows new code from outside, ending on that code', async () => {
    fixture.componentInstance.code.set('// new');
    await fixture.whenStable();
    expect(ace().getValue()).toBe('// new');
    // Ace reports a replaced text as a removal and an insertion
    expect(fixture.componentInstance.changes.at(-1)).toBe('// new');
  });

  it('loads on its own: brace first, then its GLSL mode', async () => {
    const page = globalThis as { ace?: unknown };
    const loadedAce = page.ace;
    delete page.ace;
    try {
      await jest.isolateModulesAsync(async () => {
        await import('./code-editor.component');
      });
      expect(page.ace).toBeDefined();
    } finally {
      page.ace = loadedAce;
    }
  });

  it('sends an edit still waiting for the old debounce at once when the debounce changes', () => {
    // whenStable waits on timers, which are fake here
    jest.useFakeTimers();
    try {
      fixture.componentInstance.debounceMs.set(1000);
      fixture.detectChanges();
      ace().navigateFileEnd();
      ace().insert(' // A');

      fixture.componentInstance.debounceMs.set(0);
      fixture.detectChanges();
      ace().insert(' // B');
      jest.advanceTimersByTime(1000);

      // A arrives once, before the newer B, never after it
      expect(fixture.componentInstance.changes).toEqual([
        'void main() {} // A',
        'void main() {} // A // B',
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows a title only when it has one', async () => {
    const title = () => fixture.nativeElement.querySelector('.title');
    expect(title()).toBeNull();
    fixture.componentInstance.title.set('Fragment');
    await fixture.whenStable();
    expect(title().textContent.trim()).toBe('Fragment');
  });
});
