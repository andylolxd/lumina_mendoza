-- Lumina Mendoza — ejecutar en Supabase (SQL Editor o migraciones)
-- 1) Tras correr esto, insertá los correos permitidos al final del archivo.

create extension if not exists "pgcrypto";

-- Administradores (solo estos emails acceden al panel)
create table public.admin_users (
  email text primary key
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.subsubcategorias (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.subcategories (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.subcategories (id) on delete cascade,
  subsubcategoria_id uuid references public.subsubcategorias (id) on delete cascade,
  name text not null,
  description text,
  price numeric(12, 2) not null check (price >= 0),
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  image_path text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Carrito compartido (solo accesible vía API con service role)
create table public.shared_carts (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create table public.in_person_sales (
  id uuid primary key default gen_random_uuid(),
  sold_at timestamptz not null default now(),
  sold_by uuid references auth.users (id),
  notes text
);

create table public.in_person_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.in_person_sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity int not null check (quantity > 0),
  unit_price numeric(12, 2) not null
);

create index idx_subcategories_category on public.subcategories (category_id);
create index idx_subsubcategorias_subcategory on public.subsubcategorias (subcategory_id);
create index idx_products_subcategory on public.products (subcategory_id);
create index idx_products_subsubcategoria on public.products (subsubcategoria_id);
create index idx_sale_lines_sale on public.in_person_sale_lines (sale_id);
create index idx_sales_sold_at on public.in_person_sales (sold_at);

create or replace function public.set_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on public.products
  for each row
  execute function public.set_products_updated_at();

create or replace function public.enforce_product_subsubcategoria()
returns trigger
language plpgsql
as $$
begin
  if new.subsubcategoria_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.subsubcategorias ss
    where ss.id = new.subsubcategoria_id and ss.subcategory_id = new.subcategory_id
  ) then
    raise exception 'subsubcategoria_id must belong to product.subcategory_id';
  end if;
  return new;
end;
$$;

create trigger products_subsubcategoria_check
  before insert or update on public.products
  for each row
  execute function public.enforce_product_subsubcategoria();

-- Líneas: [{ "product_id": "uuid", "quantity": 1, "unit_price": 1000.00 }]
create or replace function public.register_in_person_sale(lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_sale_id uuid;
  r record;
  em text;
  st int;
begin
  em := coalesce(auth.jwt() ->> 'email', '');
  if not exists (select 1 from public.admin_users au where au.email = em) then
    raise exception 'forbidden';
  end if;

  insert into public.in_person_sales (sold_by, notes)
  values (auth.uid(), null)
  returning id into new_sale_id;

  for r in
    select *
    from jsonb_to_recordset(lines) as t(
      product_id uuid,
      quantity int,
      unit_price numeric
    )
  loop
    select p.stock_quantity into st
    from public.products p
    where p.id = r.product_id
    for update;

    if st is null then
      raise exception 'product not found';
    end if;
    if st < r.quantity then
      raise exception 'insufficient stock';
    end if;

    insert into public.in_person_sale_lines (sale_id, product_id, quantity, unit_price)
    values (new_sale_id, r.product_id, r.quantity, r.unit_price);

    update public.products
    set stock_quantity = stock_quantity - r.quantity
    where id = r.product_id;
  end loop;

  return new_sale_id;
end;
$$;

grant execute on function public.register_in_person_sale(jsonb) to authenticated;

-- RLS
alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.subsubcategorias enable row level security;
alter table public.products enable row level security;
alter table public.shared_carts enable row level security;
alter table public.in_person_sales enable row level security;
alter table public.in_person_sale_lines enable row level security;

create policy admin_users_self_select
  on public.admin_users for select
  to authenticated
  using (email = (auth.jwt() ->> 'email'));

-- Catálogo público
create policy categories_select_public
  on public.categories for select
  to anon, authenticated
  using (true);

create policy subcategories_select_public
  on public.subcategories for select
  to anon, authenticated
  using (true);

create policy subsubcategorias_select_public
  on public.subsubcategorias for select
  to anon, authenticated
  using (true);

create policy products_select_public_active
  on public.products for select
  to anon, authenticated
  using (active = true);

-- Admin catálogo
create policy categories_admin_all
  on public.categories for all
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

create policy subcategories_admin_all
  on public.subcategories for all
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

create policy subsubcategorias_admin_insert
  on public.subsubcategorias for insert
  to authenticated
  with check (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

create policy subsubcategorias_admin_update
  on public.subsubcategorias for update
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

create policy subsubcategorias_admin_delete
  on public.subsubcategorias for delete
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

grant usage on schema public to anon, authenticated;
grant select on table public.subsubcategorias to anon;
grant select, insert, update, delete on table public.subsubcategorias to authenticated;

create policy products_admin_select
  on public.products for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

create policy products_admin_insert
  on public.products for insert
  to authenticated
  with check (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

create policy products_admin_update
  on public.products for update
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

create policy products_admin_delete
  on public.products for delete
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

-- Carritos: sin políticas para anon/auth; solo service_role (API server-side)
-- Historial ventas en persona
create policy in_person_sales_admin_select
  on public.in_person_sales for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

create policy in_person_lines_admin_select
  on public.in_person_sale_lines for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

-- Bucket imágenes
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public read product images"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

create policy "Admin insert product images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

create policy "Admin update product images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

create policy "Admin delete product images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

-- IMPORTANTE: reemplazá con los emails reales (los mismos que usen en Supabase Auth)
-- insert into public.admin_users (email) values ('vos@email.com'), ('pareja@email.com');
