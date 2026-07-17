import { createClient } from "@supabase/supabase-js";

/* ============================================================================
   Reemplazo de `window.storage`
   ----------------------------------------------------------------------------
   El proyecto original usaba `window.storage`, una API que SOLO existe dentro
   del entorno de artifacts de Claude.ai. Fuera de ahí (por ejemplo en el sitio
   real desplegado en Vercel) esa API no existe, así que nada persistía de
   verdad. Este módulo expone la misma interfaz (get/set/delete con la firma
   (key, shared)) pero respaldada por:

     - shared = true  -> Supabase (tabla `store_kv`), visible para todos los
                         visitantes: catálogo de productos, categorías,
                         marcas, logo, reseñas, imágenes subidas y pedidos.
     - shared = false -> localStorage del navegador, propio de cada visitante:
                         carrito, wishlist, tema, moneda, sesión de admin.

   Seguridad: las claves administrables (catálogo, categorías, marcas,
   etiquetas — ver ADMIN_PROTECTED_KEYS en App.jsx) están protegidas por RLS
   en Supabase: la clave anónima solo puede LEERLAS, no escribirlas. Las
   escrituras a esas claves pasan por /api/admin-kv (adminSet/adminDelete
   abajo), que exige un token de sesión firmado por /api/admin-login usando
   un secreto de servidor — la contraseña de admin nunca viaja al bundle del
   cliente. El resto de las claves compartidas (reseñas, pedidos, imágenes)
   se siguen escribiendo con la clave anónima porque cualquier visitante
   necesita poder crearlas.
   ============================================================================ */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

const TABLE = "store_kv";

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase no está configurado: faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

async function get(key, shared = false) {
  if (shared) {
    const sb = requireSupabase();
    const { data, error } = await sb.from(TABLE).select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("not found");
    return { key, value: data.value, shared };
  }
  const raw = window.localStorage.getItem(key);
  if (raw == null) throw new Error("not found");
  return { key, value: raw, shared };
}

async function set(key, value, shared = false) {
  if (shared) {
    const sb = requireSupabase();
    const { error } = await sb.from(TABLE).upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value, shared };
  }
  window.localStorage.setItem(key, value);
  return { key, value, shared };
}

async function del(key, shared = false) {
  if (shared) {
    const sb = requireSupabase();
    const { error } = await sb.from(TABLE).delete().eq("key", key);
    if (error) throw error;
    return { key, deleted: true, shared };
  }
  window.localStorage.removeItem(key);
  return { key, deleted: true, shared };
}

async function adminSet(key, value, token) {
  const res = await fetch("/api/admin-kv", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error("admin write failed");
  return { key, value, shared: true };
}

async function adminDelete(key, token) {
  const res = await fetch(`/api/admin-kv?key=${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("admin delete failed");
  return { key, deleted: true, shared: true };
}

export const storage = { get, set, delete: del, adminSet, adminDelete };
