// Shared offline validation. A versioned fragment is not a complete source export.
export const MAX_OSM_BYTES = 20_000_000;
export function parseOSMExport(raw) {
  if (!Buffer.isBuffer(raw) || !raw.length || raw.length > MAX_OSM_BYTES)
    throw new Error("Empty or oversized export (limit: 20 MB)");
  let doc;
  try {
    doc = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error("Overpass response is not JSON");
  }
  if (
    !doc ||
    !Array.isArray(doc.elements) ||
    !doc.elements.length ||
    typeof doc.osm3s?.timestamp_osm_base !== "string" ||
    !Number.isFinite(Date.parse(doc.osm3s.timestamp_osm_base))
  )
    throw new Error("Missing OSM base timestamp or OSM elements");
  if (doc.remark)
    throw new Error("Overpass returned an incomplete/error remark");
  if (doc.elements.length > 50000)
    throw new Error("Unreasonably large review export");
  const seen = new Set();
  for (const entity of doc.elements) {
    if (
      !entity ||
      !["node", "way", "relation"].includes(entity.type) ||
      !Number.isSafeInteger(entity.id) ||
      entity.id <= 0 ||
      !Number.isSafeInteger(entity.version) ||
      entity.version < 1
    )
      throw new Error(
        "Export contains an unversioned/invalid OSM entity; require 'out center meta'",
      );
    const key = `${entity.type}/${entity.id}`;
    if (seen.has(key)) throw new Error("Duplicate OSM entity: " + key);
    seen.add(key);
  }
  return doc;
}
export function completeRelation(doc, id) {
  const entities = new Map(doc.elements.map((e) => [`${e.type}/${e.id}`, e]));
  const relation = entities.get(`relation/${id}`);
  if (!relation || !Array.isArray(relation.members) || !relation.members.length)
    throw new Error(
      "Expected Shiraz Line 2 relation with a nonempty member list",
    );
  const queue = [relation],
    visited = new Set();
  for (let i = 0; i < queue.length; i++) {
    const entity = queue[i],
      key = `${entity.type}/${entity.id}`;
    if (visited.has(key)) continue;
    visited.add(key);
    let refs = [];
    if (entity.type === "relation") {
      if (!Array.isArray(entity.members))
        throw new Error("Missing relation members: " + key);
      refs = entity.members;
    } else if (entity.type === "way") {
      if (!Array.isArray(entity.nodes) || !entity.nodes.length)
        throw new Error("Missing way nodes: " + key);
      refs = entity.nodes.map((ref) => ({ type: "node", ref, role: "" }));
    }
    for (const member of refs) {
      if (
        !member ||
        !["node", "way", "relation"].includes(member.type) ||
        !Number.isSafeInteger(member.ref) ||
        member.ref <= 0 ||
        typeof member.role !== "string"
      )
        throw new Error("Invalid member reference in " + key);
      const child = entities.get(`${member.type}/${member.ref}`);
      if (!child)
        throw new Error(
          `Missing referenced ${member.type}/${member.ref} in ${key}`,
        );
      if (!visited.has(`${child.type}/${child.id}`)) queue.push(child);
    }
  }
  return relation;
}
