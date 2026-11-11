# Acme App

A web app with AI features: a React front end, a Node API, a MongoDB database, and agents that run on
[Maitento](https://docs.maitento.com). It starts blank (an empty page in the app's frame, over
working plumbing and a generic AI endpoint) and grows one feature at a time.

## Run it

You need Node 22 and a MongoDB. The quickest MongoDB is Docker:

```bash
docker run -d --name app-mongo -p 27017:27017 mongo:8
```

Then:

```bash
cp .env.example .env      # the settings; the defaults work locally
npm ci                    # install
npm run migrate           # set up the database
npm run dev               # the API and the web app, reloading as you edit
```

Open http://localhost:5173. The UI kit is at http://localhost:5173/kit.

Without a Maitento key the app runs normally and the AI endpoint answers "AI not connected". To switch AI on, set
`MAITENTO_API_KEY` and `MAITENTO_NAMESPACE` in `.env`, then deploy the app's definitions once with a key that
may deploy: `npm run maitento:deploy`.

### In a container

```bash
docker compose up --build   # the app, MongoDB and the migrations; open http://localhost:3000
docker compose down         # stop (add -v to delete the data)
```

The image (`Dockerfile`) is production-ready on its own: multi-stage, no dev dependencies, runs as a non-root
user, one port, a health check on `/api/health`.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | the API (port `PORT`, restarts on change) and Vite (port 5173, proxies `/api`) |
| `npm run build` | type-checks every workspace and builds the web app into `apps/web/dist` |
| `npm test` | every test, the design-token check, the design detector (`npm run check:design`) and the offline check of `maitento/` |
| `npm run migrate` | applies new migrations to `MONGODB_URI` |
| `npm start` | the API on `PORT`; with `NODE_ENV=production` it also serves the built web app |
| `npm run maitento:validate` / `maitento:deploy` | checks / deploys `maitento/` to `MAITENTO_NAMESPACE` |

## Settings

The app reads these environment variables and nothing else (`apps/api/src/config.ts`). Secrets never go in git.

| Variable | What | Default |
|---|---|---|
| `PORT` | the one port the app listens on | `3000` |
| `PUBLIC_URL` | where people open the app, for absolute links | `http://localhost:PORT` |
| `MONGODB_URI` | the database; its path is the database name | `mongodb://localhost:27017/app` (required in production) |
| `MAITENTO_BASE_URL` | the Maitento API | `https://api.maitento.com` |
| `MAITENTO_API_KEY` | the app's Maitento key, `<user id>:<secret>` | none: AI features answer "AI not connected" |
| `MAITENTO_NAMESPACE` | where `maitento/` is deployed and runs | none |
| `SIMULATED_DATA_SCENARIO` | control-centre scenario for each new simulated assessment | `clean` |

## How it's built

```text
apps/api/             Express 5 API: features/<name>/{routes,service,repository}, migrations/, tests
apps/web/             React + Vite app: pages/, features/<name>/, routes.tsx, tests
packages/contracts/   request schemas and response types shared by the API and the web app
packages/ui/          the component kit; tokens.css holds every colour, size and font
maitento/             the app's agents and interactions, deployed to Maitento
poc.json              how to build, migrate, start and health-check the app (schema: poc.schema.json)
AGENTS.md, CLAUDE.md  the rules for coding agents working here
.agents/skills/       skills for coding agents (Maitento)
```

- **One port.** In production the API serves the web app and `/api` from the same origin. `/__brunelly/` is
  reserved for the hosting platform and never served by the app.
- **Database changes are migrations.** Each change is a new numbered file in `apps/api/migrations/` with an
  `up(db)` and no `down`; `npm run migrate` applies the new ones, once each, and records them in `_migrations`.
  Demo and reference data load the same way. Indexes are code: the app creates them when it starts.
- **Long-running work survives restarts and deploys.** Work that outlives its request registers its collection with
  `apps/api/src/db/long-running.ts`. When the app starts, it resumes what a previous process left running, or marks
  it interrupted with a reason the UI shows.
- **AI** goes through `apps/api/src/ai/maitento.ts`. The assistant calls the `ask-assistant` interaction in
  `maitento/` and checks the answer's shape before using it.
- **Branding** is `packages/ui/src/tokens.css` (colours, type), `apps/web/src/brand.ts` (the name in the top
  bar), `apps/web/index.html` (the page title) and `apps/web/public/favicon.svg`.

## Licences

The Maitento skill in `.agents/skills/maitento/` is Apache-2.0; its `LICENSE` and `NOTICE` are next to it.
