# Personal website

A plain HTML/CSS/JS site with no build step and no frameworks.

| Page | File |
| --- | --- |
| Home (intro + rocket-to-the-Moon mission log) | `index.html` |
| Research | `research.html` |
| Publications (with type filters) | `publications.html` |
| News | `news.html` |
| Contact | `contact.html` |

- `style.css` holds the colors, fonts and layout. Change the variables at the top to restyle the site.
- `script.js` runs the animations (network background, rocket flight, scroll fades), the light/dark toggle, the mobile menu, the publication filters and the copy-email button.
- `favicon.svg` is the browser-tab icon.

The menu and footer are repeated at the top and bottom of every page. If you add or rename a page, update them in all five files.

## Editing

Text with a dotted amber underline is placeholder. These elements have `class="todo"`.
Replace the text, then remove `class="todo"` from that element.

- **Photo (the astronaut's face):** save a square headshot as `photo.jpg` in this folder, then in `index.html` find the `<image href="photo.jpg"` line inside the astronaut and delete the `<!--` and `-->` around it. The face appears when visitors scroll and the gold visor lifts.
- **CV:** save it as `cv.pdf` in this folder.
- **Email:** search all files for `you@example.com`.
- **Links:** replace each `href="#"` with your Google Scholar, LinkedIn, ORCID and paper links.
- **Publications:** copy an `<li class="pub">` block per paper and set `data-type` to `journal`, `conference` or `preprint`.
- **Rocket milestones:** edit the five `<li>` items in the mission log in `index.html`. Each `data-at` value (0 to 0.985) sets how far along the flight that milestone lights up.

## Preview

Open `index.html` in any browser.

## Publishing

This folder is the GitHub repository `sajadahmadi14/sajadahmadi14.github.io`.
GitHub Pages serves the `main` branch, so any change you push goes live at
https://sajadahmadi14.github.io within a minute or two.

When you change `style.css` or `script.js`, bump the `?v=6` number on the `<link>` and `<script>` tags in every page
(for example to `?v=7`). Otherwise browsers may keep showing the old files for up to 10 minutes.
