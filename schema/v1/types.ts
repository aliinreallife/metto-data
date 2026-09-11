// Canonical metto-data schema v1 — source of truth for importers/validators.
// SPDX-License-Identifier: AGPL-3.0-only (tooling types; data outputs are ODbL-1.0).

export type Mode = "metro" | "bus" | "tram" | "rail";

export type InfrastructureStatus =
  | "operational"
  | "under_construction"
  | "planned"
  | "temporarily_closed"
  | "permanently_closed";

export type SegmentStatus =
  | "operational"
  | "under_construction"
  | "planned"
  | "temporarily_closed";

export type StopStatus = "operational" | "under_construction" | "planned";

export type AmenityKey =
  | "wc"
  | "elevator"
  | "atm"
  | "coffeeShop"
  | "fastFood"
  | "groceryStore"
  | "freeWifi"
  | "prayerRoom"
  | "parking"
  | "police";

export type Amenities = Record<AmenityKey, boolean | null>;

export interface City {
  id: string;
  names: { fa: string; en: string };
  country: string;
  timezone: string;
  bbox?: [number, number, number, number];
  center?: { lat: number; lng: number };
}

export interface Agency {
  id: string;
  cityId: string;
  names: { fa: string; en: string };
}

export interface Network {
  id: string;
  cityId: string;
  agencyId: string;
  mode: Mode;
}

export interface Line {
  id: string;
  cityId: string;
  agencyId: string;
  networkId: string;
  mode: Mode;
  code: string;
  names: { fa: string; en: string };
  color: string;
}

export interface Station {
  id: string;
  cityId: string;
  names: { fa: string; en: string };
  location: { lat: number; lng: number };
  amenities: Amenities;
  amenitiesVerified?: boolean;
  status: InfrastructureStatus;
  sourceKeys: { upstreamKey: string };
}

export interface RouteStop {
  stationId: string;
  status: StopStatus;
}

export interface Route {
  id: string;
  cityId: string;
  lineId: string;
  branchId?: string;
  stops: RouteStop[];
}

export interface Connection {
  id: string;
  cityId: string;
  lineId: string;
  routeId: string;
  branchId?: string;
  from: string;
  to: string;
  status: SegmentStatus;
}

export type TransferConfidence = "verified" | "estimated";

export interface TransferRule {
  stationId: string;
  fromLineId: string;
  toLineId: string;
  walkSeconds: number;
  confidence?: TransferConfidence;
  fromRouteId?: string;
  toRouteId?: string;
}

export interface CityGraph {
  routes: Route[];
  segments: Connection[];
  transfers: TransferRule[];
  aliases: Record<string, string>;
}

export interface CityMeta {
  cityId: string;
  generatedAt: string;
  importer: string;
  upstream: { repository: string; commit: string; file: string };
  counts: { stations: number; lines: number; routes: number; segments: number };
  contributorIds: string[];
}
