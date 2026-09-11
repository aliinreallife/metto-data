#!/usr/bin/env node
// Scaffold: emit a contributions/pending/<uuid>.json template for a given entity.
// Usage: pnpm contributions:new --city tehran --entity tehran:station:tajrish --by github_username
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";

const { values } = parseArgs({
  options: {
    city: { type: "string", default: "tehran" },
    entity: { type: "string" },
    by: { type: "string", default: "github_username" },
  },
});

if (!values.entity) {
  console.error("usage: pnpm contributions:new --entity tehran:station:tajrish [--city tehran] [--by <id>]");
  process.exit(1);
}

const template = {
  id: randomUUID(),
  city: values.city,
  entityType: "station",
  entityId: values.entity,
  changeType: "update",
  operations: [{ op: "set", path: "/amenities/elevator", value: true, note: "describe evidence here" }],
  submittedBy: values.by,
  submittedAt: new Date().toISOString(),
  status: "pending",
};
console.log(JSON.stringify(template, null, 2));
