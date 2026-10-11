# Strivon identity pack

Brand pieces for slides and social posts. Nothing here changes the web app or the landing page.

## Contents

| Folder | What is in it |
| --- | --- |
| `1-logo` | Mark, horizontal, vertical and wordmark on light and dark; the logo on light, dark, red and on a reduced challenge photo; clear-space and minimum-size diagram; `svg/mark.svg` |
| `2-idea` | Poster: one square is one shelf area, and its tone says how much is missing |
| `3-patterns` | Slot-field patterns: 5 variants (scatter, wave, band, ramp, corner) on light, dark and red, in 16:9, 9:16, 1:1 and 3:1, plus two repeatable tiles. Here they are SVG files in `svg/`, plus the two PNG tiles. The 16:9, 9:16, 1:1 and 3:1 PNG renders are left out to keep the repo light; render them again from the source |
| `4-posters` | Giant cropped wordmark, the brand phrase in three layouts, the grid mark poster, a typographic poster with the slot field |
| `5-slides` | 3 covers, 3 section dividers, a big-phrase slide, a quote slide, a closing slide |
| `6-social` | Avatars (square and circle), GitHub/X cover, LinkedIn cover, Discord banner, "Built at JunctionX Lisbon 2026" badge |
| `7-stickers` | Die-cut grid sticker, hackathon badge, shelf labels (Empty, Wrong product, Fine), shelf mockup |
| `8-motion` | Grid breathing (6 s loop, also webm with alpha), slot field drift (8 s loop), wordmark reveal (3 s), restock wave (2 s, also webm with alpha). mp4 and gif |
| `9-sheet` | Brand sheet: tone ramp, colour for states, typeface, pattern, do and do not |

Open `index.html` for a gallery. It needs no server.

## Editing the slide text

The slide titles are constants near the top of the slide section in `src/identity.tsx` of the `Strivon-video` project (`TITLE`, `SUBTITLE`, `SECTION`, `QUOTE`). Change them and run `node render-identity.mjs 5-` to render the slides again.

## Rules the pieces follow

- Tone replaces shadows.
- Colour is for states: red is empty, amber is a wrong product, green is fine.
- One typeface, Inter. Small radii and plenty of room.
- The tone ramp is the logo red at 100, 82, 62, 46, 32, 20 and 11 percent over the page colour.

Sources: `src/identity-core.ts` (colours, patterns), `src/identity.tsx` (pieces), `render-identity.mjs`, `gen-identity-svg.mjs`.
