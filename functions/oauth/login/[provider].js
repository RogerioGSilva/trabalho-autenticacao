import { randomToken, sha256Base64Url } from "../../_shared/crypto.js";
import { setCookie } from "../../_shared/cookies.js";
import { PROVIDERS } from "../../_shared/providers.js";

export async function onRequestGet(context) {
  const { params, env } = context;
  const provider = params.provider;

  if (provider !== "google" && provider !== "github") {
    return new Response("Not found", { status: 404 });
  }

  const config = PROVIDERS[provider];

  const txId = randomToken();
  const state = randomToken();
  const codeVerifier = randomToken();
  const nonce = provider === "google" ? randomToken() : null;

  const codeChallenge = await sha256Base64Url(codeVerifier);
  const txHash = await sha256Base64Url(txId);
  const stateHash = await sha256Base64Url(state);

  const expiresAt = Math.floor(Date.now() / 1000) + 600;

  await env.DB.prepare(
    `INSERT INTO oauth_transactions (id_hash, provider, state_hash, nonce, code_verifier, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(txHash, provider, stateHash, nonce, codeVerifier, expiresAt)
    .run();

  const redirectUri = `${env.PUBLIC_BASE_URL}/oauth/callback/${provider}`;
  const clientId = provider === "google" ? env.GOOGLE_CLIENT_ID : env.GITHUB_CLIENT_ID;

  const authUrl = new URL(config.authEndpoint);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  if (provider === "google") {
    authUrl.searchParams.set("scope", config.scope);
    authUrl.searchParams.set("nonce", nonce);
  }

  const headers = new Headers();
  headers.set("Location", authUrl.toString());
  headers.append(
    "Set-Cookie",
    setCookie("__Host-oauth-tx", txId, { sameSite: "Lax", maxAge: 600 })
  );
  headers.set("Cache-Control", "no-store");

  return new Response(null, { status: 302, headers });
}