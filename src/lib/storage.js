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

   Nota de seguridad: como el panel admin es solo un gate de usuario/contraseña
   del lado del cliente (no autenticación real de Supabase), la tabla
   `store_kv` permite lectura/escritura con la clave anónima para que el panel
   siga funcionando igual que antes. Cualquiera que conozca la URL/clave de
   Supabase podría escribir ahí directamente sin pasar por el login. Para una
   tienda con más volumen conviene reemplazar el login del admin por Supabase
   Auth real y mover las políticas de escritura a "solo usuarios autenticados".
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

export const storage = { get, set, delete: del };
