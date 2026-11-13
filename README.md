# SME Credit Desk

SME Credit Desk is a proof of concept for Rasikh Bank's SME credit desk. Relationship managers and credit
analysts use it to work a queue of short-term SME finance applications — invoice financing and working-capital
facilities — against the bank's SME credit policy, SME-CP-07.

The AI prepares an evidence-led assessment and a non-binding recommendation. A named analyst makes every credit
decision, and a decline needs a second, different analyst. The app runs on sample applications and simulated source
data; it is demonstration software, not a production credit system.

## What it does now

**Application queue and case workspace.** The Applications screen lists applications oldest first, with the
business name in English and Arabic, commercial registration, product, requested amount in SAR and stage. Selecting
a row opens the case beside the queue: product, facility, buyer quality where applicable, and every assessment run
for that case. From there an analyst starts an assessment.

**Assessment trail.** A run moves through four Maitento specialists in order: SIMAH credit bureau, Wathq company
verification, ZATCA e-invoice verification and open-banking cash flow. Each records a plain-language finding with
its source label, evidence and SME-CP-07 citations. An independent reviewer then accepts the finding, challenges it
with an evidence gap or reasoning defect, or asks for human review; a challenged specialist gets one recorded rework
pass. The final recommendation assistant combines the corrected findings into an Approve, Refer or Decline
recommendation with a risk grade where the evidence supports one, missing grade inputs where it does not, a
policy-cited reason tree, and the decision authority under SME-CP-07 §7.1. The recommendation is labelled
non-binding, and progress, failures and interrupted runs are shown on the case.

**Human decisions and four eyes.** The Review queue lists assessments awaiting a decision with the recommendation,
required authority and existing decision history. An analyst records a decision as their named platform identity,
with notes. A different outcome from the recommendation is an override and needs an Appendix A reason. A decline is
not final until a different named analyst confirms it; the same person cannot satisfy both steps.

**Decision ledger and CSV export.** Every decision is appended to the ledger with the assessment it belongs to, the
actor, effective outcome, reason, time and sequence. Authorised roles can export the full ledger as a CSV with a
Status column for final and pending decisions. Cells that could be read as spreadsheet formulas are neutralised, so
the file opens safely in Excel.

**Team throughput.** The Team throughput screen reports applications received this week (Monday to Sunday),
completed decisions, average decision time, approvals, referrals, declines, the analyst override rate, and the
recent final decisions behind those figures.

The header switches the workspace between English and Arabic (including right-to-left layout) and light and dark
themes.

## Sample data

The demonstration runs on sample data. Migrations load sample applications across Saudi cities, simulated source
packs for each application, and completed sample assessment trails for applications past New. Records seeded by the
migrations are marked **Sample data** in the UI.

Assessments read simulated SIMAH credit-bureau reports, Wathq company records, ZATCA e-invoice clearance records
and twelve months of open-banking bank statements. They do not connect to SIMAH, Wathq, ZATCA, open banking or any
bank system.

`SIMULATED_DATA_SCENARIO` chooses the simulated facts for each new assessment: `clean`, `disputed_invoice`,
`low_bureau` or `returned_cheques`. Set it in the platform's Settings; there is no in-app scenario picker. Each
assessment stores the scenario it used.

## Run it locally

Prerequisites: **Node.js 22** (the root package requires 22.22 or later) with npm, and **MongoDB**. A local MongoDB
is enough:

```bash
docker run -d --name sme-mongo -p 27017:27017 mongo:8
```

Then, from the repository root:

```bash
cp .env.example .env      # local defaults
npm ci                    # install
npm run migrate           # create the schema and load the sample data
npm run dev               # API and Vite, with reload
```

Open http://localhost:5173. The API listens on `PORT` (3000 by default); Vite serves the web app and proxies
`/api` to it. The component kit is at http://localhost:5173/kit in development.

To run everything in containers instead:

```bash
docker compose up --build   # MongoDB, migrations and the app; open http://localhost:3000
docker compose down         # stop (add -v to delete the data)
```

### Migrations and sample data

`npm run migrate` applies the numbered, up-only migrations in `apps/api/migrations/` once each and records them in
`_migrations`. The sample data is loaded the same way: applications (`0001`), simulated sources (`0007`), the review
queue (`0006`), throughput decisions (`0010`) and assessment trails (`0014`) are seeded by migrations. The
migrations are idempotent, so running them again does not duplicate data. The database name is the path in
`MONGODB_URI`.

### Serving the web build

`npm run build` type-checks the workspaces and builds the web app into `apps/web/dist`. With
`NODE_ENV=production`, `npm start` serves the built app and `/api` from the same origin and port, so a refresh on
`/reviews` or `/dashboard` still opens the app. In development, Vite serves the UI and proxies `/api` to the API.

## Settings

The API reads configuration only through `apps/api/src/config.ts`. Every variable is declared in `.env.example` and
`poc.json`; set values in the platform's Settings, never in code or git.

To run a Maitento-backed assessment, set:

- `MAITENTO_API_KEY` — the app's Maitento key. Secret.
- `MAITENTO_NAMESPACE` — the namespace where `maitento/` is deployed.
- `MAITENTO_BASE_URL` — the Maitento API; defaults to `https://api.maitento.com`.

For a local or self-hosted run, deploy the definitions in `maitento/` to that namespace once with
`npm run maitento:deploy` (it needs a key allowed to deploy). Without a key the API still starts, but **Run
assessment** answers "AI not connected".

The other settings are:

| Variable | What it does |
|---|---|
| `MONGODB_URI` | The MongoDB database; the database name is the URI path. Required in production. |
| `PLATFORM_AUTH_SECRET` | Secret that verifies the short-lived platform identity on decision and ledger-export routes. Required in production. |
| `SIMULATED_DATA_SCENARIO` | Scenario for new assessments: `clean` (default), `disputed_invoice`, `low_bureau` or `returned_cheques`. |
| `PORT` | The one port the app listens on. |
| `PUBLIC_URL` | The address people open the app at, for absolute links. |
| `LOG_LEVEL` | The least important log line written: `debug`, `info`, `warn` or `error`. |

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Starts the API (reloading on change) and Vite on port 5173. |
| `npm run build` | Type-checks every workspace and builds the web app into `apps/web/dist`. |
| `npm test` | Runs the tests plus the token, design and offline Maitento checks. |
| `npm run migrate` | Applies pending migrations to `MONGODB_URI`. |
| `npm start` | Starts the API; with `NODE_ENV=production` it also serves `apps/web/dist`. |
| `npm run maitento:validate` / `maitento:deploy` | Validates or deploys `maitento/` to `MAITENTO_NAMESPACE`. |
