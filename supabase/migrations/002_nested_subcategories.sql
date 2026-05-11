-- (Legacy) Self-FK en subcategories. Preferí migración 003: tabla `subsubcategorias`.
-- Subcategorías anidadas (sub-subcategorías): mismo category_id, parent opcional.

alter table public.subcategories
  add column if not exists parent_subcategory_id uuid references public.subcategories (id) on delete cascade;

create index if not exists idx_subcategories_parent on public.subcategories (parent_subcategory_id);

create or replace function public.enforce_subcategory_parent_category()
returns trigger
language plpgsql
as $$
declare
  pc uuid;
begin
  if new.parent_subcategory_id is null then
    return new;
  end if;
  select category_id into pc from public.subcategories where id = new.parent_subcategory_id;
  if pc is null then
    raise exception 'parent subcategory not found';
  end if;
  if new.category_id <> pc then
    raise exception 'category_id must match parent subcategory category';
  end if;
  return new;
end;
$$;

drop trigger if exists subcategories_parent_category_check on public.subcategories;
create trigger subcategories_parent_category_check
  before insert or update on public.subcategories
  for each row
  execute function public.enforce_subcategory_parent_category();
