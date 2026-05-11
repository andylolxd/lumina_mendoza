-- Talles / variantes por producto (ej. anillos: talle 14, 16, 18 con stock cada uno).
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size_label text not null,
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint product_variants_product_size_unique unique (product_id, size_label)
);

create index if not exists idx_product_variants_product on public.product_variants (product_id);

comment on table public.product_variants is 'Variantes por producto (talles). Si hay filas, la tienda usa stock por variante; si no hay, solo products.stock_quantity.';

alter table public.product_variants enable row level security;

-- Catálogo público: solo variantes de productos activos
create policy product_variants_select_public
  on public.product_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.active = true
    )
  );

-- Admin: CRUD completo
create policy product_variants_admin_all
  on public.product_variants for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

grant select on table public.product_variants to anon;
grant select, insert, update, delete on table public.product_variants to authenticated;
