-- Ejecutar completo únicamente en SQL Editor de zeli-creativa-test.
begin;

do $$
declare
  cliente_a uuid := 'PEGA_UUID_CLIENTE_A';
  cliente_b uuid := 'PEGA_UUID_CLIENTE_B';
  categoria bigint;
  producto bigint;
begin
  if (select count(*) from public.usuarios u
      where u.id in (cliente_a, cliente_b) and u.rol = 'cliente' and u.activo) <> 2 then
    raise exception 'Se requieren dos cuentas ficticias activas con rol cliente';
  end if;
  if exists (select 1 from public.direcciones where referencia = 'ZELI-CHECKOUT-E2E') then
    raise exception 'Ya existen direcciones de una ejecución anterior';
  end if;

  insert into public.categorias(slug,nombre)
    values ('zeli-checkout-e2e','Prueba ficticia de checkout') returning id into categoria;
  insert into public.productos(categoria_id,slug,nombre,descripcion,precio)
    values (categoria,'zeli-checkout-e2e','Producto ficticio','Solo para pruebas',10) returning id into producto;
  with variantes as (
    insert into public.variantes_producto(producto_id,sku,nombre)
    values (producto,'ZELI-E2E-CARRERA','Concurrencia'),(producto,'ZELI-E2E-API','Integración')
    returning id,sku
  )
  insert into public.inventario(variante_id,cantidad) select id,1 from variantes;

  insert into public.direcciones(usuario_id,destinatario,calle,numero,colonia,ciudad,estado,codigo_postal,referencia)
  values (cliente_a,'Cliente ficticio A','Calle ficticia','1','Pruebas','Pruebas','Pruebas','88000','ZELI-CHECKOUT-E2E'),
         (cliente_b,'Cliente ficticio B','Calle ficticia','2','Pruebas','Pruebas','Pruebas','88000','ZELI-CHECKOUT-E2E');
end $$;

commit;
