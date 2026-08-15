// API tồn kho — Cloudflare Worker (kèm static assets từ ./public).
// Cần: KV binding `TONKHO` (id trong wrangler.jsonc), secret runtime `PASSWORD`.
//
//   POST /api/login  {password}          -> {token}   (hạn 7 ngày, khóa IP 60s sau 3 lần sai)
//   GET  /api/data   (Bearer token)      -> {updated, items}
//   PUT  /api/data   (Bearer token) body -> lưu {updated, items} vào KV, đồng bộ cho mọi người
//
// Request khớp file trong ./public do Cloudflare serve thẳng; phần còn lại rơi vào fetch() dưới đây.

import { SEED } from "./seed.js";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const LOCK_SECONDS = 60;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json;charset=utf-8", "cache-control": "no-store" },
  });

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(env) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("tonkho-v1|" + env.PASSWORD));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function signExp(env, exp) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), new TextEncoder().encode(String(exp)));
  return b64url(sig);
}

async function isAuthed(env, request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const [expS, sig] = token.split(".");
  const exp = Number(expS);
  if (!exp || exp < Date.now() || !sig) return false;
  return sig === (await signExp(env, expS));
}

async function login(env, request) {
  const ip = request.headers.get("cf-connecting-ip") || "?";
  const lockKey = "lock:" + ip;
  const lock = (await env.TONKHO.get(lockKey, "json")) || { n: 0 };
  if (lock.n >= MAX_ATTEMPTS) {
    return json({ error: "locked", message: `Sai quá ${MAX_ATTEMPTS} lần. Thử lại sau ${LOCK_SECONDS} giây.` }, 429);
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (typeof body.password !== "string" || body.password !== env.PASSWORD) {
    const n = lock.n + 1;
    await env.TONKHO.put(lockKey, JSON.stringify({ n }), { expirationTtl: LOCK_SECONDS });
    const left = MAX_ATTEMPTS - n;
    return json({
      error: "wrong_password",
      message: left > 0 ? `Mật khẩu sai. Còn ${left} lần thử.` : `Sai quá ${MAX_ATTEMPTS} lần. Thử lại sau ${LOCK_SECONDS} giây.`,
    }, 401);
  }

  await env.TONKHO.delete(lockKey);
  const exp = Date.now() + SESSION_MS;
  return json({ token: exp + "." + (await signExp(env, exp)), exp });
}

async function getData(env) {
  const data = await env.TONKHO.get("inventory", "json");
  return json(data || SEED);
}

async function putData(env, request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (!Array.isArray(body.items) || body.items.length === 0) return json({ error: "bad_items" }, 400);
  const items = body.items.map((it) => ({
    ma: String(it.ma ?? ""),
    ten: String(it.ten ?? ""),
    dvt: String(it.dvt ?? ""),
    nhap: Number(it.nhap) || 0,
    ban: Number(it.ban) || 0,
  }));
  if (items.some((it) => !it.ma || !it.ten)) return json({ error: "bad_items" }, 400);
  const payload = { updated: new Date().toISOString().slice(0, 10), items };
  await env.TONKHO.put("inventory", JSON.stringify(payload));
  return json({ ok: true, updated: payload.updated, count: items.length });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (!env.TONKHO || !env.PASSWORD) {
      return json({ error: "misconfigured", message: "Thiếu KV binding TONKHO hoặc secret PASSWORD trên Worker." }, 500);
    }

    if (path === "/api/login" && request.method === "POST") return login(env, request);

    if (path === "/api/data") {
      if (!(await isAuthed(env, request))) return json({ error: "unauthorized" }, 401);
      if (request.method === "GET") return getData(env);
      if (request.method === "PUT") return putData(env, request);
    }

    return json({ error: "not_found" }, 404);
  },
};
