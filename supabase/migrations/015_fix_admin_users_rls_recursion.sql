-- Quitar política recursiva: al leer admin_users evaluaba EXISTS sobre admin_users otra vez → "infinite recursion".
drop policy if exists admin_users_select_all_if_admin on public.admin_users;

-- Lista de admins para UI (filtros stock): solo si current_user_is_admin(); lectura bajo SECURITY DEFINER sin RLS recursiva.
create or replace function public.list_admin_users_directory()
returns table (email text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select au.email, au.display_name
  from public.admin_users au
  where public.current_user_is_admin();
$$;

revoke all on function public.list_admin_users_directory() from public;
grant execute on function public.list_admin_users_directory() to authenticated;

comment on function public.list_admin_users_directory() is
  'Emails + display_name de admin_users para selects en cliente; sólo si el caller es admin.';
