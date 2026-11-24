-- Ejecutar el bloque completo en una sesión PostgreSQL persistente de zeli-creativa-test.
-- A: UUID de cliente A y clave 8b1f0000-0000-4000-8000-000000000001.
-- B: UUID de cliente B y clave 8b1f0000-0000-4000-8000-000000000002.
-- No agregar COMMIT a este bloque. Ver el procedimiento para el orden de las sesiones.
begin isolation level read committed;
set local lock_timeout = '90s';
set local idle_in_transaction_session_timeout = '3min';
set local role authenticated;

select set_config('request.jwt.claim.sub','PEGA_UUID_CLIENTE',true),
  set_config('request.jwt.claims','{}',true);

with datos as (
  select
    (select id from public.direcciones where referencia = 'ZELI-CHECKOUT-E2E'
      and usuario_id = auth.uid()) as direccion_id,
    (select id from public.variantes_producto where sku = 'ZELI-E2E-CARRERA') as variante_id
)
select public.registrar_pedido(
  jsonb_build_array(jsonb_build_object('id',variante_id,'cantidad',1)),
  direccion_id,'PEGA_CLAVE_DE_SESION'::uuid,'demo-v1',
  p_total_confirmado => 61.60,p_telefono_entrega => '8681234567'
) as confirmacion
from datos;
