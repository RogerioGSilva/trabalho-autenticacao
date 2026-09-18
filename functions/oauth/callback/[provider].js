import { sha256Base64Url, randomToken } from "../../_shared/crypto.js";
import { parseCookies, setCookie, expireCookie } from "../../_shared/cookies.js";
import { PROVIDERS } from "../../_shared/providers.js";
import { validateGoogleIdToken } from "../../_shared/oidc.js";

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const provider = params.provider;

  if (provider !== "google" && provider !== "github") {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error || !code || !state) {
    return new Response("Requisicao invalida", { status: 400 });
  }

  const cookies = parseCookies(request);
  const txCookie = cookies["__Host-oauth-tx"];
  if (!txCookie) {
    return new Response("Transacao ausente", { status: 400 });
  }

  const txHash = await sha256Base64Url(txCookie);
  const stateHash = await sha256Base64Url(state);
  const now = Math.floor(Date.now() / 1000);

  const tx = await env.DB.prepare(
    `SELECT * FROM oauth_transactions WHERE id_hash = ? AND provider = ? AND expires_at > ?`
  )
    .bind(txHash, provider, now)
    .first();

  if (!tx) {
    return new Response("Transacao invalida ou expirada", { status: 400 });
  }

  if (tx.state_hash !== stateHash) {
    return new Response("State invalido", { status: 400 });
  }

  await env.DB.prepare(`DELETE FROM oauth_transactions WHERE id_hash = ?`)
    .bind(txHash)
    .run();

  const redirectUri = `${env.PUBLIC_BASE_URL}/oauth/callback/${provider}`;
  const config = PROVIDERS[provider];

  let identity;

  try {
    if (provider === "google") {
      const tokenResponse = await fetch(config.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code_verifier: tx.code_verifier,
        }),
      });

      if (!tokenResponse.ok) throw new Error("falha na troca de tokens");
      const tokenData = await tokenResponse.json();

      if (!tokenData.id_token) throw new Error("id_token ausente");

      const payload = await validateGoogleIdToken(tokenData.id_token, {
        clientId: env.GOOGLE_CLIENT_ID,
        nonce: tx.nonce,
      });

      identity = {
        issuer: "https://accounts.google.com",
        subject: payload.sub,
        email: payload.email || null,
        displayName: payload.name || payload.email || null,
      };
    } else {
      const tokenResponse = await fetch(config.tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
          code_verifier: tx.code_verifier,
        }),
      });

      if (!tokenResponse.ok) throw new Error("falha na troca de tokens");
      const tokenData = await tokenResponse.json();

      if (!tokenData.access_token || !/^bearer$/i.test(tokenData.token_type || "")) {
        throw new Error("access_token ausente ou invalido");
      }

      const userResponse = await fetch(config.userEndpoint, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "oauth-pages-lab",
        },
      });

      if (userResponse.status !== 200) throw new Error("falha ao consultar perfil");
      const userData = await userResponse.json();

      if (!userData.id) throw new Error("id do usuario ausente");

      identity = {
        issuer: "https://github.com",
        subject: String(userData.id),
        email: userData.email || null,
        displayName: userData.name || userData.login || null,
      };

      const revokeResponse = await fetch(
        `https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/grant`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              "Basic " + btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`),
            "Content-Type": "application/json",
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
            "User-Agent": "oauth-pages-lab",
          },
          body: JSON.stringify({ access_token: tokenData.access_token }),
        }
      );

      if (revokeResponse.status !== 204) throw new Error("falha ao revogar autorizacao");
    }
  } catch (err) {
    return new Response("Falha na autenticacao", { status: 400 });
  }

  const sessionId = randomToken();
  const sessionHash = await sha256Base64Url(sessionId);
  const sessionExpiresAt = now + 8 * 60 * 60;

  await env.DB.prepare(
    `INSERT INTO sessions (id_hash, issuer, subject, email, display_name, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      sessionHash,
      identity.issuer,
      identity.subject,
      identity.email,
      identity.displayName,
      sessionExpiresAt,
      now
    )
    .run();

  const headers = new Headers();
  headers.set("Location", env.PUBLIC_BASE_URL);
  headers.append("Set-Cookie", expireCookie("__Host-oauth-tx"));
  headers.append(
    "Set-Cookie",
    setCookie("__Host-session", sessionId, { sameSite: "Strict", maxAge: 8 * 60 * 60 })
  );
  headers.set("Cache-Control", "no-store");

  return new Response(null, { status: 302, headers });
}