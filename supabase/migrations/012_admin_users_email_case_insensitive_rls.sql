-- Comparar email admin sin distinguir mayúsculas/minúsculas y con trim (Auth vs tabla).

drop policy if exists admin_users_self_select on public.admin_users;

create policy admin_users_self_select
  on public.admin_users for select
  to authenticated
  using (
    lower(btrim(email)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  );

drop policy if exists admin_users_select_all_if_admin on public.admin_users;

create policy admin_users_select_all_if_admin
  on public.admin_users for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users au
      where lower(btrim(au.email)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    )
  );
