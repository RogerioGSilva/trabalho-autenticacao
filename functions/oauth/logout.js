import { sha256Base64Url } from "../_shared/crypto.js";
import { parseCookies, expireCookie } from "../_shared/cookies.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const origin = request.headers.get("Origin");
  if (origin !== env.PUBLIC_BASE_URL) {
    return new Response("Origin invalida", { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const cookies = parseCookies(request);
  const sessionCookie = cookies["__Host-session"];

  if (sessionCookie) {
    const sessionHash = await sha256Base64Url(sessionCookie);
    await env.DB.prepare(`DELETE FROM sessions WHERE id_hash = ?`).bind(sessionHash).run();
  }

  const headers = new Headers();
  headers.append("Set-Cookie", expireCookie("__Host-session"));
  headers.set("Cache-Control", "no-store");

  return new Response(null, { status: 204, headers });
}