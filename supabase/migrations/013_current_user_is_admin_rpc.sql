-- Comprueba membresía en admin_users usando el JWT (sin exponer filtros REST que fallen con RLS recursiva / ilike).
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where lower(btrim(au.email)) =
          lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

comment on function public.current_user_is_admin() is
  'Bypasses RLS cuando hace falta; solo efectivo si auth.jwt() trae email.';
