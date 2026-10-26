import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
const issuer = "https://token.actions.githubusercontent.com";
const keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
export async function verifyWorkflowToken(
  token: string,
  audience: string,
  keySet: JWTVerifyGetKey = keys,
) {
  const { payload } = await jwtVerify(token, keySet, {
    issuer,
    audience,
    algorithms: ["RS256"],
    maxTokenAge: "10m",
    requiredClaims: ["exp", "iat", "nbf"],
  });
  if (
    payload.repository !== "aliinreallife/metto-data" ||
    payload.repository_id !== "1366364947" ||
    payload.repository_owner_id !== "91134550" ||
    payload.ref !== "refs/heads/main" ||
    payload.workflow_ref !==
      "aliinreallife/metto-data/.github/workflows/portal-maintenance.yml@refs/heads/main" ||
    !["schedule", "workflow_dispatch"].includes(String(payload.event_name))
  )
    throw Error("workflow_not_allowed");
  return true;
}

/** Only the repository owner's default-branch approval workflow can apply data. */
export async function verifyReviewWorkflowToken(
  token: string,
  audience: string,
  keySet: JWTVerifyGetKey = keys,
) {
  const { payload } = await jwtVerify(token, keySet, {
    issuer,
    audience,
    algorithms: ["RS256"],
    maxTokenAge: "10m",
    requiredClaims: ["exp", "iat", "nbf"],
  });
  if (
    payload.repository !== "aliinreallife/metto-data" ||
    payload.repository_id !== "1366364947" ||
    payload.repository_owner_id !== "91134550" ||
    payload.ref !== "refs/heads/main" ||
    payload.workflow_ref !==
      "aliinreallife/metto-data/.github/workflows/community-review.yml@refs/heads/main" ||
    payload.event_name !== "issues" ||
    payload.actor !== "aliinreallife"
  )
    throw Error("review_workflow_not_allowed");
  return { actor: "aliinreallife" };
}
