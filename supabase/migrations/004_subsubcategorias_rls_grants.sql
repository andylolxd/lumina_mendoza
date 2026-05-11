-- Si no podés insertar en subsubcategorias (RLS / permisos), ejecutá esto en Supabase SQL.

grant usage on schema public to anon, authenticated;
grant select on table public.subsubcategorias to anon;
grant select, insert, update, delete on table public.subsubcategorias to authenticated;

drop policy if exists subsubcategorias_admin_all on public.subsubcategorias;

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
