# HWS Online Course Builder

A web page where HWS faculty set up a new Canvas course: pick a ready-made plan (or answer a few
questions), adjust it week by week, and download one file that Canvas imports as a course skeleton.
Everything runs in the browser. Nothing is sent anywhere, and there is no Canvas login.

It builds new courses only. To move an existing course to a new semester, copy it in Canvas and
tick "Adjust events and due dates".

## Try it on this computer

```
npx http-server@14.1.1 -p 8080
```

Then open <http://localhost:8080/>. (Opening `index.html` by double-clicking does not work; browsers
only load the scripts from a web address.)

`http://localhost:8080/checks/preview.html` opens straight on the review screen with a sample course.

## Check that it works

```
npm install        # once
npm test           # the automated tests
npm run a11y       # runs every screen through an accessibility checker in Edge or Chrome
```

`npm run a11y -- --selftest` plants a deliberate problem to prove the checker can catch one.

## The one Canvas check

`rounds/import-check.imscc` is a single test course, and `rounds/import-check.md` is the list of
what to look for after importing it once into a new, empty sandbox course. Regenerate both with
`node scripts/make-import-check.js`.

## How it is put together

- `src/model.js` — the Course object, the only state in the app.
- `src/templates.js`, `src/walkthrough.js` — make a Course from a plan or from the walkthrough's answers.
- `src/edit.js` — every change the review screen can make.
- `src/warnings.js` — weights that miss 100%, dates outside the course, break reminders.
- `src/save.js` — autosave and the "Download my work" file.
- `src/export/` — turns a Course into the file Canvas imports. `outline.js` decides what Canvas gets;
  `write.js` and `parts/` write it.
- `src/ui/` — the screens. They draw the Course and call the functions above.

There is no build step and no framework: the files in this folder are the website.

## Publish it (GitHub Pages)

1. Create a repository on GitHub and push this folder's `main` branch to it.
2. On GitHub: *Settings → Pages → Build and deployment → Deploy from a branch*, choose `main` and `/ (root)`.
3. After a minute, the site is at `https://<your-user>.github.io/<repository>/`.

`node_modules/` is not published and is not needed by the site; `vendor/jszip.min.js` is the only
library the page loads.

## Design

The approved design is `../2026-11-10-course-builder-design.md`; what the Canvas import tests taught
is in `../prototype/LESSONS.md`.
