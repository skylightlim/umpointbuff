import assert from "node:assert/strict";
import { test } from "node:test";
import { claimsAllowed } from "../src/auth.ts";
import { planSession, rolloverFor } from "../src/rules.ts";

const NOW = Date.UTC(2026, 9, 31, 12); // Sat 31 Oct 2026, 20:00 MYT

test("the rollover is Monday 00:00 MYT", () => {
  assert.equal(rolloverFor("03-11-2026"), Date.UTC(2026, 10, 1, 16)); // Tue 3 Nov -> Sun 16:00 UTC
  assert.equal(rolloverFor("02-11-2026"), Date.UTC(2026, 10, 1, 16));
  assert.equal(rolloverFor("06-11-2026"), Date.UTC(2026, 10, 1, 16));
  assert.equal(rolloverFor("32-11-2026"), null);
  assert.equal(rolloverFor("31-11-2026"), null);
  assert.equal(rolloverFor("garbage"), null);
});

test("a session is half hours, closing 15 minutes before the rollover", () => {
  const plan = planSession("03-11-2026", "17:30", 3, NOW);
  assert.ok(typeof plan !== "string");
  assert.deepEqual(plan.slots, [
    { start: "17:30", end: "18:00" },
    { start: "18:00", end: "18:30" },
    { start: "18:30", end: "19:00" },
  ]);
  assert.equal(plan.closesAt, plan.fireAt - 15 * 60_000);
});

test("refuses what UMPoint can't book", () => {
  const refused = (date: string, start: string, n: number, now = NOW) => assert.equal(typeof planSession(date, start, n, now), "string");
  refused("02-11-2026", "12:00", 2); // Monday is same-day at the rollover
  refused("07-11-2026", "12:00", 2); // Saturday
  refused("08-11-2026", "12:00", 2); // Sunday
  refused("03-11-2026", "08:30", 2); // before opening
  refused("03-11-2026", "18:30", 2); // runs past 19:00
  refused("03-11-2026", "12:15", 2); // not on a half hour
  refused("03-11-2026", "12:00", 1); // that's a solo snipe
  refused("03-11-2026", "12:00", 7); // too many
  refused("03-11-2026", "12:00", 2.5);
  refused("03-11-2026", "12:00", 2, rolloverFor("03-11-2026")! - 60_000); // tender closed
});

test("the tender is still open just before it closes", () => {
  assert.notEqual(typeof planSession("03-11-2026", "12:00", 2, rolloverFor("03-11-2026")! - 15 * 60_000 - 1), "string");
});

test("only a verified UM Workspace account signs in", () => {
  const good = { aud: "id", email: "a@siswa.um.edu.my", email_verified: true, hd: "siswa.um.edu.my" };
  const domains = "siswa.um.edu.my,um.edu.my";
  assert.ok(claimsAllowed(good, "id", domains));
  assert.ok(!claimsAllowed({ ...good, aud: "other" }, "id", domains));
  assert.ok(!claimsAllowed({ ...good, email_verified: false }, "id", domains));
  assert.ok(!claimsAllowed({ ...good, hd: undefined }, "id", domains)); // personal Google account
  assert.ok(!claimsAllowed({ ...good, email: "a@gmail.com", hd: "gmail.com" }, "id", domains));
  assert.ok(!claimsAllowed({ ...good, email: "a@evil.siswa.um.edu.my", hd: "evil.siswa.um.edu.my" }, "id", domains));
});
