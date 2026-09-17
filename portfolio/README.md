# portfolio.claysconsulting.org

Personal technical portfolio for Lee Clayton: a static Astro site with an
interactive (simulated) command terminal, served from its own Cloudflare
Worker, independent of the main `claysconsulting.org` site one directory up.

## Commands

```bash
npm ci                              # install (deterministic)
npm run dev                         # Astro dev server, http://localhost:4321
npm run build && npm run preview    # real Worker via wrangler dev
                                    #   defaults to :8787, same as the main
                                    #   site, so pass --port to run both at once
npm run check                       # Astro template + TypeScript diagnostics
npm run deploy                      # manual wrangler deploy (CI normally does this)
```

## Terminal

`src/components/Terminal.astro` renders the UI; `src/scripts/terminal.ts`
drives it. It is simulated only, no backend execution: every command renders
pre-authored content from `src/data/operator.ts` and `src/data/projects.ts`.
Add a project by adding an entry to `src/data/projects.ts`; a `show <slug>`
terminal command and a card in the Projects section are both generated from
that array automatically.

## Deploy

Push to `main` (paths under `portfolio/**`) runs
`.github/workflows/deploy-portfolio.yml`, which builds and deploys this
Worker independently of the main site's deploy. See
`docs/superpowers/specs/2026-09-16-portfolio-subdomain-design.md` (one
directory up) for the DNS/subdomain setup this depends on.
