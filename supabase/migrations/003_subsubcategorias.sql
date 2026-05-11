-- Tercer nivel: tabla propia `subsubcategorias` bajo `subcategories`.
-- Migra datos de `parent_subcategory_id` (si existía) y lo elimina.

create table if not exists public.subsubcategorias (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.subcategories (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_subsubcategorias_subcategory on public.subsubcategorias (subcategory_id);

alter table public.products
  add column if not exists subsubcategoria_id uuid references public.subsubcategorias (id) on delete cascade;

create index if not exists idx_products_subsubcategoria on public.products (subsubcategoria_id);

-- Self-FK anidado -> filas en subsubcategorias; productos pasan al sub padre + subsub nueva.
do $$
declare
  r record;
  new_ss uuid;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subcategories'
      and column_name = 'parent_subcategory_id'
  ) then
    for r in
      select id, parent_subcategory_id, name, sort_order
      from public.subcategories
      where parent_subcategory_id is not null
      order by id
    loop
      insert into public.subsubcategorias (subcategory_id, name, sort_order)
      values (r.parent_subcategory_id, r.name, r.sort_order)
      returning id into new_ss;

      update public.products
      set
        subcategory_id = r.parent_subcategory_id,
        subsubcategoria_id = new_ss
      where subcategory_id = r.id;

      delete from public.subcategories where id = r.id;
    end loop;

    drop trigger if exists subcategories_parent_category_check on public.subcategories;
    drop function if exists public.enforce_subcategory_parent_category();
    alter table public.subcategories drop column if exists parent_subcategory_id;
    drop index if exists idx_subcategories_parent;
  end if;
end;
$$;

create or replace function public.enforce_product_subsubcategoria()
returns trigger
language plpgsql
as $$
begin
  if new.subsubcategoria_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.subsubcategorias ss
    where ss.id = new.subsubcategoria_id
      and ss.subcategory_id = new.subcategory_id
  ) then
    raise exception 'subsubcategoria_id must belong to product.subcategory_id';
  end if;
  return new;
end;
$$;

drop trigger if exists products_subsubcategoria_check on public.products;
create trigger products_subsubcategoria_check
  before insert or update on public.products
  for each row
  execute function public.enforce_product_subsubcategoria();

alter table public.subsubcategorias enable row level security;

drop policy if exists subsubcategorias_select_public on public.subsubcategorias;
create policy subsubcategorias_select_public
  on public.subsubcategorias for select
  to anon, authenticated
  using (true);

drop policy if exists subsubcategorias_admin_all on public.subsubcategorias;

grant usage on schema public to anon, authenticated;
grant select on table public.subsubcategorias to anon;
grant select, insert, update, delete on table public.subsubcategorias to authenticated;

drop policy if exists subsubcategorias_admin_insert on public.subsubcategorias;
create policy subsubcategorias_admin_insert
  on public.subsubcategorias for insert
  to authenticated
  with check (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists subsubcategorias_admin_update on public.subsubcategorias;
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

drop policy if exists subsubcategorias_admin_delete on public.subsubcategorias;
create policy subsubcategorias_admin_delete
  on public.subsubcategorias for delete
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );
