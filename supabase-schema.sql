-- ============================================================================
-- LA DOBLE M — esquema de Supabase
-- Ejecutar esto una vez en: Supabase Dashboard > SQL Editor > New query
-- ============================================================================

-- Tabla única de clave/valor que reemplaza a window.storage.
-- Guarda: catálogo de productos, categorías, marcas, logo, reseñas,
-- imágenes subidas, pedidos (ldm-orders) y pedidos pendientes de pago.
create table if not exists store_kv (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table store_kv enable row level security;

-- Todo el mundo puede LEER (necesario para que la tienda pública muestre el
-- catálogo, pedidos de un cliente vía su propio flujo, etc).
create policy "anon read store_kv" on store_kv
  for select using (true);

-- Las claves administrables (catálogo, categorías, marcas, etiquetas) NO se
-- pueden escribir con la clave anónima: solo el backend (service_role, que
-- ignora RLS) puede tocarlas, y solo lo hace después de validar el login del
-- admin en /api/admin-login. Ver api/admin-kv.js y src/lib/storage.js.
-- El resto de las claves compartidas (reseñas, pedidos, imágenes subidas)
-- siguen siendo escribibles por cualquier visitante, porque las genera
-- gente que compra o deja una reseña sin haber iniciado sesión como admin.
create policy "anon write store_kv" on store_kv
  for insert with check (key not in ('ldm-products', 'ldm-categories', 'ldm-brands', 'ldm-tags'));

create policy "anon update store_kv" on store_kv
  for update using (key not in ('ldm-products', 'ldm-categories', 'ldm-brands', 'ldm-tags'));

create policy "anon delete store_kv" on store_kv
  for delete using (key not in ('ldm-products', 'ldm-categories', 'ldm-brands', 'ldm-tags'));
