import assert from "node:assert";
import { chainOf, isCovered, backOf } from "../cover.js";
import { step, close } from "../coverrun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { rows: [], index: [], lookups: [], clears: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "put", key: 1, a: 5, b: 7 }],
  bad_key_code: "E_BAD_KEY", bad_value_code: "E_BAD_VALUE",
  bad_fields_code: "E_BAD_FIELDS", dup_code: "E_DUP_KEY",
  missing_code: "E_NO_ROW", no_entry_code: "E_NO_ENTRY",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("chainOf gives the keys hanging on a, ascending", () => {
  assert.deepStrictEqual(chainOf([[5, 3], [4, 9], [5, 1]], 5), [1, 3]);
  assert.deepStrictEqual(chainOf([[5, 3]], 4), []);
});

check("isCovered only for the two index-carried fields", () => {
  assert.strictEqual(isCovered(["a", "id"]), true);
  assert.strictEqual(isCovered(["a", "b"]), false);
  assert.strictEqual(isCovered([]), false);
});

check("backOf is zero when covered, else the hit count", () => {
  assert.strictEqual(backOf(2, true), 0);
  assert.strictEqual(backOf(2, false), 2);
});

check("step serves within budget and ledgers the rest, close catches up", () => {
  const spec = Object.assign({}, base, { events: [
    { id: 1, kind: "put", key: 1, a: 5, b: 7 },
    { id: 2, kind: "del", key: 1 }
  ] });
  const first = step(spec);
  assert.strictEqual(first.served, 1);
  assert.deepStrictEqual(first.state.rows, [[1, 5, 7]]);
  assert.deepStrictEqual(first.state.ledger, [["del", 1]]);
  const done = close(Object.assign({}, spec, { state: first.state }));
  assert.strictEqual(done.catchup, 1);
  assert.deepStrictEqual(done.state.rows, []);
  assert.deepStrictEqual(done.state.clears, [[1, 5]]);
});

check("render counts events and serves the first round", () => {
  const view = render(base);
  assert.strictEqual(view.count_events, 1);
  assert.strictEqual(view.served_first, 1);
  assert.strictEqual(view.replay_new, 0);
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
