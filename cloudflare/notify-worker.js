/**
 * Our Space · notification sender (Cloudflare Worker, free plan)
 *
 * The app's data stays in Firebase. This tiny service only does one job:
 * when one of you does something (a message, a heartbeat, a love note),
 * your phone asks it to tap the other phone on the shoulder.
 *
 * Privacy: notifications never contain message text, only things like
 * "New message from Tony". The service keeps nothing.
 *
 * Security: every request must carry the caller's Firebase sign-in token.
 * It's verified against Google's public keys, and the email must be one
 * of the two in ALLOWED_USERS. A caller can only notify the other person.
 *
 * Settings (Cloudflare > Workers > ourspace-notify > Settings > Variables):
 *   PROJECT_ID               Firebase project id
 *   SPACE_ID                 "us"
 *   ALLOWED_USERS            "email:userId,email:userId"
 *   NAMES                    "userId:Name,userId:Name"
 *   ALLOWED_ORIGINS          "https://you.github.io,..."
 *   APP_URL                  where a tapped notification opens
 *   TIMEZONE                 for daily capsule/note openings, e.g. "UTC"
 *   FIREBASE_SERVICE_ACCOUNT (secret) the Firebase private key JSON
 *
 * Endpoints:
 *   GET  /        health check
 *   POST /notify  { kind }   -> notifies the other person
 * Cron (daily): notifies you both when a time capsule or dated note opens.
 */

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = "https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore";

const KINDS = {
  message: { body: (n) => `New message from ${n}`, route: "chat" },
  photo: { body: (n) => `${n} sent you a photo`, route: "chat" },
  voice: { body: (n) => `${n} sent you a voice note`, route: "chat" },
  nudge: { body: (n) => `${n} is thinking of you ♥`, route: "chat" },
  note: { body: (n) => `${n} left you a love note`, route: "notes" },
  reason: { body: (n) => `${n} added a reason to the love jar`, route: "together" },
  capsule: { body: (n) => `${n} sealed a time capsule for you`, route: "together" },
  memory: { body: (n) => `${n} added a new memory`, route: "memories" },
  call: { body: (n) => `${n} is calling you`, route: "chat", urgent: true },
};

let jwks = { keys: null, until: 0 };
let google = { token: null, until: 0 };
const recent = new Map(); // userId -> timestamps (simple per-instance rate limit)

// ------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------
const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function bytesToB64url(bytes) {
  let bin = "";
  new Uint8Array(bytes).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const jsonB64url = (obj) => bytesToB64url(enc.encode(JSON.stringify(obj)));

function parsePairs(text) {
  const out = {};
  String(text || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((p) => {
      const i = p.lastIndexOf(":");
      if (i > 0) out[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
    });
  return out;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ------------------------------------------------------------------
// Verify the caller's Firebase sign-in token
// ------------------------------------------------------------------
async function googleKeys() {
  if (jwks.keys && Date.now() < jwks.until) return jwks.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new HttpError(503, "Couldn't fetch Google sign-in keys");
  const body = await res.json();
  const maxAge = Number((res.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 3600);
  jwks = { keys: body.keys || [], until: Date.now() + Math.min(maxAge, 6 * 3600) * 1000 };
  return jwks.keys;
}

async function verifyIdToken(token, projectId) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new HttpError(401, "Not signed in");
  let header, claims;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    throw new HttpError(401, "Bad sign-in token");
  }
  if (header.alg !== "RS256" || !header.kid) throw new HttpError(401, "Bad sign-in token");
  const jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new HttpError(401, "Unknown signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new HttpError(401, "Bad signature");
  const t = now();
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) throw new HttpError(401, "Wrong project");
  if (!claims.sub || typeof claims.exp !== "number" || claims.exp < t - 30) throw new HttpError(401, "Sign-in expired");
  if (typeof claims.iat !== "number" || claims.iat > t + 300) throw new HttpError(401, "Bad sign-in time");
  return claims;
}

// ------------------------------------------------------------------
// Talk to Google as the Firebase project (service account)
// ------------------------------------------------------------------
function pemToBytes(pem) {
  const body = String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

async function googleToken(env) {
  if (google.token && Date.now() < google.until) return google.token;
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new HttpError(503, "FIREBASE_SERVICE_ACCOUNT secret is not set yet");
  let sa;
  try {
    sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    throw new HttpError(503, "FIREBASE_SERVICE_ACCOUNT isn't valid JSON");
  }
  const t = now();
  const unsigned = `${jsonB64url({ alg: "RS256", typ: "JWT" })}.${jsonB64url({
    iss: sa.client_email,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: t,
    exp: t + 3600,
  })}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToBytes(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned));
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${bytesToB64url(sig)}` }),
  });
  if (!res.ok) throw new HttpError(503, `Google sign-in for the service failed (${res.status})`);
  const body = await res.json();
  google = { token: body.access_token, until: Date.now() + (Number(body.expires_in || 3600) - 120) * 1000 };
  return google.token;
}

// Firestore REST values -> plain JS
function decode(v) {
  if (!v || typeof v !== "object") return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields);
  return undefined;
}
function decodeFields(fields) {
  const out = {};
  Object.entries(fields || {}).forEach(([k, v]) => (out[k] = decode(v)));
  return out;
}

const docsRoot = (env) => `projects/${env.PROJECT_ID}/databases/(default)/documents`;

async function firestoreGet(env, path) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${docsRoot(env)}/${path}`, {
    headers: { Authorization: `Bearer ${await googleToken(env)}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, `Couldn't read ${path} (${res.status})`);
  return decodeFields((await res.json()).fields);
}

async function removeTokens(env, userId, tokens) {
  if (!tokens.length) return;
  const name = `${docsRoot(env)}/spaces/${env.SPACE_ID}/meta/push`;
  await fetch(`https://firestore.googleapis.com/v1/${docsRoot(env)}:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await googleToken(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [
        {
          transform: {
            document: name,
            fieldTransforms: [{ fieldPath: `\`${userId}\`.tokens`, removeAllFromArray: { values: tokens.map((t) => ({ stringValue: t })) } }],
          },
        },
      ],
    }),
  });
}

async function runQuery(env, collection, field, value) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${docsRoot(env)}/spaces/${env.SPACE_ID}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await googleToken(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } },
        limit: 50,
      },
    }),
  });
  if (!res.ok) throw new HttpError(502, `Couldn't query ${collection} (${res.status})`);
  return (await res.json()).filter((r) => r.document).map((r) => decodeFields(r.document.fields));
}

// ------------------------------------------------------------------
// Sending
// ------------------------------------------------------------------
async function isActive(env, userId) {
  const presence = (await firestoreGet(env, `spaces/${env.SPACE_ID}/meta/presence`)) || {};
  const p = presence[userId];
  const ms = Date.now();
  if (typeof p === "number") return ms - p < 70 * 1000;
  return Boolean(p && p.on && ms - Number(p.t || 0) < 90 * 1000);
}

async function pushTo(env, userId, { body, route, tag, urgent }) {
  const push = (await firestoreGet(env, `spaces/${env.SPACE_ID}/meta/push`)) || {};
  const tokens = [...new Set((push[userId] && push[userId].tokens) || [])].filter((t) => typeof t === "string" && t.length > 20);
  if (!tokens.length) return { sent: 0, reason: "no devices" };
  const access = await googleToken(env);
  const dead = [];
  let sent = 0;
  await Promise.all(
    tokens.map(async (token) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${env.PROJECT_ID}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            webpush: {
              headers: { Urgency: urgent ? "high" : "normal", TTL: urgent ? "60" : "86400" },
              data: { title: "Our Space", body, route, tag: tag || route, url: `${env.APP_URL}#/${route}` },
            },
          },
        }),
      });
      if (res.ok) sent++;
      else if (res.status === 404 || res.status === 400) {
        const text = await res.text();
        if (/UNREGISTERED|registration-token-not-registered|not a valid FCM registration token|INVALID_ARGUMENT/i.test(text)) dead.push(token);
      }
    })
  );
  if (dead.length) await removeTokens(env, userId, dead);
  return { sent, removed: dead.length };
}

function rateOk(userId) {
  const t = Date.now();
  const list = (recent.get(userId) || []).filter((x) => t - x < 60 * 1000);
  list.push(t);
  recent.set(userId, list);
  return list.length <= 40;
}

function corsHeaders(env, origin) {
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    allowed: allowed.includes(origin) ? "1" : "",
  };
}

function json(data, status, headers) {
  const h = { ...headers, "Content-Type": "application/json" };
  delete h.allowed;
  return new Response(JSON.stringify(data), { status, headers: h });
}

async function handleNotify(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const claims = await verifyIdToken(auth.replace(/^Bearer\s+/i, ""), env.PROJECT_ID);
  const users = parsePairs(env.ALLOWED_USERS);
  const from = users[String(claims.email || "").toLowerCase()];
  if (!from) throw new HttpError(403, "This account isn't part of the space");
  const to = Object.values(users).find((u) => u !== from);
  let payload = {};
  try {
    payload = await request.json();
  } catch {}
  const kind = KINDS[payload.kind] ? payload.kind : null;
  if (!kind || !to) throw new HttpError(400, "Unknown notification");
  if (!rateOk(from)) throw new HttpError(429, "Slow down a little");
  // No buzz while they're looking at the app anyway (calls always ring).
  if (!KINDS[kind].urgent && (await isActive(env, to))) return { skipped: "they're in the app" };
  const name = parsePairs(env.NAMES)[from] || "Your love";
  return pushTo(env, to, { body: KINDS[kind].body(name), route: KINDS[kind].route, tag: kind, urgent: KINDS[kind].urgent });
}

// Daily: capsules and dated love notes that open today.
async function dailyOpenings(env) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: env.TIMEZONE || "UTC" }).format(new Date());
  const users = Object.values(parsePairs(env.ALLOWED_USERS));
  const names = parsePairs(env.NAMES);
  const capsules = await runQuery(env, "capsules", "openOn", today);
  for (const c of capsules) {
    for (const u of users) {
      await pushTo(env, u, { body: `A time capsule is ready to open: “${c.title || "for you"}”`, route: "together", tag: `capsule-${c.id}` });
    }
  }
  const notes = await runQuery(env, "notes", "unlockDate", today);
  for (const n of notes) {
    const to = users.find((u) => u !== n.author);
    if (to && n.locked) await pushTo(env, to, { body: `A sealed note from ${names[n.author] || "your love"} just opened`, route: "notes", tag: `note-${n.id}` });
  }
  return { capsules: capsules.length, notes: notes.length };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(env, origin);
    if (request.method === "OPTIONS") {
      const h = { ...cors };
      delete h.allowed;
      return new Response(null, { status: 204, headers: h });
    }
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, service: "ourspace-notify", ready: Boolean(env.FIREBASE_SERVICE_ACCOUNT) }, 200, cors);
    }
    if (request.method !== "POST" || url.pathname !== "/notify") return json({ error: "Not found" }, 404, cors);
    if (!cors.allowed) return json({ error: "Not allowed from this site" }, 403, cors);
    try {
      return json(await handleNotify(request, env), 200, cors);
    } catch (err) {
      return json({ error: err.message || "Something went wrong" }, err.status || 500, cors);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(dailyOpenings(env).catch((err) => console.error("daily openings failed", err)));
  },

  // Exposed for tests only.
  _test: { verifyIdToken, parsePairs, decodeFields, dailyOpenings, reset: () => ((jwks = { keys: null, until: 0 }), (google = { token: null, until: 0 }), recent.clear()) },
};
