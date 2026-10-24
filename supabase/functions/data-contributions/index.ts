import { createIntakeHandler } from "./handler.ts";

Deno.serve(
  createIntakeHandler({
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    githubToken: Deno.env.get("GITHUB_TOKEN") ?? "",
    githubRepository: "aliinreallife/metto-data",
    allowedOrigins: (
      Deno.env.get("ALLOWED_ORIGINS") ??
      "https://aliinreallife.github.io,https://metto.ir"
    )
      .split(",")
      .map((value) => value.trim()),
  }),
);
