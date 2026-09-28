// cover.js：挂链、覆盖判定与回表次数
export function chainOf(index, a) {
  return (index || [])
    .filter(function (entry) { return entry[0] === a; })
    .map(function (entry) { return entry[1]; })
    .sort(function (x, y) { return x - y; });
}

export function isCovered(fields) {
  if (!Array.isArray(fields) || fields.length === 0) return false;
  return fields.every(function (name) { return name === "a" || name === "id"; });
}

export function backOf(hits, covered) {
  return covered ? 0 : hits;
}
