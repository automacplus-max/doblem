import crypto from "crypto";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Falta ADMIN_SESSION_SECRET en las variables de entorno del servidor.");
  return secret;
}

// Payload carries the role so the client can render the right UI, and the
// server (admin-kv.js) independently re-checks it before any write — the
// client-side check is just for UX, this one is what actually matters.
export function signSession(role = "admin") {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${exp}:${role}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

// Returns { exp, role } on a valid, unexpired, correctly-signed token, or null.
export function verifySession(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [expStr, role] = payload.split(":");
  const exp = Number(expStr);
  if (!exp || exp <= Date.now()) return null;
  return { exp, role: role || "admin" };
}
