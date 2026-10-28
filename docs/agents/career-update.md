# Career update: the monthly routine

The portfolio's career page (`apps/portfolio/src/app/career/`, served at
`https://wolsok.de/career`) shows Wolfram's qualification profile. The
profile is kept in Google Drive; the page's data is a typed copy of it in
both languages. Once a month a scheduled Claude task (a fresh cloud session
on this repository with the Google Drive connector) runs this routine. It
can also be run by hand in any session that has Drive access.

## Where things are

- **The profiles**: the Drive folder `Qualifikationsprofil` (id in
  `CAREER_SOURCE.folderId` in `career.data.ts`). Every version is a file
  named `<YYYY-MM-DD>_Wolfram-Sokollek_QualifikationsProfil.pdf` or `.docx`
  (older ones differ slightly); the newest date wins. Prefer the PDF of a
  date over the DOCX when both exist, they hold the same text.
- **The data**: `apps/portfolio/src/app/career/career.data.ts`:
  - `CAREER_SOURCE`: the file the data was taken from (`fileId`, `fileName`,
    `profileDate`) and `checkedAt`, the day Drive was last compared.
  - `CAREER_PROFILE`: title, education, certificates, languages, focus areas
    (`Erfahrungsschwerpunkte`), industries, soft skills, the skill groups
    (`IT-Kenntnisse`).
  - `CAREER_PROJECTS`: every engagement, newest first, with years, client,
    role, summary, duration, team size, workplace, project language,
    highlights (the bullet list), technologies and methods. German is the
    profile's wording, lightly tidied; English is a faithful translation.
- **The model**: `career.model.ts` says what each field means.
- **The checks**: `career.spec.ts` (order, both languages, source dates),
  `app.component.spec.ts` (sitemap, SEO), the production build's budgets.

## The routine

1. Search the folder for the newest profile (`search_files` with
   `parentId = '<folderId>'`, sort by the date in the title).
2. Compare its date with `CAREER_SOURCE.profileDate`.
   - **Not newer**: set `checkedAt` to today, and stop. Open no pull request
     for that alone; the next real change carries it.
   - **Newer**: read the file (`read_file_content`) and go on.
3. Bring `career.data.ts` in line with the profile, in both languages:
   - New engagement: a new entry at the top of `CAREER_PROJECTS`, an `id`
     in kebab-case, a free `accent` colour from the ones in use.
   - Changed engagement (new bullets, a longer duration, a changed end
     year): update it in place, keep its `id`.
   - Changed header data (title, focus areas, industries, skills,
     certificates): update `CAREER_PROFILE`.
   - Keep the profile's wording in German; translate new text into English
     in the same register as the rest. Drop bullets the profile repeats.
   - Set `CAREER_SOURCE` to the new file (id, name, date) and `checkedAt`
     to today.
4. Does the home page's teaser (`texts.en.ts` / `texts.de.ts`,
   `home.careerLead`) or the career route's description (`app.routes.ts`)
   name a client or a number the change makes stale? Update them.
5. Run `npx nx format:write`, `npx nx run-many -t lint,lint-templates,test
-p portfolio` and `npx nx build portfolio`. A budget that fails because
   the data grew is raised in its own `perf(portfolio): ...` commit, as
   CLAUDE.md's performance rules say.
6. Commit as `feat(portfolio): ✨ update the career from the profile of
<date>` on a branch `career-update/<date>`, push, open a pull request
   that names the profile file and lists what changed (new engagement,
   changed bullets, new skills), and request a CodeRabbit review
   (`@coderabbitai review`).

## What the routine must not do

- Publish anything the profile keeps private: no phone number, no street
  address, no birthday beyond the year, no family details.
- Invent engagements, dates or numbers. What the profile does not say
  stays out; a doubt goes into the pull request's description.
- Touch the privacy policy or the other apps.
