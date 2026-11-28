# Spec: portfolio (wolsok.de): more professional title, meta description and heading ([#3281](https://github.com/WolfSoko/wol-sok-mono/issues/3281))

## Goal

The start page of wolsok.de introduces its owner as what he is: a
professional software engineer and freelancer. Its tab and search title, its
meta description and its big heading say so, in English and German, while
the apps, experiments and open source below stay the proof of the work.

## Today

| Where                                                                                | Text (en / de)                                                                                                                                                                              |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title: `app.routes.ts` (home route `data.title`)                                     | "Wolfram Sokollek – Games, Apps & Web Experiments" / "Wolfram Sokollek – Spiele, Apps & Web-Experimente"                                                                                    |
| Description: `app.routes.ts` (`data.description`)                                    | "Portfolio of Wolfram Sokollek: Bacteria Wars, Movepath, Pacetrainer, RollaPolla and interactive Angular experiments with WebGL, shaders, TensorFlow.js and WebAssembly." / German likewise |
| `index.html`: `<title>`, `description`, `og:title`, `og:description`                 | the English texts above, copied by hand                                                                                                                                                     |
| Heading: `i18n/texts.*.ts` (`home.title` + `home.titleAccent`, the accent in `<em>`) | "Games, apps and wild experiments, _built for the web._" / "Spiele, Apps und wilde Experimente, _gebaut fürs Web._"                                                                         |

`SeoService` sets title, description and the Open Graph tags from the route
data for the active language. `index.html` holds the same English texts as
the page's start values, so the static HTML is right before the app runs;
nothing checks that the two copies agree.

## Wording options (the user picks one per row before the build)

Lengths are characters; search results show about 60 for a title and about
155 for a description.

### Title

| Option               | en                                                               | de                                                                  |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| **T1** (recommended) | Wolfram Sokollek – Freelance Full-Stack Software Engineer (57)   | Wolfram Sokollek – Freiberuflicher Fullstack Software Engineer (62) |
| T2                   | Wolfram Sokollek – Software Engineer for Angular & Web Apps (59) | Wolfram Sokollek – Software Engineer für Angular & Web-Apps (59)    |
| T3                   | Wolfram Sokollek – Freelance Software Engineer, Hamburg (55)     | Wolfram Sokollek – Freiberuflicher Software Engineer, Hamburg (61)  |

T1 uses the job title of the career profile (`CAREER_PROFILE.title`), so the
start page, `/career` and its `Person` JSON-LD name the same role.

### Meta description

| Option               | en                                                                                                                                                                    | de                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** (recommended) | Freelance full-stack software engineer in Hamburg since 2008: Angular web apps from idea to production, with live apps, games and open source to explore. (153)       | Freiberuflicher Fullstack Software Engineer in Hamburg seit 2008: Angular-Web-Apps von der Idee bis in Produktion, mit Live-Apps, Spielen und Open Source. (154)           |
| D2                   | Wolfram Sokollek builds web products as a freelance software engineer: architecture, Angular, tests, CI/CD and cloud. Live apps, experiments and open source. (157)   | Wolfram Sokollek entwickelt Webprodukte als freiberuflicher Software Engineer: Architektur, Angular, Tests, CI/CD und Cloud. Live-Apps, Experimente, Open Source. (161)    |
| D3                   | Portfolio of freelance software engineer Wolfram Sokollek: Angular apps in production (Bacteria Wars, Movepath, Pacetrainer, RollaPolla) and WebGL experiments. (159) | Portfolio des freiberuflichen Software Engineers Wolfram Sokollek: Angular-Apps im Einsatz (Bacteria Wars, Movepath, Pacetrainer, RollaPolla) und WebGL-Experimente. (164) |

D1 takes the year from `CAREER_SINCE`, as the career page's description
does. D3 keeps the app names for searches that look for them.

### Heading (plain part, _accent_)

| Option               | en                                                           | de                                                               |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| **H1** (recommended) | Software engineering for the web, _from idea to production._ | Software Engineering fürs Web, _von der Idee bis in Produktion._ |
| H2                   | Fast, reliable web apps, _engineered in Angular._            | Schnelle, verlässliche Web-Apps, _entwickelt mit Angular._       |
| H3                   | Web products that ship, _and keep running._                  | Webprodukte, die live gehen _und laufen._                        |

The heading stays two parts, so the accent keeps its `<em>` styling. The
career page's heading ("Full-stack software engineer, _Angular to the
core._") is not reused, so the two pages do not open the same way.

## Decisions

1. **The texts change in their one source each.** Title and description in
   the home route's `data` (`app.routes.ts`), the heading in
   `texts.en.ts`/`texts.de.ts` (`home.title`, `home.titleAccent`). Keys and
   template stay as they are.
2. **`index.html` follows the route, and a spec keeps it so.** The
   `<title>`, `description`, `og:title` and `og:description` of
   `index.html` take the new English texts, and `app.component.spec.ts`
   gets a check that they equal the home route's English `title` and
   `description`. Reason: the copy drifted unseen before; the spec turns the
   next drift into a red test (root cause, not a second hand edit).
3. **The eyebrow, lead and sections stay.** The eyebrow already reads
   "Wolfram Sokollek · wolsok.de"; the lead and the section texts are
   outside the issue's scope (see Open questions).
4. **Portfolio's own entry in `projects.ts` needs no change**: it lists the
   apps and experiments, not the start page's texts.

## Non-goals

- No change to the lead paragraph, the section intros, the eyebrow, the
  career, blog or legal pages, or the layout and styles.
- No new structured data (`Person` JSON-LD on the start page).
- No change to the sitemap or `lighthouse.json`: no page is added, renamed
  or removed.

## Acceptance

1. The start page's tab title is the chosen title, in English and, after
   switching to German, in German.
2. Its `meta name="description"` and `og:description` hold the chosen
   description, `og:title` the chosen title, in both languages.
3. The prerendered `index.html` of `/` (the server-rendered HTML) carries the
   English title and description before any script runs.
4. The `<h1>` of the start page reads the chosen heading, the accent in
   `<em>`, in both languages.
5. `app.component.spec.ts` fails when `index.html`'s title or description
   differs from the home route's English data.
6. `portfolio` lint, template lint, tests, spec typecheck and the production
   build (budgets) pass.

## Open questions

- The lead ("I build things in Angular that run fast in the browser …")
  stays playful. Should it be reworded in a follow-up too? Not part of this
  issue.
