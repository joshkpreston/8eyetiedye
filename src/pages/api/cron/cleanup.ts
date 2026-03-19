export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/**
 * Design expiry cleanup — runs daily via cron trigger (0 3 * * *)
 * Deletes expired unpurchased designs from D1 and R2.
 * Also callable manually via POST for testing.
 */
export const POST: APIRoute = async () => {
  return runCleanup();
};

async function runCleanup(): Promise<Response> {
  let deletedDesigns = 0;
  let deletedR2 = 0;
  let errors = 0;

  try {
    // Find expired, unpurchased designs
    const expired = await env.DB.prepare(
      `SELECT id FROM designs
       WHERE expires_at < datetime('now')
         AND purchased_at IS NULL
       LIMIT 500`,
    ).all();

    const ids = expired.results.map(
      (r: Record<string, unknown>) => r.id as string,
    );

    if (ids.length === 0) {
      return json({ message: "No expired designs to clean up", deletedDesigns: 0, deletedR2: 0 }, 200);
    }

    // Delete R2 objects
    for (const id of ids) {
      try {
        await env.DESIGNS.delete(`designs/${id}.png`);
        deletedR2++;
      } catch {
        errors++;
      }
    }

    // Delete from D1 in batches (SQLite has a limit on IN clause size)
    const batchSize = 50;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const placeholders = batch.map(() => "?").join(",");
      await env.DB.prepare(
        `DELETE FROM designs WHERE id IN (${placeholders}) AND purchased_at IS NULL`,
      )
        .bind(...batch)
        .run();
      deletedDesigns += batch.length;
    }

    // Clean up orphaned KV design entries
    for (const id of ids) {
      try {
        await env.SESSIONS.delete(`design:${id}`);
      } catch {
        // KV entries may already be expired via TTL
      }
    }

    console.log(
      `Cleanup complete: ${deletedDesigns} designs deleted, ${deletedR2} R2 objects removed, ${errors} errors`,
    );
  } catch (err) {
    console.error("Cleanup failed:", err);
    return json({ error: "Cleanup failed", details: String(err) }, 500);
  }

  return json({ deletedDesigns, deletedR2, errors }, 200);
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
