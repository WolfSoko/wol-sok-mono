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
      [changeDebounceMs]="0"
      [minLines]="30"
      (codeChange)="changes.push($event)"
    />
  `,
})
class HostComponent {
  public readonly code = signal('void main() {}');
  public readonly title = signal<string | undefined>(undefined);
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

  it('shows a title only when it has one', async () => {
    const title = () => fixture.nativeElement.querySelector('.title');
    expect(title()).toBeNull();
    fixture.componentInstance.title.set('Fragment');
    await fixture.whenStable();
    expect(title().textContent.trim()).toBe('Fragment');
  });
});
