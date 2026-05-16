-- Mueve la subcategoría «Cadena con cruz» de Cadenas a Ellos (mismos productos y sub-sub).

update public.subcategories s
set category_id = c_ellos.id
from public.categories c_cadenas,
  public.categories c_ellos
where s.category_id = c_cadenas.id
  and lower(trim(c_cadenas.name)) in ('cadenas', 'cadena')
  and lower(trim(c_ellos.name)) in ('ellos', 'ello')
  and lower(trim(s.name)) = 'cadena con cruz';
