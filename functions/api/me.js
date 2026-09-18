import { sha256Base64Url } from "../_shared/crypto.js";
import { parseCookies } from "../_shared/cookies.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const sessionCookie = cookies["__Host-session"];

  if (!sessionCookie) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const sessionHash = await sha256Base64Url(sessionCookie);
  const now = Math.floor(Date.now() / 1000);

  const session = await env.DB.prepare(
    `SELECT * FROM sessions WHERE id_hash = ? AND expires_at > ?`
  )
    .bind(sessionHash, now)
    .first();

  if (!session) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    {
      issuer: session.issuer,
      email: session.email,
      displayName: session.display_name,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}