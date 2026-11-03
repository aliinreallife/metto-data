/** Review-only Isfahan projection. Never emits a canonical operational dataset. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error Shared plain-Node research validator.
import { completeRelation, parseOSMExport } from "../scripts/osm-export.mjs";

type Ref = { type: "node" | "way" | "relation"; id: number; version: number };
type Entity = Ref & {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  nodes?: number[];
  members?: { type: string; ref: number; role: string }[];
};
type Source = {
  path: string;
  sha256: string;
  relationId?: number;
  relationVersion?: number;
  direction?: string;
};
type Identity = {
  id: string;
  names: { fa: string; en: string };
  aliasesFa: string[];
  sourceOrdinal: number;
  stationObject: Ref;
  stopPosition: Ref;
  boardingReview: string;
  currentServiceConfirmed: boolean;
};
const UNKNOWN_AMENITIES = {
  wc: null,
  elevator: null,
  atm: null,
  coffeeShop: null,
  fastFood: null,
  groceryStore: null,
  freeWifi: null,
  prayerRoom: null,
  parking: null,
  police: null,
};
function fail(message: string): never {
  throw Error("Isfahan candidate: " + message);
}
function load(root: string, source: Source, api = false): Entity[] {
  if (
    !source ||
    !/^sources\/review-snapshots\/[\w/.-]+\.json$/.test(source.path) ||
    source.path.split("/").includes("..") ||
    !/^[a-f0-9]{64}$/.test(source.sha256)
  )
    fail("invalid pinned source path/hash");
  const raw = readFileSync(join(root, source.path));
  if (
    raw.length > 20_000_000 ||
    createHash("sha256").update(raw).digest("hex") !== source.sha256
  )
    fail("raw source hash mismatch");
  if (!api) return parseOSMExport(raw).elements as Entity[];
  const doc = JSON.parse(raw.toString("utf8"));
  if (
    doc.version !== "0.6" ||
    typeof doc.generator !== "string" ||
    !/^https?:\/\/opendatacommons.org\/licenses\/odbl\/1-0\/$/.test(
      doc.license,
    ) ||
    !Array.isArray(doc.elements) ||
    !doc.elements.length ||
    doc.elements.length > 50000
  )
    fail("invalid original OSM API JSON");
  const seen = new Set<string>();
  for (const e of doc.elements) {
    if (
      !e ||
      !["node", "way", "relation"].includes(e.type) ||
      !Number.isSafeInteger(e.id) ||
      e.id <= 0 ||
      !Number.isSafeInteger(e.version) ||
      e.version < 1 ||
      seen.has(e.type + "/" + e.id)
    )
      fail("invalid/duplicate/unversioned source object");
    seen.add(e.type + "/" + e.id);
  }
  return doc.elements as Entity[];
}
function key(ref: Pick<Ref, "type" | "id">) {
  return ref.type + "/" + ref.id;
}
function exact(ref: Ref, entities: Map<string, Entity>): Entity {
  const e = entities.get(key(ref));
  if (!e || e.version !== ref.version)
    fail("missing or changed object " + key(ref));
  return e;
}
function point(e: Entity) {
  const lat = e.type === "node" ? e.lat : e.center?.lat,
    lng = e.type === "node" ? e.lon : e.center?.lon;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 32.51 ||
    lat > 32.81 ||
    lng < 51.46 ||
    lng > 51.87
  )
    fail("missing/out-of-city coordinate " + key(e));
  return { lat, lng };
}
function normalize(name: string) {
  return name
    .normalize("NFKC")
    .replace(/ي|ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/^ایستگاه مترو\s+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}
function distance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180,
    dl = (a.lat - b.lat) * rad,
    dn = (a.lng - b.lng) * rad;
  return (
    12742000 *
    Math.asin(
      Math.sqrt(
        Math.sin(dl / 2) ** 2 +
          Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dn / 2) ** 2,
      ),
    )
  );
}
function ref(e: Entity) {
  return {
    type: e.type,
    id: e.id,
    version: e.version,
    versionUrl: `https://www.openstreetmap.org/${e.type}/${e.id}/history/${e.version}`,
  };
}
function future(tags: Record<string, string> = {}) {
  return !!(
    tags.construction ||
    tags.proposed ||
    tags["disused:railway"] ||
    tags["abandoned:railway"] ||
    tags.disused === "yes" ||
    tags.abandoned === "yes"
  );
}

export function buildIsfahanCandidate(root: string) {
  const input = JSON.parse(
    readFileSync(join(root, "sources/isfahan/candidate-inputs.json"), "utf8"),
  ) as {
    reviewOnly: boolean;
    productionApproved: boolean;
    stationSnapshot: Source;
    routes: Source[];
    boardingReport: unknown;
  };
  const identitiesDoc = JSON.parse(
    readFileSync(join(root, "sources/isfahan/station-identities.json"), "utf8"),
  ) as {
    reviewOnly: boolean;
    productionApproved: boolean;
    stations: Identity[];
  };
  const inventory = JSON.parse(
    readFileSync(join(root, "sources/isfahan/review.json"), "utf8"),
  );
  if (
    input.reviewOnly !== true ||
    input.productionApproved !== false ||
    identitiesDoc.reviewOnly !== true ||
    identitiesDoc.productionApproved !== false ||
    inventory.productionAuthorized !== false ||
    inventory.publishingGate !== "blocked"
  )
    fail("research gates must remain blocked");
  const identities = identitiesDoc.stations;
  if (
    !Array.isArray(identities) ||
    identities.length !== 20 ||
    !Array.isArray(input.routes) ||
    input.routes.length !== 2
  )
    fail("expected the bounded 20-station, two-direction scope");
  const stationEntities = new Map(
    load(root, input.stationSnapshot).map((e) => [key(e), e]),
  );
  const ids = new Set<string>(),
    objectIds = new Set<string>(),
    stopIds = new Set<number>(),
    aliases = new Map<string, string>();
  const stations = identities.map((identity, index) => {
    if (
      !/^isfahan:station:[a-z0-9-]+$/.test(identity.id) ||
      ids.has(identity.id) ||
      objectIds.has(key(identity.stationObject)) ||
      stopIds.has(identity.stopPosition.id)
    )
      fail("duplicate or invalid identity");
    if (
      identity.sourceOrdinal !== index + 1 ||
      identity.names.fa !==
        inventory.candidateLines[0].orderedStopNamesFa[index] ||
      !identity.names.en?.trim() ||
      identity.currentServiceConfirmed !== false ||
      !["conflicting-reports", "not-station-verified"].includes(
        identity.boardingReview,
      )
    )
      fail("identity inventory/status mismatch");
    ids.add(identity.id);
    objectIds.add(key(identity.stationObject));
    stopIds.add(identity.stopPosition.id);
    const station = exact(identity.stationObject, stationEntities),
      stop = exact(identity.stopPosition, stationEntities);
    if (
      station.tags?.railway !== "station" ||
      station.tags?.station !== "subway" ||
      future(station.tags) ||
      stop.type !== "node" ||
      stop.tags?.public_transport !== "stop_position" ||
      stop.tags.railway !== "stop" ||
      future(stop.tags)
    )
      fail("station/track-stop role mismatch");
    if (!Array.isArray(identity.aliasesFa) || !identity.aliasesFa.length)
      fail("missing explicit aliases");
    const names = new Set(identity.aliasesFa.map(normalize));
    for (const name of [
      identity.names.fa,
      station.tags["name:fa"] ?? station.tags.name,
      stop.tags["name:fa"] ?? stop.tags.name,
    ])
      if (!name || !names.has(normalize(name)))
        fail("name requires a reviewed alias");
    for (const name of names) {
      if (aliases.has(name) && aliases.get(name) !== identity.id)
        fail("alias collision");
      aliases.set(name, identity.id);
    }
    const representativePoint = point(station);
    if (distance(representativePoint, point(stop)) > 300)
      fail("station and track-stop are too far apart");
    return {
      id: identity.id,
      cityId: "isfahan",
      names: identity.names,
      aliasesFa: identity.aliasesFa,
      representativePoint,
      pointKind:
        station.type === "node"
          ? "OSM station point"
          : "OSM station area bounding-box center",
      sourceRefs: { station: ref(station), stopPosition: ref(stop) },
      boardingReview: identity.boardingReview,
      currentServiceConfirmed: false,
      coordinatesIndependentlyVerified: false,
      amenities: { ...UNKNOWN_AMENITIES },
    };
  });
  const byStop = new Map(identities.map((i) => [i.stopPosition.id, i]));
  const routeIds = new Set<number>(),
    excludedWays = new Map<number, ReturnType<typeof ref>>();
  const omittedStops: {
    routeId: number;
    source: ReturnType<typeof ref>;
    name: string | null;
    role: string;
  }[] = [];
  const physicalLinks: {
    id: string;
    fromStationId: string;
    toStationId: string;
    sourceRouteId: number;
    pathNodeIds: number[];
    geometry: { lat: number; lng: number }[];
    sourceWays: ReturnType<typeof ref>[];
    passengerRoutingApproved: boolean;
  }[] = [];
  const routes = input.routes.map((source) => {
    if (
      ![5587340, 7705632].includes(source.relationId!) ||
      routeIds.has(source.relationId!)
    )
      fail("unexpected route source");
    routeIds.add(source.relationId!);
    const entities = load(root, source, true),
      byKey = new Map(entities.map((e) => [key(e), e]));
    const relation = completeRelation(
      { elements: entities },
      source.relationId,
    ) as Entity;
    if (
      relation.version !== source.relationVersion ||
      relation.tags?.type !== "route" ||
      relation.tags.route !== "subway" ||
      relation.tags.ref !== "1"
    )
      fail("route identity/version mismatch");
    const expectedDirection =
      source.relationId === 5587340 ? "southbound" : "northbound";
    if (source.direction !== expectedDirection)
      fail("route direction mismatch");
    const members = relation.members!;
    if (
      members.some(
        (m) =>
          m.role.startsWith("stop") &&
          !["stop", "stop_inactive"].includes(m.role),
      )
    )
      fail("unsupported direction-specific boarding role");
    for (const m of members.filter((m) => m.role === "stop_inactive")) {
      const e = byKey.get(m.type + "/" + m.ref)!;
      omittedStops.push({
        routeId: relation.id,
        source: ref(e),
        name: e.tags?.name ?? null,
        role: m.role,
      });
    }
    const activeStops = members.filter((m) => m.role === "stop");
    const expected =
      source.direction === "southbound"
        ? identities
        : [...identities].reverse();
    if (
      activeStops.length !== 20 ||
      activeStops.some(
        (m, i) => m.type !== "node" || m.ref !== expected[i].stopPosition.id,
      )
    )
      fail("mapped stop order differs from the inventory");
    for (const identity of expected) {
      const e = exact(identity.stopPosition, byKey);
      if (e.tags?.railway !== "stop" || future(e.tags))
        fail("unsupported mapped stop lifecycle");
    }
    const adjacency = new Map<number, Map<number, Entity>>();
    for (const m of members.filter((m) => m.type === "way")) {
      const way = byKey.get("way/" + m.ref)!;
      if (way.tags?.railway !== "subway" || future(way.tags)) {
        excludedWays.set(way.id, ref(way));
        continue;
      }
      if (way.tags?.oneway && !["no", "0", "false"].includes(way.tags.oneway))
        fail("directional way needs separate review");
      for (let i = 1; i < way.nodes!.length; i++) {
        const a = way.nodes![i - 1],
          b = way.nodes![i];
        point(byKey.get("node/" + a)!);
        point(byKey.get("node/" + b)!);
        if (a === b) fail("repeated adjacent rail node");
        for (const [from, to] of [
          [a, b],
          [b, a],
        ]) {
          const neighbors = adjacency.get(from) ?? new Map<number, Entity>();
          if (neighbors.has(to)) fail("overlapping rail edges");
          neighbors.set(to, way);
          adjacency.set(from, neighbors);
        }
      }
    }
    const terminalA = expected[0].stopPosition.id,
      terminalB = expected.at(-1)!.stopPosition.id;
    if (
      [...adjacency.values()].some((n) => n.size > 2) ||
      [...adjacency.values()].filter((n) => n.size === 1).length !== 2 ||
      adjacency.get(terminalA)?.size !== 1 ||
      adjacency.get(terminalB)?.size !== 1
    )
      fail("mapped corridor is branched, cyclic or has unexpected terminals");
    const chain = [terminalA];
    let previous: number | undefined;
    while (chain.at(-1) !== terminalB) {
      const current = chain.at(-1)!;
      const next = [...adjacency.get(current)!.keys()].filter(
        (n) => n !== previous,
      );
      if (next.length !== 1 || chain.includes(next[0]))
        fail("disconnected/cyclic mapped corridor");
      previous = current;
      chain.push(next[0]);
    }
    if (chain.length !== adjacency.size)
      fail("extra disconnected mapped track");
    const indices = expected.map((s) => chain.indexOf(s.stopPosition.id));
    if (indices.some((n, i) => n < 0 || (i > 0 && n <= indices[i - 1])))
      fail("stop sequence disagrees with physical rail continuity");
    for (let i = 1; i < expected.length; i++) {
      const pathNodeIds = chain.slice(indices[i - 1], indices[i] + 1),
        usedWays = new Map<number, Entity>();
      for (let j = 1; j < pathNodeIds.length; j++) {
        const way = adjacency.get(pathNodeIds[j - 1])!.get(pathNodeIds[j])!;
        usedWays.set(way.id, way);
      }
      physicalLinks.push({
        id: `isfahan:review-link:${source.direction}:${i}`,
        fromStationId: expected[i - 1].id,
        toStationId: expected[i].id,
        sourceRouteId: relation.id,
        pathNodeIds,
        geometry: pathNodeIds.map((id) => point(byKey.get("node/" + id)!)),
        sourceWays: [...usedWays.values()].map(ref),
        passengerRoutingApproved: false,
      });
    }
    return {
      id: `isfahan:review-route:line-1-${source.direction}`,
      lineId: "isfahan:line:1",
      direction: source.direction,
      source: ref(relation),
      mappedStationIds: activeStops.map((m) => byStop.get(m.ref)!.id),
      passengerServiceVerified: false,
    };
  });
  return {
    format: "isfahan-osm-review-graph-v1",
    cityId: "isfahan",
    reviewOnly: true,
    readyForProduction: false,
    scope: "20 mapped Line 1 station identities; existing-rail continuity only",
    sources: input,
    stations,
    routes,
    physicalLinks,
    transfers: [],
    omittedInfrastructure: {
      inactiveStopMembers: omittedStops,
      excludedNonExistingRailWays: [...excludedWays.values()],
    },
    counts: {
      stations: stations.length,
      mappedRoutes: routes.length,
      physicalLinks: physicalLinks.length,
      inactiveStopMembers: omittedStops.length,
      excludedWays: excludedWays.size,
    },
    checks: {
      osmIdentityMappingComplete: true,
      mappedRailContinuityChecked: true,
      independentOperatorTopologyVerified: false,
    },
    releaseGates: {
      boardingVerified: false,
      independentCoordinatesVerified: false,
      operatorTopologyVerified: false,
      productionApproved: false,
    },
  };
}
