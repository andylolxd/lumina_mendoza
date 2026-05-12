-- current_user_is_admin: usar email canónico de auth.users (auth.uid()) además del claim JWT.
-- Así sigue funcionando si el access token no trae `email` o difiere del registro en Auth.
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_users au
    where lower(btrim(au.email)) = lower(btrim(
      coalesce(
        (select u.email from auth.users u where u.id = auth.uid()),
        auth.jwt() ->> 'email',
        ''
      )
    ))
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

comment on function public.current_user_is_admin() is
  'Comprueba admin_users por email en auth.users (uid del JWT) o claim email.';
