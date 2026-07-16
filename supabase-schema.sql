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

-- El panel admin de esta app usa un login propio (usuario/contraseña
-- verificado en el navegador), NO Supabase Auth. Por eso, para que el panel
-- siga funcionando igual que en el prototipo, se permite leer y escribir esta
-- tabla con la clave anónima (anon).
--
-- ADVERTENCIA DE SEGURIDAD: esto significa que cualquiera que conozca tu URL
-- y tu clave anónima de Supabase podría escribir en esta tabla directamente
-- (sin pasar por el login del admin). Es el mismo nivel de seguridad que
-- tenía el prototipo original. Si en el futuro querés cerrar esto del todo,
-- lo correcto es migrar el login del admin a Supabase Auth real y restringir
-- estas políticas a "solo usuarios autenticados".
create policy "anon read store_kv" on store_kv
  for select using (true);

create policy "anon write store_kv" on store_kv
  for insert with check (true);

create policy "anon update store_kv" on store_kv
  for update using (true);

create policy "anon delete store_kv" on store_kv
  for delete using (true);
