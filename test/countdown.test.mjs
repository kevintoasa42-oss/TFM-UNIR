import test from "node:test";
import assert from "node:assert/strict";
import { createCountdownDeadline, remainingSeconds } from "../src/features/game/countdown.ts";

test("contador: una diferencia de cinco segundos entre los relojes no agrega tiempo a la ronda", () => {
  const deadline = createCountdownDeadline(25_000, 5_000, 1000);
  assert.equal(remainingSeconds(deadline, 1000), 20);
  assert.equal(remainingSeconds(deadline, 4000), 17);
  assert.equal(remainingSeconds(deadline, 21_000), 0);
  assert.equal(remainingSeconds(deadline, 25_000), 0);
});

test("contador: una reconexión conserva el tiempo restante y una nueva ronda reinicia el plazo", () => {
  const resumed = createCountdownDeadline(25_000, 15_000, 50_000);
  assert.equal(remainingSeconds(resumed, 50_000), 10);
  const next = createCountdownDeadline(50_000, 30_000, 55_000);
  assert.equal(remainingSeconds(next, 55_000), 20);
  assert.equal(remainingSeconds(createCountdownDeadline(null, 30_000, 55_000), 55_000), 0);
  assert.equal(remainingSeconds(createCountdownDeadline(25_000, 26_000, 60_000), 60_000), 0);
});
