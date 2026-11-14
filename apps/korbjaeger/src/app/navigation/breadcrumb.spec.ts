import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Breadcrumb, breadcrumb, type Level, ROOT_LEVEL } from './breadcrumb';

const title = signal('Team');

@Component({ template: '' })
class TeamPage {
  public constructor() {
    breadcrumb(() => [{ title: title() }]);
  }
}

@Component({ template: '' })
class GamePage {
  public constructor() {
    breadcrumb(() => [
      { title: 'MTV Wasbüttel', link: ['/team', '1'] },
      { title: 'Spiel' },
    ]);
  }
}

function titles(levels: readonly Level[]): string[] {
  return levels.map((level) => level.title);
}

describe('Breadcrumb', () => {
  let service: Breadcrumb;

  beforeEach(() => {
    title.set('Team');
    service = TestBed.inject(Breadcrumb);
  });

  it('holds only the overview, with nowhere up, while no page declares levels', () => {
    expect(service.levels()).toEqual([ROOT_LEVEL]);
    expect(service.parentLink()).toBeUndefined();
  });

  it("shows a page's levels below the root while the page lives", () => {
    const page = TestBed.createComponent(GamePage);

    expect(titles(service.levels())).toEqual([
      'Korbjäger',
      'MTV Wasbüttel',
      'Spiel',
    ]);
    expect(service.parentLink()).toEqual(['/team', '1']);

    page.destroy();
    expect(service.levels()).toEqual([ROOT_LEVEL]);
  });

  it('leads up to the overview from a page right below it', () => {
    TestBed.createComponent(TeamPage);

    expect(service.parentLink()).toEqual(['/']);
  });

  it("follows what the page reads later, such as the Team's name", () => {
    TestBed.createComponent(TeamPage);

    title.set('MTV Wasbüttel U12');

    expect(titles(service.levels())).toEqual([
      'Korbjäger',
      'MTV Wasbüttel U12',
    ]);
  });

  it("keeps the next page's levels when the previous page goes after it came", () => {
    const team = TestBed.createComponent(TeamPage);
    TestBed.createComponent(GamePage);

    team.destroy();

    expect(titles(service.levels()).at(-1)).toBe('Spiel');
  });
});
