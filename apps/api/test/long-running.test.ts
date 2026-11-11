import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTERRUPTED,
  INTERRUPTED_REASON,
  LEASE_INDEX,
  LEASE_MS,
  LongRunningWork,
  type LongRunningCollection,
  type RunLease,
} from "../src/db/long-running.ts";
import { useTestDatabase } from "./helpers.ts";

const mongo = useTestDatabase();

/** A feature's runs, stored the way a registered feature stores them. */
interface Run {
  _id: string;
  status: string;
  lease?: RunLease;
  interruptedReason?: string;
  interruptedAt?: Date;
}

const RUNS = "report_runs";
const runs = () => mongo.db.collection<Run>(RUNS);
const run = async (id: string) => (await runs().findOne({ _id: id }))!;

/** One clock for every simulated process in a test, moved by the test. */
const T0 = new Date("2026-11-10T09:00:00.000Z");
const clock = { now: T0 };
const at = (ms: number) => {
  clock.now = new Date(T0.getTime() + ms);
};

const started: LongRunningWork[] = [];

/** A copy of the app (one process): its own id, the shared clock, the feature's collection registered. */
function instance(bootId: string, registration: Partial<LongRunningCollection> = {}): LongRunningWork {
  const work = new LongRunningWork(mongo.db, { bootId, now: () => clock.now });
  work.register({ collection: RUNS, ...registration });
  started.push(work);
  return work;
}

afterEach(async () => {
  for (const work of started.splice(0)) await work.stop();
  at(0);
});

describe("long-running work after a restart or a new version", () => {
  it("marks what a previous process left running as interrupted, with the reason the UI shows", async () => {
    const previous = instance("previous");
    await runs().insertMany([
      { _id: "leased", status: "running", ...previous.lease() },
      // Written before leases existed, or by code that never took one: nobody can be driving it.
      { _id: "unleased", status: "running" },
    ]);

    at(LEASE_MS + 1); // the previous process is gone: nothing renewed its lease
    const result = await instance("next").start();

    expect(result).toEqual({ interrupted: 2, resumed: 0 });
    for (const id of ["leased", "unleased"]) {
      const interrupted = await run(id);
      expect(interrupted.status).toBe(INTERRUPTED);
      expect(interrupted.interruptedReason).toBe(INTERRUPTED_REASON);
      expect(interrupted.interruptedAt).toEqual(clock.now);
      expect(interrupted.lease).toBeUndefined();
    }
  });

  it("leaves finished runs alone, and keeps this process's own runs alive by renewing their leases", async () => {
    const current = instance("current");
    await runs().insertMany([
      { _id: "mine", status: "running", ...current.lease() },
      { _id: "done", status: "completed", lease: { owner: "gone", expiresAt: new Date(0) } },
      { _id: "failed", status: "failed" },
    ]);

    at(LEASE_MS + 1);
    expect(await current.check()).toEqual({ interrupted: 0, resumed: 0 });

    const mine = await run("mine");
    expect(mine.status).toBe("running");
    expect(mine.lease).toEqual({ owner: "current", expiresAt: new Date(clock.now.getTime() + LEASE_MS) });
    expect((await run("done")).status).toBe("completed");
    expect((await run("failed")).status).toBe("failed");
  });

  it("leaves a run alone while another live copy of the app renews its lease, and takes it over when that stops", async () => {
    const sibling = instance("sibling");
    const me = instance("me");
    await runs().insertOne({ _id: "theirs", status: "running", ...sibling.lease() });

    at(20_000);
    await sibling.check(); // the sibling is alive: its lease now runs to 50 s
    at(40_000);
    expect(await me.check()).toEqual({ interrupted: 0, resumed: 0 });
    expect((await run("theirs")).status).toBe("running");

    at(20_000 + LEASE_MS + 1); // the sibling stopped renewing: it's gone
    expect(await me.check()).toEqual({ interrupted: 1, resumed: 0 });
    expect((await run("theirs")).status).toBe(INTERRUPTED);
  });

  it("is idempotent, and two copies starting together interrupt each run exactly once", async () => {
    await runs().insertMany([
      { _id: "a", status: "running" },
      { _id: "b", status: "running", lease: { owner: "gone", expiresAt: T0 } },
      { _id: "c", status: "running" },
    ]);
    at(1);

    const [first, second] = await Promise.all([instance("one").start(), instance("two").start()]);
    expect(first.interrupted + second.interrupted).toBe(3);

    const before = await runs().find({}).sort({ _id: 1 }).toArray();
    at(60_000);
    expect(await instance("three").check()).toEqual({ interrupted: 0, resumed: 0 });
    expect(await runs().find({}).sort({ _id: 1 }).toArray()).toEqual(before);
  });

  it("fences a process whose run another copy took over: its late write matches nothing", async () => {
    const stalled = instance("stalled");
    await runs().insertOne({ _id: "slow", status: "running", ...stalled.lease() });

    at(LEASE_MS + 1);
    await instance("other").check();
    const late = await runs().updateOne({ _id: "slow", ...stalled.held() }, { $set: { status: "completed" } });

    expect(late.matchedCount).toBe(0);
    expect((await run("slow")).status).toBe(INTERRUPTED);
  });

  it("ends this process's leases on shutdown, so the next start takes its runs over at once", async () => {
    const stopping = instance("stopping");
    await runs().insertOne({ _id: "cut-short", status: "running", ...stopping.lease() });

    await stopping.stop();
    expect(await instance("next").start()).toEqual({ interrupted: 1, resumed: 0 }); // no wait for the lease to run out
  });

  it("creates the lease index on each registered collection", async () => {
    await instance("current").start();
    const names = (await runs().indexes()).map((index) => index.name);
    expect(names).toContain(LEASE_INDEX.name);
  });

  it("uses the feature's own active statuses and reason", async () => {
    const reason = "The import stopped when the app restarted. Run it again.";
    await runs().insertMany([
      { _id: "queued", status: "queued" },
      { _id: "running", status: "running" },
      { _id: "ready", status: "ready" },
    ]);

    expect(await instance("current", { activeStatuses: ["queued", "running"], reason }).check()).toEqual({ interrupted: 2, resumed: 0 });
    expect((await run("queued")).interruptedReason).toBe(reason);
    expect((await run("running")).interruptedReason).toBe(reason);
    expect((await run("ready")).status).toBe("ready");
  });

  it("resumes each abandoned run once, in the copy that claims it, when the feature can carry on", async () => {
    await runs().insertMany([
      { _id: "x", status: "running", lease: { owner: "gone", expiresAt: T0 } },
      { _id: "y", status: "running" },
    ]);
    at(1);
    const resumedByOne = vi.fn(async (_id: string) => {});
    const resumedByTwo = vi.fn(async (_id: string) => {});
    const one = instance("one", { resume: resumedByOne });
    const two = instance("two", { resume: resumedByTwo });

    const [first, second] = await Promise.all([one.check(), two.check()]);

    expect(first.resumed + second.resumed).toBe(2);
    const calls = [...resumedByOne.mock.calls, ...resumedByTwo.mock.calls].map(([id]) => id).sort();
    expect(calls).toEqual(["x", "y"]);
    for (const [id] of resumedByOne.mock.calls) expect((await run(id)).lease?.owner).toBe("one");
    for (const [id] of resumedByTwo.mock.calls) expect((await run(id)).lease?.owner).toBe("two");
    expect((await run("x")).status).toBe("running");

    // Each is now held by a live copy: nobody resumes it again.
    expect((await one.check()).resumed + (await two.check()).resumed).toBe(0);
  });

  it("marks a run interrupted when resuming it fails", async () => {
    await runs().insertOne({ _id: "broken", status: "running" });

    const result = await instance("current", { resume: async () => Promise.reject(new Error("the Maitento run is gone")) }).check();

    expect(result.resumed).toBe(1);
    await vi.waitFor(async () => expect((await run("broken")).status).toBe(INTERRUPTED));
    expect((await run("broken")).interruptedReason).toBe(INTERRUPTED_REASON);
  });

  it("refuses a collection registered twice, or interrupted as an active status", () => {
    const work = instance("current");
    expect(() => work.register({ collection: RUNS })).toThrow(/already registered/);
    expect(() => work.register({ collection: "other", activeStatuses: [INTERRUPTED] })).toThrow(/never "interrupted"/);
    expect(() => work.register({ collection: "other", activeStatuses: [] })).toThrow(/at least one status/);
  });
});
