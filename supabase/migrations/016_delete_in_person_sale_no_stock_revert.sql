-- Borrar venta en persona: solo elimina el registro (líneas en cascade). No modifica stock.
create or replace function public.delete_in_person_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  em text;
begin
  em := coalesce(auth.jwt() ->> 'email', '');
  if not exists (select 1 from public.admin_users au where au.email = em) then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.in_person_sales s where s.id = p_sale_id) then
    raise exception 'sale not found';
  end if;

  delete from public.in_person_sales where id = p_sale_id;
end;
$$;
