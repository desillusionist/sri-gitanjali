/**
 * "Sign in with GitHub" for the Kīrtan Guide admin tools.
 *
 * The site is static, and GitHub only hands out sign-in keys in exchange for a secret that must
 * never reach a browser. This small Cloudflare Worker keeps that secret and does the exchange:
 *
 *   GET  /login?return=<page>   → sends the visitor to GitHub to approve the Kīrtan Guide app
 *   GET  /callback              → GitHub comes back here; the Worker swaps the code for a key and
 *                                 returns to <page>#admin_token=… (the fragment never reaches a server)
 *   POST /refresh               → renews an expired key with its refresh key
 *
 * What the key may do is decided on GitHub: the GitHub App is installed on this one repository with
 * "Contents: read and write", and a key only works for people who can already write to it.
 *
 * Settings (wrangler secrets / vars): GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, STATE_SECRET,
 * ALLOWED_ORIGINS (comma-separated, e.g. "https://desillusionist.github.io,http://localhost:5173").
 */

const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const encoder = new TextEncoder();

const base64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64url = (value) => atob(value.replace(/-/g, "+").replace(/_/g, "/"));

async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
}

function isAllowedReturn(url, env) {
  try {
    return allowedOrigins(env).includes(new URL(url).origin);
  } catch {
    return false;
  }
}

function cors(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
}

async function exchange(env, params) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "kirtan-guide-admin" },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, ...params }),
  });
  return response.json();
}

function backTo(returnUrl, values) {
  const url = new URL(returnUrl);
  url.hash = new URLSearchParams(values).toString();
  return Response.redirect(url.toString(), 302);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/login") {
      const returnUrl = url.searchParams.get("return") || "";
      if (!isAllowedReturn(returnUrl, env)) return new Response("This page may not sign in here.", { status: 400 });
      const payload = base64url(encoder.encode(JSON.stringify({ r: returnUrl, t: Date.now(), n: crypto.randomUUID() })));
      const state = `${payload}.${await sign(payload, env.STATE_SECRET)}`;
      const authorize = new URL("https://github.com/login/oauth/authorize");
      authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      authorize.searchParams.set("redirect_uri", `${url.origin}/callback`);
      authorize.searchParams.set("state", state);
      return Response.redirect(authorize.toString(), 302);
    }

    if (url.pathname === "/callback") {
      const [payload, signature] = (url.searchParams.get("state") || "").split(".");
      if (!payload || signature !== (await sign(payload, env.STATE_SECRET))) return new Response("The sign-in link is not valid. Please start again.", { status: 400 });
      const { r: returnUrl, t: time } = JSON.parse(fromBase64url(payload));
      if (!isAllowedReturn(returnUrl, env) || Date.now() - time > STATE_MAX_AGE_MS) return new Response("The sign-in took too long. Please start again.", { status: 400 });
      const code = url.searchParams.get("code");
      if (!code) return backTo(returnUrl, { admin_error: url.searchParams.get("error_description") || "Sign-in was cancelled." });
      const result = await exchange(env, { code });
      if (!result.access_token) return backTo(returnUrl, { admin_error: result.error_description || "GitHub did not give a key." });
      return backTo(returnUrl, {
        admin_token: result.access_token,
        refresh_token: result.refresh_token || "",
        expires_in: String(result.expires_in || ""),
      });
    }

    if (url.pathname === "/refresh") {
      const headers = cors(request, env);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
      if (request.method !== "POST" || !headers["Access-Control-Allow-Origin"]) return new Response("Not allowed.", { status: 403 });
      const { refresh_token: refreshToken } = await request.json().catch(() => ({}));
      if (!refreshToken) return new Response(JSON.stringify({ error: "missing refresh_token" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
      const result = await exchange(env, { grant_type: "refresh_token", refresh_token: refreshToken });
      return new Response(JSON.stringify(result), { status: result.access_token ? 200 : 401, headers: { ...headers, "Content-Type": "application/json" } });
    }

    return new Response("Kīrtan Guide sign-in service.", { status: 200 });
  },
};
