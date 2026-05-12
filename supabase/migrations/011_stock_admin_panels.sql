-- Panel stock admin: nombre visible por admin, ventas con etiqueta, ajuste de stock y borrado de ventas (revierte stock).

alter table public.admin_users
  add column if not exists display_name text not null default '';

comment on column public.admin_users.display_name is
  'Nombre corto en reportes (ej. Andy, Lis). Si queda vacío se usa el email.';

alter table public.in_person_sales
  add column if not exists sold_by_email text,
  add column if not exists sold_by_display_name text;

-- Ventas nuevas: rellenar email y nombre desde JWT + admin_users.display_name
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
  dn text;
  st int;
begin
  em := coalesce(auth.jwt() ->> 'email', '');
  if not exists (select 1 from public.admin_users au where au.email = em) then
    raise exception 'forbidden';
  end if;

  select nullif(trim(coalesce(au.display_name, '')), '')
    into dn
  from public.admin_users au
  where au.email = em;

  if dn is null then
    dn := em;
  end if;

  insert into public.in_person_sales (sold_by, notes, sold_by_email, sold_by_display_name)
  values (auth.uid(), null, em, dn)
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

-- Ajustes de inventario: [{ "product_id": "uuid", "delta": 3 }] suma (o resta) stock; no puede quedar negativo.
create or replace function public.apply_stock_deltas(deltas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  em text;
  st int;
  new_st int;
begin
  em := coalesce(auth.jwt() ->> 'email', '');
  if not exists (select 1 from public.admin_users au where au.email = em) then
    raise exception 'forbidden';
  end if;

  for r in
    select *
    from jsonb_to_recordset(deltas) as t(
      product_id uuid,
      delta int
    )
  loop
    if r.delta is null or r.delta = 0 then
      continue;
    end if;

    select p.stock_quantity into st
    from public.products p
    where p.id = r.product_id
    for update;

    if st is null then
      raise exception 'product not found';
    end if;

    new_st := st + r.delta;
    if new_st < 0 then
      raise exception 'stock would be negative for product %', r.product_id::text;
    end if;

    update public.products
    set stock_quantity = new_st
    where id = r.product_id;
  end loop;
end;
$$;

grant execute on function public.apply_stock_deltas(jsonb) to authenticated;

-- Borrar venta en persona: devuelve stock y elimina la venta (y líneas en cascade).
create or replace function public.delete_in_person_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  em text;
  r record;
begin
  em := coalesce(auth.jwt() ->> 'email', '');
  if not exists (select 1 from public.admin_users au where au.email = em) then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.in_person_sales s where s.id = p_sale_id) then
    raise exception 'sale not found';
  end if;

  for r in
    select l.product_id, l.quantity
    from public.in_person_sale_lines l
    where l.sale_id = p_sale_id
  loop
    update public.products p
    set stock_quantity = p.stock_quantity + r.quantity
    where p.id = r.product_id;
  end loop;

  delete from public.in_person_sales where id = p_sale_id;
end;
$$;

grant execute on function public.delete_in_person_sale(uuid) to authenticated;

-- Cualquier admin puede leer la lista de admins (emails + display_name) para filtros en estadísticas.
create policy admin_users_select_all_if_admin
  on public.admin_users for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );
