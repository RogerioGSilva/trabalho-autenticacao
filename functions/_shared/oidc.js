import { PROVIDERS } from "./providers.js";

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeJson(str) {
  const bytes = base64UrlDecode(str);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function validateGoogleIdToken(idToken, { clientId, nonce }) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("formato de token invalido");

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = base64UrlDecodeJson(headerB64);
  const payload = base64UrlDecodeJson(payloadB64);

  if (header.alg !== "RS256") throw new Error("algoritmo nao suportado");

  const discoveryResponse = await fetch(PROVIDERS.google.discoveryUrl);
  if (!discoveryResponse.ok) throw new Error("falha ao obter discovery document");
  const discovery = await discoveryResponse.json();

  const jwksResponse = await fetch(discovery.jwks_uri);
  if (!jwksResponse.ok) throw new Error("falha ao obter jwks");
  const jwks = await jwksResponse.json();

  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("chave publica nao encontrada");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signedData
  );
  if (!valid) throw new Error("assinatura invalida");

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== discovery.issuer && payload.iss !== PROVIDERS.google.issuer) {
    throw new Error("emissor invalido");
  }
  if (payload.aud !== clientId) throw new Error("audiencia invalida");
  if (!payload.exp || payload.exp < now) throw new Error("token expirado");
  if (!payload.iat || payload.iat > now + 60) throw new Error("iat invalido");
  if (payload.nonce !== nonce) throw new Error("nonce invalido");

  return payload;
}