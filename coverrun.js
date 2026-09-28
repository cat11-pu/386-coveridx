// coverrun.js：按处理预算处理事件，用不完的压在账上，收尾把账做完
import { chainOf, isCovered, backOf } from "./cover.js";

const FIELD_NAMES = ["a", "b", "id"];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function codesOf(spec) {
  const src = spec || {};
  return {
    badEvent: src.event_error_code || "E_BAD_EVENT",
    badKey: src.bad_key_code || "E_BAD_KEY",
    badValue: src.bad_value_code || "E_BAD_VALUE",
    badFields: src.bad_fields_code || "E_BAD_FIELDS",
    dup: src.dup_code || "E_DUP_KEY",
    missing: src.missing_code || "E_NO_ROW",
    noEntry: src.no_entry_code || "E_NO_ENTRY"
  };
}

function cloneState(state) {
  const src = state || {};
  return {
    rows: (src.rows || []).map(function (row) { return [row[0], row[1], row[2]]; }),
    index: (src.index || []).map(function (entry) { return [entry[0], entry[1]]; }),
    lookups: (src.lookups || []).map(function (row) { return [row[0], row[1], row[2], row[3]]; }),
    clears: (src.clears || []).map(function (pair) { return [pair[0], pair[1]]; }),
    ledger: (src.ledger || []).map(function (entry) { return Array.isArray(entry) ? entry.slice() : entry; }),
    applied: (src.applied || []).map(function (entry) { return Array.isArray(entry) ? entry.slice() : entry; })
  };
}

// 事件的描述符：既作为压在账上的请求形态，也作为已处理记录，重放靠它去重。
function descriptorOf(event) {
  if (!event || typeof event !== "object") return ["?"];
  if (event.kind === "put") return ["put", event.key, event.a, event.b];
  if (event.kind === "del") return ["del", event.key];
  if (event.kind === "get") {
    return ["get", event.a, (Array.isArray(event.fields) ? event.fields : []).join(",")];
  }
  return ["?"];
}

function eventFromLedger(entry) {
  if (entry[0] === "put") return { kind: "put", key: entry[1], a: entry[2], b: entry[3] };
  if (entry[0] === "del") return { kind: "del", key: entry[1] };
  if (entry[0] === "get") {
    return { kind: "get", a: entry[1],
             fields: String(entry[2] == null ? "" : entry[2]).split(",").filter(Boolean) };
  }
  return null;
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function applyEvent(state, event, spec) {
  const code = codesOf(spec);
  if (!event || typeof event !== "object") throw fail(code.badEvent);
  if (event.kind === "put") {
    if (event.key === undefined || event.a === undefined || event.b === undefined) {
      throw fail(code.badEvent);
    }
    if (!isPositiveInt(event.key)) throw fail(code.badKey);
    if (!Number.isInteger(event.a) || !Number.isInteger(event.b)) throw fail(code.badValue);
    if (state.rows.some(function (row) { return row[0] === event.key; })) throw fail(code.dup);
    const row = [event.key, event.a, event.b];
    let at = state.rows.findIndex(function (old) { return old[0] > event.key; });
    if (at === -1) state.rows.push(row); else state.rows.splice(at, 0, row);
    const entry = [event.a, event.key];
    at = state.index.findIndex(function (old) {
      return old[0] > event.a || (old[0] === event.a && old[1] > event.key);
    });
    if (at === -1) state.index.push(entry); else state.index.splice(at, 0, entry);
    return;
  }
  if (event.kind === "del") {
    if (event.key === undefined) throw fail(code.badEvent);
    if (!isPositiveInt(event.key)) throw fail(code.badKey);
    const at = state.rows.findIndex(function (row) { return row[0] === event.key; });
    if (at === -1) throw fail(code.missing);
    const a = state.rows[at][1];
    state.rows.splice(at, 1);
    const idx = state.index.findIndex(function (entry) {
      return entry[0] === a && entry[1] === event.key;
    });
    if (idx !== -1) state.index.splice(idx, 1);
    state.clears.push([event.key, a]);
    return;
  }
  if (event.kind === "get") {
    if (event.a === undefined || event.fields === undefined) throw fail(code.badEvent);
    if (!Number.isInteger(event.a)) throw fail(code.badValue);
    if (!Array.isArray(event.fields) || event.fields.length === 0 ||
        !event.fields.every(function (name) { return FIELD_NAMES.indexOf(name) !== -1; })) {
      throw fail(code.badFields);
    }
    const chain = chainOf(state.index, event.a);
    if (chain.length === 0) throw fail(code.noEntry);
    const covered = isCovered(event.fields);
    const hits = chain.length;
    state.lookups.push([event.a, hits, backOf(hits, covered), covered ? 1 : 0]);
    return;
  }
  throw fail(code.badEvent);
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  let budget = Number.isInteger(spec.budget) ? spec.budget : events.length;
  const done = {};
  state.applied.forEach(function (entry) { done[JSON.stringify(entry)] = true; });
  let served = 0;
  let judged = 0;
  events.forEach(function (event) {
    const marker = JSON.stringify(descriptorOf(event));
    if (done[marker]) return;
    judged += 1;
    if (budget <= 0) {
      state.ledger.push(descriptorOf(event));
      return;
    }
    budget -= 1;
    applyEvent(state, event, spec);
    state.applied.push(descriptorOf(event));
    done[marker] = true;
    served += 1;
  });
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger,
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    const entry = state.ledger.shift();
    applyEvent(state, eventFromLedger(entry), spec);
    state.applied.push(entry);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
