import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { PrivateStore } from "./intake.ts";
export const PORTAL_MIGRATION = [
  "SELECT pg_catalog.pg_advisory_xact_lock(183645901::bigint)",
  "CREATE SCHEMA IF NOT EXISTS metto_data_portal",
  "CREATE TABLE IF NOT EXISTS metto_data_portal.objects (path text PRIMARY KEY, value jsonb NOT NULL, revision bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now())",
  "ALTER TABLE metto_data_portal.objects ADD COLUMN IF NOT EXISTS expires_at timestamptz",
  "CREATE INDEX IF NOT EXISTS portal_objects_expiry ON metto_data_portal.objects(expires_at) WHERE expires_at IS NOT NULL",
  "ALTER TABLE metto_data_portal.objects ENABLE ROW LEVEL SECURITY",
  "REVOKE ALL ON SCHEMA metto_data_portal FROM PUBLIC",
  "REVOKE ALL ON TABLE metto_data_portal.objects FROM PUBLIC",
];
export type PortalQuery = (
  sql: string,
  params?: unknown[],
) => Promise<Record<string, unknown>[]>;
function expiresAt(path: string): string | null {
  if (path.startsWith("preview/"))
    return new Date(Date.now() + 7 * 86400000).toISOString();
  const day = /^limits\/(\d{4}-\d{2}-\d{2})(?:\.json|\/)/.exec(path)?.[1];
  return day ? new Date(Date.parse(day) + 3 * 86400000).toISOString() : null;
}
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
        "SELECT value, revision::text AS etag FROM metto_data_portal.objects WHERE path=$1 AND (expires_at IS NULL OR expires_at>now())",
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
              "INSERT INTO metto_data_portal.objects(path,value,expires_at) VALUES($1,$2::jsonb,$3::timestamptz) ON CONFLICT(path) DO UPDATE SET value=EXCLUDED.value,revision=objects.revision+1,updated_at=now(),expires_at=EXCLUDED.expires_at WHERE objects.expires_at<=now() RETURNING revision",
              [path, JSON.stringify(value), expiresAt(path)],
            )
          : await query(
              "UPDATE metto_data_portal.objects SET value=$2::jsonb,revision=revision+1,updated_at=now(),expires_at=$4::timestamptz WHERE path=$1 AND revision=$3::bigint AND (expires_at IS NULL OR expires_at>now()) RETURNING revision",
              [path, JSON.stringify(value), expected, expiresAt(path)],
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
        "SELECT path FROM metto_data_portal.objects WHERE path LIKE $1 AND ($2::text IS NULL OR path>$2) AND (expires_at IS NULL OR expires_at>now()) ORDER BY path LIMIT 11",
        [pattern, cursor ?? null],
      );
      const paths = rows.slice(0, 10).map((row) => String(row.path));
      return { paths, cursor: rows.length > 10 ? paths.at(-1) : undefined };
    },
    async cleanup() {
      await ensure();
      const rows = await query(
        "DELETE FROM metto_data_portal.objects WHERE path IN (SELECT path FROM metto_data_portal.objects WHERE expires_at<=now() ORDER BY expires_at LIMIT 500) RETURNING path",
      );
      return rows.length;
    },
    async canStorePhoto(bytes) {
      await ensure();
      // Stop accepting new photos well before a small project's allowance is
      // consumed. This early guard is not an exact concurrent billing quota.
      const rows = await query(
        "SELECT pg_total_relation_size('metto_data_portal.objects')+$1::bigint<=134217728 AS allowed",
        [bytes],
      );
      return rows[0]?.allowed === true;
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
