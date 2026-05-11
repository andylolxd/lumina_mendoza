-- Galería adicional por producto (rutas en bucket product-images, mismo formato que image_path).
alter table public.products
  add column if not exists image_gallery jsonb not null default '[]'::jsonb;

comment on column public.products.image_gallery is 'JSON array de strings: rutas relativas en storage product-images, además de image_path.';
