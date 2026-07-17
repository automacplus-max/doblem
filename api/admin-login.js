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
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASSWORD;
  const viewerUser = process.env.ADMIN_VIEWER_USER;
  const viewerPass = process.env.ADMIN_VIEWER_PASSWORD;
  if (!adminUser || !adminPass) {
    console.error("admin-login: faltan ADMIN_USER / ADMIN_PASSWORD en el servidor");
    return res.status(500).json({ error: "Admin login no está configurado." });
  }

  const isAdmin = safeEqual(user || "", adminUser) && safeEqual(pass || "", adminPass);
  const isViewer = !!viewerUser && !!viewerPass && safeEqual(user || "", viewerUser) && safeEqual(pass || "", viewerPass);
  if (!isAdmin && !isViewer) return res.status(401).json({ error: "Credenciales inválidas." });

  try {
    return res.status(200).json({ token: signSession(isAdmin ? "admin" : "viewer"), role: isAdmin ? "admin" : "viewer" });
  } catch (err) {
    console.error("admin-login error", err);
    return res.status(500).json({ error: "No se pudo iniciar sesión." });
  }
}
