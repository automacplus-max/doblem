import { createClient } from "@supabase/supabase-js";

/* Server-only Supabase client, using the SERVICE ROLE key. This key must
   NEVER be exposed to the browser — it bypasses Row Level Security, which is
   exactly why only serverless functions (never src/App.jsx) should use it. */

let client = null;

function getClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

const TABLE = "store_kv";

export async function kvGet(key) {
  const supabase = getClient();
  const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

export async function kvSet(key, value) {
  const supabase = getClient();
  const { error } = await supabase.from(TABLE).upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function kvDelete(key) {
  const supabase = getClient();
  const { error } = await supabase.from(TABLE).delete().eq("key", key);
  if (error) throw error;
}
