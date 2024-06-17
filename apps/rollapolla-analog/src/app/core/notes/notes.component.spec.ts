import {
  provideExperimentalZonelessChangeDetection,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Note } from '../../../shared/note';
import { NotesRepoAdapterMock } from '../../adapter/notes-repo.adapter.mock';
import { NotesRepoPort } from '../../ports/notes-repo.port';
import { NotesComponent } from './notes.component';

describe('NotesComponent', () => {
  let component: NotesComponent;
  let fixture: ComponentFixture<NotesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotesComponent, NoopAnimationsModule],
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: NotesRepoPort, useClass: NotesRepoAdapterMock },
      ],
    }).compileComponents();
    createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show list of notes', async () => {
    vi.spyOn(TestBed.inject(NotesRepoPort), 'getNotes').mockReturnValue(
      signal<Note[]>([
        {
          id: '1',
          note: 'What a nice poll!',
          createdAt: new Date(),
        },
      ])
    );
    createComponent();
    expect(
      fixture.debugElement.query(By.css('[data-testid="note-note"]'))
        .nativeElement.textContent
    ).toEqual('What a nice poll!');
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(NotesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
});
