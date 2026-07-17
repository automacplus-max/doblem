import { verifySession } from "./_lib/adminAuth.js";
import { kvSet, kvDelete } from "./_lib/supabaseAdmin.js";

// Generic write proxy for admin-protected store_kv keys (products, categories,
// brands, tags). Requires a session token issued by /api/admin-login. Uses
// the service-role Supabase client, which bypasses the RLS policy that blocks
// anon writes to these specific keys — see supabase-schema.sql.
export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const session = verifySession(token);
  if (!session) return res.status(401).json({ error: "No autorizado." });
  // The UI already hides every mutating control for the viewer role — this
  // is the check that actually matters, in case someone crafts a request by hand.
  if (session.role !== "admin") return res.status(403).json({ error: "Tu cuenta es de solo lectura." });

  try {
    if (req.method === "POST") {
      const { key, value } = req.body || {};
      if (!key) return res.status(400).json({ error: "Falta key." });
      await kvSet(key, value);
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: "Falta key." });
      await kvDelete(key);
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("admin-kv error", err);
    return res.status(500).json({ error: "No se pudo guardar." });
  }
}
