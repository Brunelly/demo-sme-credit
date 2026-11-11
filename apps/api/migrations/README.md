# Migrations

Every change to the data's shape or content is a new file here. `npm run migrate` applies the ones a database
hasn't had, in order, once each, and records them in the `_migrations` collection. The platform runs it on every
deploy, on a copy of the live data, before the new version starts: a migration that fails fails the deploy, and the
live version keeps serving.

## Rules

- **Name:** `NNNN-short-name.ts`, the next number after the highest one here: `0001-load-categories.ts`.
- **Export `up(db)` only.** There is no `down`: rolling back restores the database as it was, never a script.
- **Never edit, rename or delete a migration once it is merged.** The runner refuses to run if one has changed.
  To change what it did, write a new migration.
- **Idempotent:** running it twice must do no harm. Use fixed ids with `$setOnInsert`, or filters that only match
  documents still needing the change.
- **Self-contained:** never import from `src/`. A migration must do the same thing forever, even after the app's
  code changes. Copy the few constants it needs.
- **One concern per migration.**
- **No indexes.** Indexes are code: declare them in the repository and list them in `src/db/indexes.ts`. Don't
  rely on an index inside a migration.
- **Big data files** (over about 10 MB) don't belong in git. Load them from file storage at migration time.

## Patterns

A data load (reference data, or demo data the story asks for, labelled as sample data):

```ts
import type { Db } from "mongodb";

export async function up(db: Db): Promise<void> {
  await db.collection<{ _id: string }>("categories").updateOne(
    { _id: "billing" },
    { $setOnInsert: { _id: "billing", name: "Billing" } },
    { upsert: true },
  );
}
```

A backfill when a new field must have a value on old documents:

```ts
import type { Db } from "mongodb";

export async function up(db: Db): Promise<void> {
  await db.collection("orders").updateMany({ category: { $exists: false } }, { $set: { category: "general" } });
}
```

A rename:

```ts
import type { Db } from "mongodb";

export async function up(db: Db): Promise<void> {
  await db.collection("orders").updateMany({ owner: { $exists: true } }, { $rename: { owner: "assignee" } });
}
```

Prefer an optional field over a migration: a field that may be missing on old documents needs no backfill.
