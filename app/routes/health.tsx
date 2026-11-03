import db from "../db.server";

/**
 * GET /health — unauthenticated liveness/readiness probe for Railway's
 * health check. Returns 200 only if the DB (SQLite on the mounted volume)
 * is actually reachable, 503 otherwise. No Shopify auth here on purpose —
 * Railway's health checker isn't a merchant session.
 */
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const loader = async () => {
  try {
    await db.$queryRaw`SELECT 1`;
    return json(200, { status: "ok" });
  } catch (error) {
    console.error("Health check failed: DB unreachable", error);
    return json(503, { status: "error", error: "database unreachable" });
  }
};
