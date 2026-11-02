import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appRoutes } from '../app.routes';
import { I18nService } from '../i18n/i18n.service';
import { CAREER, CAREER_PROJECTS, CAREER_SOURCE } from './career.data';
import { countClients, yearsSince } from './career.model';
import { personJsonLd } from './json-ld';

describe('career data', () => {
  it('lists the engagements newest first, each with both languages', () => {
    const ids = CAREER_PROJECTS.map((project) => project.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < CAREER_PROJECTS.length; i++) {
      expect(CAREER_PROJECTS[i].from).toBeLessThanOrEqual(
        CAREER_PROJECTS[i - 1].from
      );
    }
    for (const project of CAREER_PROJECTS) {
      expect(project.from).toBeLessThanOrEqual(project.to);
      expect(project.highlights.de.length).toBe(project.highlights.en.length);
      expect(project.highlights.en.length).toBeGreaterThan(0);
      expect(project.technologies.length).toBeGreaterThan(0);
      expect(project.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('starts with the first year of the career', () => {
    expect(CAREER_PROJECTS.at(-1)?.from).toBe(CAREER.profile.since);
    expect(yearsSince(2008, 2026)).toBe(18);
  });

  it('counts each client once and the thesis not at all', () => {
    const [a, b] = CAREER_PROJECTS;
    expect(
      countClients([
        { ...a, client: 'Same' },
        { ...b, client: 'Same' },
        { ...b, client: 'University', kind: 'thesis' },
      ])
    ).toBe(1);
  });

  it('links to real profiles', () => {
    for (const link of CAREER.profile.profiles) {
      expect(link.url).toMatch(/^https:\/\//);
    }
  });

  it('names the profile it was taken from, by date', () => {
    expect(CAREER_SOURCE.profileDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CAREER_SOURCE.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CAREER_SOURCE.fileName).toContain(CAREER_SOURCE.profileDate);
    expect(CAREER_SOURCE.checkedAt >= CAREER_SOURCE.profileDate).toBe(true);
  });

  it('keeps every localized list the same length in both languages', () => {
    const { profile } = CAREER;
    for (const list of [
      profile.education,
      profile.languages,
      profile.industries,
      profile.softSkills,
    ]) {
      expect(list.de.length).toBe(list.en.length);
    }
  });

  it('describes the person for search engines', () => {
    const data = JSON.parse(personJsonLd(CAREER, 'https://wolsok.de/career'));
    expect(data['@type']).toBe('Person');
    expect(data.name).toBe('Wolfram Sokollek');
    expect(data.alumniOf.name).toBe('HAW Hamburg');
    expect(data.address.addressLocality).toBe(CAREER.profile.city);
    expect(data.worksFor).toBeUndefined();
    expect(data.sameAs).toEqual(CAREER.profile.profiles.map((p) => p.url));
  });
});

describe('career page', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(appRoutes)] });
  });

  afterEach(() => {
    localStorage.clear();
    document.getElementById('career-json-ld')?.remove();
  });

  it('shows every engagement and switches the language', async () => {
    const harness = await RouterTestingHarness.create('/career');
    const element = harness.routeNativeElement as HTMLElement;
    for (const project of CAREER_PROJECTS) {
      expect(element.querySelector(`#${project.id}`)).not.toBeNull();
      expect(element.textContent).toContain(project.client);
    }
    expect(element.textContent).toContain('Full-stack software engineer');
    expect(element.textContent).toContain('Freelance since 2008');
    expect(element.textContent).not.toContain('2,008');
    expect(document.getElementById('career-json-ld')?.textContent).toContain(
      '"@type":"Person"'
    );

    TestBed.inject(I18nService).setLanguage('de');
    harness.detectChanges();
    expect(element.textContent).toContain('Fullstack Software Engineer');
    expect(element.textContent).toContain('Werkzeugkasten');
  });
});
