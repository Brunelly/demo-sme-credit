import { randomUUID } from "node:crypto";
import type { Collection, Db, Filter, IndexDescription, UpdateFilter } from "mongodb";
import { logger } from "../logger.ts";
import { ensureIndexes } from "./indexes.ts";

// Long-running work: anything the app keeps doing after the request that started it has been answered (a
// multi-agent Maitento run it tracks, an import, a report being written). That work lives in one process, and
// processes stop: a crash, a restart, the app going to sleep, and every deploy, which starts the new version on a
// COPY of the previous version's database. A record left "running" by a process that is gone says so forever.
//
// THE RULE: long-running work is resumable, or it is marked interrupted when the app starts. This file does it for
// every collection a feature registers (app.ts); server.ts starts it before the app takes traffic.
//
// How it tells that a run's process is gone: a running record carries a LEASE, { owner, expiresAt }. `owner` is the
// id of the process that started it (a new UUID every start). While that process lives it pushes `expiresAt`
// forward every 10 s, for all its runs at once. A run whose lease has run out, or that has none, has no process
// behind it. At start, and every 10 s after, the app takes such runs over: it marks them interrupted with a reason
// the UI shows or, for a feature that registered `resume`, claims them and carries on.
//
// Why a lease and not just "a different process id": several copies of the app can share one database (scaled up,
// or self-hosted after handover), and a run that a live copy started has a different process id too. Its lease is
// fresh, so it is left alone. The cost: a run whose process stopped only moments ago (a deploy copies the database
// seconds before the new version starts) is taken over when its lease runs out, within 30 s, rather than at once.
// A process that shuts down cleanly (stop()) ends its leases, so its runs are taken over straight away. Every
// take-over is a conditional write, so copies that start together never both take the same run.

/** How long a lease lasts unless its process renews it. */
export const LEASE_MS = 30_000;
/** How often the app renews its own leases and takes over runs whose lease has run out. */
export const CHECK_EVERY_MS = 10_000;
/** A check takes over at most BATCH × MAX_BATCHES runs of a collection; the next check takes the rest. */
const BATCH = 500;
const MAX_BATCHES = 20;

/** The status an abandoned run gets. Add it to the feature's statuses, and show `interruptedReason` with it. */
export const INTERRUPTED = "interrupted";
export const INTERRUPTED_REASON = "Stopped by a restart or a new version of the app. Start it again.";

/** The index each registered collection gets: the check's query (status, lease expiry) and the renewal (status). */
export const LEASE_INDEX: IndexDescription = { key: { status: 1, "lease.expiresAt": 1 }, name: "status_leaseExpiresAt" };

/** Who is working on a run, and until when. Stored on the run's record as `lease`. */
export interface RunLease {
  /** The process working on the run: its LongRunningWork.bootId. */
  owner: string;
  /** After this the run counts as abandoned, unless its process renews the lease first. */
  expiresAt: Date;
}

/** What an interrupted run's record holds. Put these fields in the feature's document type and contract. */
export interface InterruptedFields {
  status: typeof INTERRUPTED;
  interruptedReason: string;
  interruptedAt: Date;
}

export interface LongRunningCollection {
  /** The collection that holds the work's records. Each record has a string `status` and a string `_id`. */
  collection: string;
  /** The statuses that mean "a process is working on this". Default: ["running"]. */
  activeStatuses?: readonly string[];
  /** What the UI shows for a run this marks interrupted. Default: INTERRUPTED_REASON. */
  reason?: string;
  /**
   * Makes the work resumable instead: called with the id of each abandoned run once this process holds its lease,
   * to carry on (for example, wait again for the Maitento run whose id the record kept). If it throws, the run is
   * marked interrupted.
   */
  resume?: (id: string) => Promise<void>;
}

export interface LongRunningOptions {
  /** This process's id. The app leaves it out (a new UUID every start); tests pass one per simulated process. */
  bootId?: string;
  now?: () => Date;
  leaseMs?: number;
  checkEveryMs?: number;
}

export interface CheckResult {
  /** Abandoned runs this check marked interrupted. */
  interrupted: number;
  /** Abandoned runs this check claimed and handed to their feature's `resume`. */
  resumed: number;
}

interface Registered {
  collection: string;
  activeStatuses: string[];
  reason: string;
  resume: ((id: string) => Promise<void>) | undefined;
}

interface RunDocument {
  _id: string;
  status: string;
  lease?: RunLease;
}

/** The app's long-running work: one per process, created in server.ts and handed to createApp. */
export class LongRunningWork {
  readonly bootId: string;
  private readonly db: Db;
  private readonly now: () => Date;
  private readonly leaseMs: number;
  private readonly checkEveryMs: number;
  private readonly registered = new Map<string, Registered>();
  private timer: NodeJS.Timeout | undefined;
  private checking: Promise<void> | undefined;

  constructor(db: Db, options: LongRunningOptions = {}) {
    this.db = db;
    this.bootId = options.bootId ?? randomUUID();
    this.now = options.now ?? (() => new Date());
    this.leaseMs = options.leaseMs ?? LEASE_MS;
    this.checkEveryMs = options.checkEveryMs ?? CHECK_EVERY_MS;
  }

  /** Registers a collection of long-running work. Call it while wiring the app (app.ts), before start(). */
  register(work: LongRunningCollection): void {
    if (this.registered.has(work.collection)) {
      throw new Error(`${work.collection} is already registered as long-running work: register each collection once.`);
    }
    const activeStatuses = [...(work.activeStatuses ?? ["running"])];
    if (activeStatuses.length === 0 || activeStatuses.includes(INTERRUPTED)) {
      throw new Error(`${work.collection}: activeStatuses must name at least one status, and never "${INTERRUPTED}".`);
    }
    this.registered.set(work.collection, {
      collection: work.collection,
      activeStatuses,
      reason: work.reason ?? INTERRUPTED_REASON,
      resume: work.resume,
    });
  }

  /** Set these in the same write that gives a run an active status: `{ status: "running", ...longRunning.lease() }`. */
  lease(): { lease: RunLease } {
    return { lease: { owner: this.bootId, expiresAt: this.expiry() } };
  }

  /**
   * Add to the filter of every later write to a run this process started (its progress, its result):
   * `{ _id: id, ...longRunning.held() }`. When the write matches nothing, another process has taken the run over: stop.
   */
  held(): { "lease.owner": string } {
    return { "lease.owner": this.bootId };
  }

  /**
   * At start, before taking traffic: creates the lease index on each registered collection, takes over the runs a
   * previous process left behind, then renews and checks every 10 s until stop().
   */
  async start(): Promise<CheckResult> {
    const indexes = Object.fromEntries([...this.registered.keys()].map((collection) => [collection, [LEASE_INDEX]]));
    await ensureIndexes(this.db, indexes);
    const result = await this.check();
    if (!this.timer) {
      this.timer = setInterval(() => void this.tick(), this.checkEveryMs);
      this.timer.unref();
    }
    return result;
  }

  /**
   * Renews this process's leases, then takes over every run whose lease has run out (or that has none): it is
   * resumed if its feature registered `resume`, otherwise marked interrupted. Safe to run at any time, by any number
   * of copies of the app at once.
   */
  async check(): Promise<CheckResult> {
    const result: CheckResult = { interrupted: 0, resumed: 0 };
    for (const work of this.registered.values()) {
      await this.collection(work).updateMany(this.ownRuns(work), { $set: { "lease.expiresAt": this.expiry() } });
      if (work.resume) result.resumed += await this.resumeAbandoned(work, work.resume);
      else result.interrupted += await this.interruptAbandoned(work);
    }
    if (result.interrupted > 0 || result.resumed > 0) logger.info("took over abandoned long-running work", { ...result });
    return result;
  }

  /**
   * On shutdown: stops checking and ends this process's leases, so the next check (in another copy, or the next
   * start) takes its runs over at once instead of waiting for the leases to run out.
   */
  async stop(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    await this.checking;
    for (const work of this.registered.values()) {
      await this.collection(work).updateMany(this.ownRuns(work), { $set: { "lease.expiresAt": new Date(0) } });
    }
  }

  private async tick(): Promise<void> {
    if (this.checking) return; // the last check is still going: skip this one
    this.checking = this.check()
      .then(
        () => undefined,
        (error: unknown) => logger.warn("long-running work check failed: it runs again shortly", { error }),
      )
      .finally(() => {
        this.checking = undefined;
      });
    await this.checking;
  }

  private collection(work: Registered): Collection<RunDocument> {
    return this.db.collection<RunDocument>(work.collection);
  }

  private expiry(): Date {
    return new Date(this.now().getTime() + this.leaseMs);
  }

  /** This process's runs that are still active. */
  private ownRuns(work: Registered): Filter<RunDocument> {
    return { status: { $in: work.activeStatuses }, "lease.owner": this.bootId };
  }

  /** Active runs whose lease has run out, or that have none. Never this process's own: it renews those while it runs. */
  private abandoned(work: Registered): Filter<RunDocument> {
    return {
      status: { $in: work.activeStatuses },
      "lease.owner": { $ne: this.bootId },
      $or: [{ "lease.expiresAt": { $lt: this.now() } }, { "lease.expiresAt": { $exists: false } }],
    };
  }

  private interrupted(work: Registered): UpdateFilter<RunDocument> {
    return { $set: { status: INTERRUPTED, interruptedReason: work.reason, interruptedAt: this.now() }, $unset: { lease: "" } };
  }

  private async interruptAbandoned(work: Registered): Promise<number> {
    const runs = this.collection(work);
    let interrupted = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const filter = this.abandoned(work);
      const ids = (await runs.find(filter, { projection: { _id: 1 } }).limit(BATCH).toArray()).map((run) => run._id);
      if (ids.length === 0) break;
      // The same filter again in the write: a run renewed, finished or taken by another copy since the read is skipped.
      const result = await runs.updateMany({ ...filter, _id: { $in: ids } }, this.interrupted(work));
      interrupted += result.modifiedCount;
      if (ids.length < BATCH) break;
    }
    return interrupted;
  }

  private async resumeAbandoned(work: Registered, resume: (id: string) => Promise<void>): Promise<number> {
    const runs = this.collection(work);
    let resumed = 0;
    while (resumed < BATCH * MAX_BATCHES) {
      // One run at a time, claimed by one conditional write: two copies never resume the same run.
      const run = await runs.findOneAndUpdate(this.abandoned(work), { $set: this.lease() }, { projection: { _id: 1 } });
      if (!run) break;
      resumed++;
      void this.resumeOne(work, resume, run._id);
    }
    return resumed;
  }

  private async resumeOne(work: Registered, resume: (id: string) => Promise<void>, id: string): Promise<void> {
    try {
      await resume(id);
    } catch (error) {
      logger.error("could not resume long-running work: marking it interrupted", { collection: work.collection, id, error });
      try {
        await this.collection(work).updateOne(
          { _id: id, status: { $in: work.activeStatuses }, ...this.held() },
          this.interrupted(work),
        );
      } catch (writeError) {
        logger.error("could not mark long-running work interrupted", { collection: work.collection, id, error: writeError });
      }
    }
  }
}
