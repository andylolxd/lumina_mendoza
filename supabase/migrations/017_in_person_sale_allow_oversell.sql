-- Venta en persona: permitir vender más que el stock en ficha; al descontar, el stock no queda negativo (piso 0).
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
    if not exists (select 1 from public.products p where p.id = r.product_id) then
      raise exception 'product not found';
    end if;

    insert into public.in_person_sale_lines (sale_id, product_id, quantity, unit_price)
    values (new_sale_id, r.product_id, r.quantity, r.unit_price);

    update public.products
    set stock_quantity = greatest(0, stock_quantity - r.quantity)
    where id = r.product_id;
  end loop;

  return new_sale_id;
end;
$$;
