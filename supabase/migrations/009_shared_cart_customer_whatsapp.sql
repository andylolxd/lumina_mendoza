-- Teléfono WhatsApp del cliente (opcional), guardado por el admin para reutilizar al avisar / confirmar.

alter table public.shared_carts
  add column if not exists customer_whatsapp_e164 text;

comment on column public.shared_carts.customer_whatsapp_e164 is 'Solo dígitos E.164 sin + (ej. 5492615000000). Lo completa el admin desde el panel del carrito.';
