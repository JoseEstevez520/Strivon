# Frontend

The staff screen of Strivon: React, Vite, Tailwind v4 and shadcn.

- Before you change anything visual, read `DESIGN.md`. It holds the rules and the reasons.
- When you decide something new about the look, add it to `DESIGN.md` in the same commit.
- Compare new work against `DESIGN.md` and not only against the last component built.
- Search before you build: the repo, then Base UI and shadcn (`npx shadcn@latest view <name>`),
  then the registry and GitHub. Write your own only when nothing fits.
- Do not name a folder `data` inside the frontend. The repo's root `.gitignore` ignores `data/`
  at any depth, to keep the challenge data out, and it would silently hide the code. The
  frontend's model lives in `src/model`.
- Use the tokens in `src/index.css`. Do not add colours, sizes or radii of your own.
- Text a person reads is in English by default, with the Portuguese and Spanish versions in
  `src/lib/i18n.tsx`.
- The cameras, areas and photos are real and read in development from a folder outside the repo
  (`STRIVON_DATA_DIR`). Never copy challenge data, photos or the planogram into the repo. The
  stock states are simulated in `src/model/simulate.ts` with the same shape as the pipeline's
  `/api/state`. `src/model/mock.ts` is the fallback when the folder is missing.
- Run `npm run dev -- --port 5180` and keep the pipeline server on port 8000 for the proxy.
- Commits follow the repo rules: Conventional Commits and no attribution lines.
