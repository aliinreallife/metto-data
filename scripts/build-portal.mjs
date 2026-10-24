import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const receiver = process.env.CONTRIBUTIONS_ENDPOINT;
if (!receiver)
  throw new Error(
    "Set CONTRIBUTIONS_ENDPOINT to the deployed Supabase Edge Function URL before publishing",
  );
const url = new URL(receiver);
if (
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  !(
    url.protocol === "https:" ||
    (url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname))
  )
)
  throw new Error(
    "Use a public HTTPS receiver URL without credentials or query parameters",
  );
const out = resolve(root, "dist/portal");
await mkdir(out, { recursive: true });
await cp(resolve(root, "apps/data-portal/public"), out, { recursive: true });
await writeFile(
  resolve(out, "config.js"),
  `// Public receiver address; never a secret.\nwindow.METTO_CONTRIBUTIONS_ENDPOINT = ${JSON.stringify(url.href)};\n`,
);
await writeFile(resolve(out, ".nojekyll"), "");
console.log("Portal built in dist/portal");
