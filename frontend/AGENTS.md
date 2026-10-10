# Frontend

The staff screen of Strivon: React, Vite, Tailwind v4 and shadcn.

- Before you change anything visual, read `DESIGN.md`. It holds the rules and the reasons.
- When you decide something new about the look, add it to `DESIGN.md` in the same commit.
- Compare new work against `DESIGN.md` and not only against the last component built.
- Search before you build: the repo, then Base UI and shadcn (`npx shadcn@latest view <name>`),
  then the registry and GitHub. Write your own only when nothing fits.
- Use the tokens in `src/index.css`. Do not add colours, sizes or radii of your own.
- Text a person reads is in English by default, with the Portuguese and Spanish versions in
  `src/lib/i18n.tsx`.
- The data is simulated in `src/data/mock.ts` and has the same shape as the pipeline's
  `/api/state`.
- Run `npm run dev -- --port 5180` and keep the pipeline server on port 8000 for the proxy.
- Commits follow the repo rules: Conventional Commits and no attribution lines.
