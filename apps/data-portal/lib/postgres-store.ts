import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { PrivateStore } from "./intake.ts";
export const PORTAL_MIGRATION = [
  "SELECT pg_catalog.pg_advisory_xact_lock(183645901::bigint)",
  "CREATE SCHEMA IF NOT EXISTS metto_data_portal",
  "CREATE TABLE IF NOT EXISTS metto_data_portal.objects (path text PRIMARY KEY, value jsonb NOT NULL, revision bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now())",
  "ALTER TABLE metto_data_portal.objects ENABLE ROW LEVEL SECURITY",
  "REVOKE ALL ON SCHEMA metto_data_portal FROM PUBLIC",
  "REVOKE ALL ON TABLE metto_data_portal.objects FROM PUBLIC",
];
export type PortalQuery = (
  sql: string,
  params?: unknown[],
) => Promise<Record<string, unknown>[]>;
export function createPostgresStore(
  query: PortalQuery,
  migrate: () => Promise<void>,
): PrivateStore {
  let ready: Promise<void> | undefined;
  const ensure = () =>
    (ready ??= migrate().catch((error) => {
      ready = undefined;
      throw error;
    }));
  return {
    async read<T>(path: string) {
      await ensure();
      const rows = await query(
        "SELECT value, revision::text AS etag FROM metto_data_portal.objects WHERE path=$1",
        [path],
      );
      return rows[0]
        ? { value: rows[0].value as T, etag: String(rows[0].etag) }
        : null;
    },
    async write(path, value, expected) {
      await ensure();
      if (expected !== null && !/^\d+$/.test(expected)) return false;
      const rows =
        expected === null
          ? await query(
              "INSERT INTO metto_data_portal.objects(path,value) VALUES($1,$2::jsonb) ON CONFLICT(path) DO NOTHING RETURNING revision",
              [path, JSON.stringify(value)],
            )
          : await query(
              "UPDATE metto_data_portal.objects SET value=$2::jsonb,revision=revision+1,updated_at=now() WHERE path=$1 AND revision=$3::bigint RETURNING revision",
              [path, JSON.stringify(value), expected],
            );
      return rows.length === 1;
    },
    async remove(path, expected) {
      await ensure();
      if (!/^\d+$/.test(expected)) return false;
      return (
        (
          await query(
            "DELETE FROM metto_data_portal.objects WHERE path=$1 AND revision=$2::bigint RETURNING revision",
            [path, expected],
          )
        ).length === 1
      );
    },
    async paths(prefix, cursor) {
      await ensure();
      const pattern = prefix.replace(/[\\%_]/g, "\\$&") + "%";
      const rows = await query(
        "SELECT path FROM metto_data_portal.objects WHERE path LIKE $1 AND ($2::text IS NULL OR path>$2) ORDER BY path LIMIT 11",
        [pattern, cursor ?? null],
      );
      const paths = rows.slice(0, 10).map((row) => String(row.path));
      return { paths, cursor: rows.length > 10 ? paths.at(-1) : undefined };
    },
  };
}
const stores = new Map<string, PrivateStore>();
export function postgresStore(connection: string): PrivateStore {
  const key = createHash("sha256").update(connection).digest("hex");
  let store = stores.get(key);
  if (store) return store;
  const sql = neon(connection);
  store = createPostgresStore(
    (query, params) =>
      sql.query(query, params ?? []) as Promise<Record<string, unknown>[]>,
    async () => {
      await sql.transaction(
        PORTAL_MIGRATION.map((statement) => sql.query(statement, [])),
      );
    },
  );
  stores.set(key, store);
  return store;
}
