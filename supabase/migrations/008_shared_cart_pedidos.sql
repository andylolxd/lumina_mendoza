-- Pedidos desde carrito compartido: estado y descuento de stock solo al aceptar venta.

alter table public.shared_carts
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by_email text;

create index if not exists idx_shared_carts_status_created
  on public.shared_carts (status, created_at desc);

comment on column public.shared_carts.status is 'pending: pedido por WhatsApp; accepted: stock descontado; rejected: cerrado sin venta.';

-- Aceptar pedido: valida stock, descuenta variantes o producto, marca carrito aceptado (transacción atómica).
create or replace function public.accept_shared_cart(p_cart_id uuid, p_admin_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cart record;
  elem jsonb;
  pid uuid;
  vid uuid;
  qty int;
  has_variants boolean;
  cur_stock int;
begin
  select * into cart from public.shared_carts where id = p_cart_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if cart.status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'already_processed', 'status', cart.status);
  end if;
  if cart.items is null or jsonb_typeof(cart.items) != 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_items');
  end if;

  -- Fase 1: bloquear filas y verificar stock
  for elem in select * from jsonb_array_elements(cart.items)
  loop
    pid := nullif(trim(elem ->> 'product_id'), '')::uuid;
    qty := coalesce((elem ->> 'quantity')::int, 0);
    if pid is null or qty < 1 then
      return jsonb_build_object('ok', false, 'error', 'invalid_line', 'product_id', elem ->> 'product_id');
    end if;

    select exists (select 1 from public.product_variants pv where pv.product_id = pid limit 1)
    into has_variants;

    vid := nullif(trim(elem ->> 'variant_id'), '')::uuid;

    if has_variants then
      if vid is null then
        return jsonb_build_object('ok', false, 'error', 'variant_required', 'product_id', pid);
      end if;
      select pv.stock_quantity into cur_stock
      from public.product_variants pv
      where pv.id = vid and pv.product_id = pid
      for update;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'variant_not_found', 'variant_id', vid);
      end if;
      if cur_stock < qty then
        return jsonb_build_object(
          'ok', false,
          'error', 'insufficient_stock',
          'product_id', pid,
          'variant_id', vid,
          'needed', qty
        );
      end if;
    else
      select p.stock_quantity into cur_stock
      from public.products p
      where p.id = pid
      for update;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'product_not_found', 'product_id', pid);
      end if;
      if cur_stock < qty then
        return jsonb_build_object(
          'ok', false,
          'error', 'insufficient_stock',
          'product_id', pid,
          'needed', qty
        );
      end if;
    end if;
  end loop;

  -- Fase 2: descontar
  for elem in select * from jsonb_array_elements(cart.items)
  loop
    pid := nullif(trim(elem ->> 'product_id'), '')::uuid;
    qty := (elem ->> 'quantity')::int;
    select exists (select 1 from public.product_variants pv where pv.product_id = pid limit 1)
    into has_variants;
    vid := nullif(trim(elem ->> 'variant_id'), '')::uuid;

    if has_variants then
      update public.product_variants
      set stock_quantity = stock_quantity - qty
      where id = vid and product_id = pid;
    else
      update public.products
      set stock_quantity = stock_quantity - qty
      where id = pid;
    end if;
  end loop;

  update public.shared_carts
  set
    status = 'accepted',
    accepted_at = now(),
    accepted_by_email = left(coalesce(p_admin_email, ''), 320)
  where id = p_cart_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.accept_shared_cart(uuid, text) from public;
grant execute on function public.accept_shared_cart(uuid, text) to service_role;

-- Admins: listar carritos / pedidos desde el panel (JWT).
drop policy if exists shared_carts_admin_select on public.shared_carts;
create policy shared_carts_admin_select
  on public.shared_carts for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = (auth.jwt() ->> 'email')
    )
  );

grant select on table public.shared_carts to authenticated;
