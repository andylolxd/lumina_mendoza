-- Nota interna del admin (ej. envío a Rivadavia), visible en panel Pedidos.

alter table public.shared_carts
  add column if not exists admin_note text;

comment on column public.shared_carts.admin_note is 'Nota interna solo para el equipo (envío, recordatorios). Máx. 500 caracteres desde la app.';
