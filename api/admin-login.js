import crypto from "crypto";
import { signSession } from "./_lib/adminAuth.js";

// Constant-time string compare that doesn't leak length via early-exit,
// by comparing fixed-length hashes instead of the raw strings.
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, pass } = req.body || {};
  const expectedUser = process.env.ADMIN_USER;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) {
    console.error("admin-login: faltan ADMIN_USER / ADMIN_PASSWORD en el servidor");
    return res.status(500).json({ error: "Admin login no está configurado." });
  }

  const ok = safeEqual(user || "", expectedUser) && safeEqual(pass || "", expectedPass);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas." });

  try {
    return res.status(200).json({ token: signSession() });
  } catch (err) {
    console.error("admin-login error", err);
    return res.status(500).json({ error: "No se pudo iniciar sesión." });
  }
}
