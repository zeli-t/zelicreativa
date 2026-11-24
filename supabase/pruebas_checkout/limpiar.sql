-- Solo en zeli-creativa-test. Ejecutar después de cerrar ambas sesiones de prueba.
begin;

do $$
declare
  ids_direcciones bigint[];
  ids_pedidos bigint[];
  ids_variantes bigint[];
  producto bigint;
begin
  select p.id into strict producto from public.productos p
  join public.categorias c on c.id = p.categoria_id
  where p.slug = 'zeli-checkout-e2e' and c.slug = 'zeli-checkout-e2e';

  select array_agg(v.id) into ids_variantes from public.variantes_producto v
  where v.producto_id = producto and v.sku in ('ZELI-E2E-CARRERA','ZELI-E2E-API');
  select array_agg(d.id) into ids_direcciones from public.direcciones d
  where d.referencia = 'ZELI-CHECKOUT-E2E' and d.destinatario in ('Cliente ficticio A','Cliente ficticio B');
  if cardinality(ids_variantes) is distinct from 2 or cardinality(ids_direcciones) is distinct from 2 then
    raise exception 'Conjunto ficticio incompleto: se cancela la limpieza';
  end if;

  select array_agg(p.id) into ids_pedidos from public.pedidos p
  where p.direccion_id = any(ids_direcciones)
    and p.clave_idempotencia in (
      '8b1f0000-0000-4000-8000-000000000001', '8b1f0000-0000-4000-8000-000000000002',
      '8b1f0000-0000-4000-8000-000000000003', '8b1f0000-0000-4000-8000-000000000004',
      '8b1f0000-0000-4000-8000-000000000005'
    );
  if exists (
    select 1 from public.detalle_pedido d
    where d.pedido_id = any(ids_pedidos) and not (d.variante_id = any(ids_variantes))
  ) or exists (
    select 1 from public.pedidos p
    where p.direccion_id = any(ids_direcciones) and not coalesce(p.id = any(ids_pedidos),false)
  ) then
    raise exception 'Se encontraron pedidos fuera del alcance de la prueba';
  end if;

  delete from public.historial_estados_pedido where pedido_id = any(ids_pedidos);
  delete from public.movimientos_inventario where pedido_id = any(ids_pedidos) and variante_id = any(ids_variantes);
  delete from public.pagos where pedido_id = any(ids_pedidos) and metodo = 'simulado';
  delete from public.detalle_pedido where pedido_id = any(ids_pedidos);
  delete from public.pedidos where id = any(ids_pedidos);
  delete from public.inventario where variante_id = any(ids_variantes);
  delete from public.variantes_producto where id = any(ids_variantes);
  delete from public.productos where id = producto;
  delete from public.categorias where slug = 'zeli-checkout-e2e';
  delete from public.direcciones where id = any(ids_direcciones);
end $$;

commit;
