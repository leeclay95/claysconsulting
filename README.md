# claysconsulting.org

Source for the Clay's Consulting website: a static [Astro](https://astro.build) site
served from a single [Cloudflare Worker](https://developers.cloudflare.com/workers/),
deployed from GitHub Actions on push to `main`.

One Worker serves both the static assets and the `/api/contact` endpoint, so the page
and its form endpoint always ship as one atomic version — the page can never be live
against a contact endpoint that hasn't deployed.

## Stack

| | |
|---|---|
| Site | Astro 7, static output, zero client JS by default |
| Host | Cloudflare Workers with static assets |
| CI/CD | GitHub Actions + `cloudflare/wrangler-action` |
| Tests | Vitest running in `workerd` via Miniflare |

## Local development

```bash
npm ci

# Astro dev server with hot reload — fastest loop for design work
npm run dev            # http://localhost:4321

# The real thing: production build served through the actual Worker,
# including /api/* routing. Use this to check anything Worker-related.
npm run build && npm run preview   # http://localhost:8787
```

`npm run dev` starts in the background; manage it with `npx astro dev status`,
`npx astro dev logs`, and `npx astro dev stop`.

## Commands

| Command | Purpose |
|---|---|
| `npm run build` | Build static site to `dist/` |
| `npm run check` | Astro template and TypeScript diagnostics |
| `npm test` | Unit tests for the contact handler (no network) |
| `node scripts/check-anchors.mjs dist` | Verify every nav anchor resolves |
| `npm run deploy` | Deploy manually (CI normally does this) |

## Layout

```
src/
  pages/index.astro      the single page; assembles the sections
  components/            one component per section (Portfolio = the
                         personal section; Projects = the flagged-off grid)
  layouts/Base.astro     head, sticky header, footer
  styles/tokens.css      design tokens and shared primitives
  config.ts              feature flags + site content
  data/projects.json     drives the portfolio grid
worker/
  index.ts               fetch handler; owns /api/* only
  contact.ts             validation, anti-spam, dispatch (pure, unit-tested)
  mail/sender.ts         provider-agnostic MailSender interface
  mail/resend.ts         Resend adapter
scripts/check-anchors.mjs anchor integrity check, runs in CI
```

Only `/api/*` reaches the Worker; everything else is served straight from static
assets (`run_worker_first` in `wrangler.jsonc`).

## Feature flags

Two sections are built but disabled in `src/config.ts`, because no real projects
exist yet and an empty portfolio grid is worse than no grid:

```ts
capabilityMap: false   // capability map — component not yet built
projects: false        // projects grid — add entries to data/projects.json
contactForm: false     // contact form — needs a mail provider configured
```

Section numbers in the headings are derived from the enabled list in
`src/config.ts`, so they stay sequential when a section is flagged on or off.

While `contactForm` is false the contact section shows direct email and phone
instead of a form. `/api/contact` returns `503 not_configured` until a mail
provider secret exists — it fails loudly rather than silently dropping leads.

## Content

All copy lives in `src/config.ts` — `hero`, `about`, `operator`, and `site`.
There are no placeholder markers; every string on the page is real content.

Two optional additions:

- **`certifications`** — an empty array by default. Add exact credential names
  and they render above the Credly links in the portfolio card. Left empty
  rather than guessed: inventing credentials on a DoD-facing site is a serious
  problem.
- **Wordmark / favicon** — `public/favicon.svg` is a simple geometric mark, not
  a designed logo.

## Deployment

Push to `main` deploys to production. Pull requests run the same checks and
upload a preview version (a temporary `workers.dev` URL — no DNS involved).

The checks gate runs before any deploy step and blocks it on failure: type check,
build, anchor integrity, unit tests, and `npm audit --audit-level=high`.

### Required GitHub Actions secrets

| Secret | Notes |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Scoped to Workers Scripts: Edit, Account Settings: Read, Workers Routes: Edit. **No DNS permission and no IP condition.** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

The CI token deliberately cannot touch DNS, so a compromised Actions run cannot
repoint the domain. DNS changes are made separately by an operator. For the same
reason `wrangler.jsonc` does **not** use `custom_domain: true` — that would make
Wrangler manage DNS records and force DNS write access into CI.

### Runtime secrets

Set directly on the Worker, never in the repo or in GitHub:

```bash
npx wrangler secret put MAIL_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Because runtime secrets live in Cloudflare, a public repo and a compromised
Actions run both leave them unexposed.

## Design constraints

The visual theme lives in color, monospace accents, and density — not in
effects. Deliberately excluded: matrix rain, glitch/scramble text, simulated
typing, terminal cursors on headings, CRT scanlines, and fake command prompts as
UI chrome. Dark security-themed sites read as credible when the typography and
spacing are disciplined, and as amateur when they lean on effects.

Color is semantic: crimson marks offensive work, amber marks compliance and
severity, neutral marks architecture.
