# Rules for coding agents

This app starts blank: an empty page in the app's frame, over working plumbing (health, config, migrations,
indexes, errors, the Maitento SDK and a generic AI endpoint). Build what the story asks for and nothing it doesn't,
keep it working, keep it looking designed, and copy the patterns already here.
`CLAUDE.md` and `AGENTS.md` are the same file: change both together.

## Stack

Node 22 · TypeScript everywhere · npm workspaces · Express 5 + the official `mongodb` driver + `zod` ·
`@maitento/sdk` for AI · React 19 + Vite + React Router · `lucide-react` icons · vitest everywhere.
Node runs the API's `.ts` files directly (type stripping), so: no enums, no namespaces, no constructor
parameter properties, and relative imports name the file: `import { x } from "./x.ts"`.

## Where things go

| Path | What |
|---|---|
| `packages/contracts/src/<feature>.ts` | the API's request schemas (zod) and response types, shared by api and web |
| `apps/api/src/features/<feature>/` | `<feature>.routes.ts` (HTTP only) → `.service.ts` (rules) → `.repository.ts` (the only MongoDB code) |
| `apps/api/src/app.ts` | wiring: create the feature's service, mount its routes under `/api` |
| `apps/api/src/db/indexes.ts` | every collection's indexes, created at startup |
| `apps/api/migrations/` | `NNNN-name.ts` up-only migrations: see below and its README |
| `apps/api/src/errors.ts` | typed errors; `src/config.ts` is the only reader of `process.env` |
| `apps/api/src/ai/maitento.ts` | the SDK, behind `AiRunner` (null when there is no key) |
| `apps/web/src/features/<feature>/` | `<feature>.api.ts` (one function per endpoint, via `lib/api.ts`) and its components |
| `apps/web/src/pages/`, `routes.tsx`, `layout/` | pages, the route table, the app shell and nav |
| `packages/ui/` | the component kit and `src/tokens.css`; `/kit` (development only) shows every component |
| `maitento/` | the app's agents and interactions (`.mtr`): read `.agents/skills/maitento/SKILL.md` first |
| `poc.json` | how the platform builds, migrates, starts and health-checks the app |

A new feature is built in layers, each with its tests:

1. the contract in `packages/contracts/src/<feature>.ts`, exported from `index.ts`;
2. the repository (the only MongoDB code), its named indexes listed in `src/db/indexes.ts`;
3. the service (the rules, typed errors), then the routes (HTTP only), mounted in `app.ts`;
4. a migration, if the data's shape or content changes;
5. the web api file, the components, the page, its route in `routes.tsx` and its entry in `poc.json` `ui.routes`.

A complete worked example of these layers, this starter's old demo feature, is at
`/mnt/vfs/gold-standard/poc-starters/web-tickets/` when that folder is present. Copy its patterns, never its
screens, copy or data.

## Settings and secrets

- The app reads its settings only through `apps/api/src/config.ts` (`logger.ts`'s `LOG_LEVEL` is the one exception):
  `PORT`, `PUBLIC_URL`, `MONGODB_URI`, `MAITENTO_BASE_URL`, `MAITENTO_API_KEY`, `MAITENTO_NAMESPACE`, `LOG_LEVEL`.
- **Declare every variable the app reads in `poc.json` `env`**, in the same change as `config.ts` and `.env.example`:
  a `description` the person filling it in understands, `required: true` only when the app can't work without it,
  and `secret: true` for any credential (an API key, a token, a password). A `default` is allowed on a non-secret
  only. Give every required one an `example`: an obviously fake value of the right shape (`ops@example.com`), never a
  real one; the pipeline's checks run the app with it. The pipeline fails a change that reads a variable `poc.json`
  doesn't declare. A setting the app can't work without stays `required`: never make it optional or give it a default
  to get a check green, because the platform supplies a value in its checks and asks a person for it before a deploy.
- **People set the values** in the app's Settings on the platform; a deploy that needs a required value waits for
  it. Never put a secret's value anywhere in the repository: not in code, `poc.json`, `.env.example`, tests,
  fixtures, seed data or migrations. Tests use obviously fake values (`test-key`). Never commit a `.env`.
- Settings reach the API's process only. The web app never reads `process.env` or `import.meta.env` for a setting:
  it gets what it needs from the API.

## Environment and paths

- One port: in production the API serves the built web app and `/api`. The web app lives at `/` (no base
  path) and calls the API with relative paths: `fetch("/api/…")` through `lib/api.ts`.
- **`/__brunelly/` is reserved for the platform.** Never add a route, page or file under it. The cookie
  `__Host-brunelly-poc` is the platform's sign-in: never set, read or clear it.
- API routes (`/api/…`) may answer 502, 503 or 504 when something they depend on fails: the platform passes
  those through untouched. Pages and files (everything outside `/api`) must not: there the platform shows its
  own "starting up" page for those codes. `/api/health` answers 503 while the app can't serve; keep it fast
  and side-effect free.
- In a deployed app, sign-in and access are handled by the platform in front of it. Don't build login unless
  a story asks for it.

## Database: migrations and indexes

- **Every change to the data's shape or content is a new migration** in `apps/api/migrations/`, named with the
  next number: `0001-load-categories.ts`, exporting `up(db)` only. **No `down`, ever**: rollback restores
  the database as it was.
- **Never edit, rename or delete a migration once merged.** The runner refuses to run if one changed.
- **Loads are migrations** (reference data, demo data) and must be **idempotent**: fixed `_id`s with
  `$setOnInsert`, or filters that match only what still needs changing. One concern per migration.
- Migrations never import from `src/`; copy the constants they need.
- **Indexes are code, never migrations**: declare them next to the repository, list them in
  `src/db/indexes.ts`, name each one. Every query needs an index. Every list query has a `.limit()`.
- Prefer optional fields to backfills. Ids are UUID strings (`randomUUID()`), never ObjectIds.

## API rules

- Routes parse input with the contract's schema (`parse(schema, req.body)`), call a service, and send the
  result. No logic and no database in routes; no `try/catch` (Express 5 forwards errors).
- Throw the typed errors from `errors.ts` (`ValidationError`, `NotFoundError`, `ConflictError`, …), never
  `new Error()` for something a caller did wrong.
- AI features follow `features/assistant`: no `AiRunner` → answer "not connected", never fail; gather context
  through services; run the interaction by name; validate the model's answer with zod before using it.
  Never invent data in a prompt or in seed data shown as real.

## Long-running work

- **Work that outlives its request** (a background Maitento run, an import, a report being written) dies with its
  process: a restart, a crash, sleep, and every deploy, which starts the new version on a copy of the database.
  **It is resumable, or marked interrupted when the app starts.** Never leave it "running" forever.
- `src/db/long-running.ts` does it. Register the collection in `app.ts`: `longRunning.register({ collection })`.
  Add `resume: (id) => …` when the work can carry on (it kept the Maitento run's id); without it, a run whose
  process is gone becomes `"interrupted"` with an `interruptedReason`.
- Start a run with its lease, in the same write: `{ status: "running", ...longRunning.lease() }`. Write its progress
  and result with `{ _id: id, ...longRunning.held() }` in the filter; no match means another process took it over:
  stop. End every run, failures too.
- Put `"interrupted"` in the feature's statuses and `interruptedReason` in its contract. The UI shows the reason,
  and a way to start again.
- Test that a run left by another process ends interrupted (`apps/api/test/long-running.test.ts` shows how). The
  tickets reference's `reply-drafts` feature is a worked example, API to screen.

## UI rules

- **The app starts blank, on purpose.** Never invent a home page, a dashboard, a navigation, demo data or a
  feature the story didn't ask for. `docs/design-brief.md`, when present, says who the app is for and how it
  should look: read it before any UI work, and follow it.
- Build screens from `@app/ui`. Check `/kit` and `packages/ui/src/index.ts` before writing a component; a
  missing pattern goes into `packages/ui` (with a test and a `/kit` demo), not into a page.
- **Tokens only.** Colours, spacing, radii, fonts and shadows come from `var(--…)` in
  `packages/ui/src/tokens.css`. No colour literals anywhere else and no inline colour styles:
  `npm run check:tokens` fails on them. Add a token if none fits.
- Style with CSS Modules (`X.module.css` next to `X.tsx`). Icons from `lucide-react`.
- Every data view handles loading, empty and error (`LoadingState`, `EmptyState`, `ErrorState`, or the
  `DataTable` props). Every button that calls the API disables while in flight (`loading`).
- Map machine values (statuses) to labels and tones in one place (a `<feature>-labels.ts` next to the components). Mark AI-written
  content as AI.
- **Never invent facts:** no made-up figures, testimonials, logos, customer counts or names of real companies.
  Show what the story, the project's documents or the app's data say, and label sample data as sample.
- Accessible by default: labels on every control (`Field`), `aria-label` on icon-only buttons, keyboard works.
- **Read the design skills.** Before you build or reshape a screen, `.agents/skills/frontend-design/SKILL.md`;
  before any UI edit, Impeccable's `.agents/skills/impeccable/reference/craft-floor.md` (its `SKILL.md` lists the
  references for polishing, auditing and hardening); and `.agents/skills/hallmark/SKILL.md`, the floor no screen
  ships below (contrast, visible focus, reduced motion, no sideways scroll on a phone) and the no-invented-facts rule.
- **Design checks.** `npm run check:design` (Impeccable's detector on the UI source) is part of `npm test` and must
  stay clean. A new top-level page goes into `poc.json` `ui.routes`: the pipeline opens every route there at each
  `ui.viewports` size, screenshots it for the story and scans the rendered page, and a finding fails the change
  like a test. Fix the design, never the check: no `impeccable-disable` comments or config ignores, except a value
  the brand mandates (the brand font), added with `--reason`. Never run `impeccable live`.

## Tests

- Every change ships with tests, next to the code's layer: `apps/api/test/` (vitest + supertest on an
  in-memory MongoDB, via `test/helpers.ts`), `apps/web/test/` (Testing Library, with `mockApi`),
  `packages/ui/test/`, `packages/contracts/test/`. Tests are hermetic: no network, no real Maitento (use
  `fakeAi`), no shared state.
- Test behaviour people see (roles, labels, text), not implementation details.

## Before you finish

Run these from the root. All of them must pass:

```bash
npm run build      # type-checks everything, builds the web app
npm test           # every test, the token and design checks, and the offline .mtr check
npm run migrate    # applies migrations to MONGODB_URI (needs a MongoDB: see README)
```

If you changed `maitento/`, `npm run check:maitento` must be clean (`npm test` runs it).

## UI quality: built for the people who use it

This app is shown to the people who would use it, and they judge it in seconds by whether it looks like their work.
The UI is part of done, never polish to leave out.

- **Read `.agents/skills/product-ui/SKILL.md` before any screen work.** Write its use-case brief (who, situation,
  job, what they must see first, the real data, density), name the screen's archetype, and take the look from the
  tokens (`packages/ui/src/tokens.css`) and `docs/design-brief.md` when it exists.
- **An app screen has no hero:** it opens on the work (the queue, the record, the figures that need attention).
- **Real-feeling domain content:** identifiers, amounts, dates and names in the users' formats. Never lorem,
  placeholder people, invented facts or buzzwords.
- **None of the generic tells** in `.agents/skills/product-ui/references/generic-tells.md` unless the brief asks for
  one: no default indigo-violet gradients, no emoji as icons, no grid of identical cards, no frosted glass.
- **Look at your own screenshots before you finish** a screen change (`references/screenshot-review.md`), fix what
  reads wrong for the users, and look once more.
