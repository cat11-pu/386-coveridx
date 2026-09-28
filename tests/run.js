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

check("chainOf returns a list", () => {
  assert.ok(Array.isArray(chainOf([[5, 3]], 5)));
});

check("isCovered returns a boolean", () => {
  assert.strictEqual(typeof isCovered(["a"]), "boolean");
});

check("backOf returns a number", () => {
  assert.strictEqual(typeof backOf(2, false), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
