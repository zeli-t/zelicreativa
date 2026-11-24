-- Ejecutar como propietario en un entorno de pruebas con Auth, 001–005 y seed_demo.
-- Crear dos cuentas ficticias de cliente y una de administrador con Supabase Auth.
-- Reemplazar los tres UUID de ejemplo por sus IDs de Auth. No escribir en auth.users.
-- Los datos de prueba creados por este script se revierten al finalizar.
-- Las secuencias pueden avanzar aunque se reviertan las filas.
-- Con psql usar -v ON_ERROR_STOP=1. Un fallo inesperado detiene la verificación.
begin;

select set_config('zeli_test.cliente','PEGA_UUID_CLIENTE_1',true),
  set_config('zeli_test.otro','PEGA_UUID_CLIENTE_2',true),
  set_config('zeli_test.admin','PEGA_UUID_ADMIN',true),
  set_config('zeli_test.clave',gen_random_uuid()::text,true);

do $$
begin
  if (select count(*) from public.usuarios where id in (current_setting('zeli_test.cliente')::uuid,
    current_setting('zeli_test.otro')::uuid) and rol = 'cliente' and activo) <> 2
    or not exists(select 1 from public.usuarios
      where id = current_setting('zeli_test.admin')::uuid and rol = 'admin' and activo) then
    raise exception 'Configura dos cuentas Auth de prueba con rol cliente y una con rol admin';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity and c.relname in (
    'roles','usuarios','direcciones','categorias','productos','variantes_producto',
    'imagenes_producto','inventario','carritos','carrito_detalle','cupones','pedidos',
    'detalle_pedido','estados_pedido','metodos_pago','pagos','envios','empresas_paqueteria',
    'lista_deseos','resenas','movimientos_inventario','historial_estados_pedido',
    'solicitudes_devolucion','detalle_devolucion','auditoria')) <> 25 then
    raise exception 'Faltan tablas o políticas RLS habilitadas';
  end if;
  if not exists(select 1 from public.productos where slug = 'kit-de-journaling')
    or (select count(*) from public.variantes_producto where predeterminada
      and sku ~ '^(LIB|ESC|STK)-[0-9]{3}$') < 15 then
    raise exception 'Faltan productos de demostración';
  end if;
  begin
    insert into public.inventario(variante_id,cantidad) values (0,1);
    raise exception 'Se permitió una FK huérfana';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.inventario set cantidad = -1
    where variante_id = (select id from public.variantes_producto where sku = 'LIB-001');
    raise exception 'Se permitió stock negativo';
  exception when check_violation then null;
  end;
end $$;

with direcciones as (
  insert into public.direcciones(usuario_id,destinatario,calle,numero,colonia,ciudad,estado,codigo_postal)
  select id,'Destinatario ficticio','Calle de prueba','1','Pruebas','Ciudad ficticia','Estado ficticio','88000'
  from unnest(array[current_setting('zeli_test.cliente')::uuid,current_setting('zeli_test.otro')::uuid]) as u(id)
  returning id,usuario_id
)
select set_config('zeli_test.direccion',max(id) filter (where usuario_id = current_setting('zeli_test.cliente')::uuid)::text,true),
  set_config('zeli_test.ajena',max(id) filter (where usuario_id = current_setting('zeli_test.otro')::uuid)::text,true)
from direcciones;

-- Mantener la prueba de stock dentro del tope de compra de la migración 005.
update public.inventario set cantidad = least(cantidad,9)
where variante_id = (select id from public.variantes_producto where sku = 'LIB-001');

select set_config('zeli_test.variante',v.id::text,true),
  set_config('zeli_test.stock',i.cantidad::text,true)
from public.variantes_producto v join public.inventario i on i.variante_id = v.id
where v.sku = 'LIB-001';
select set_config('zeli_test.empresa',id::text,true)
from public.empresas_paqueteria where nombre = 'Paquetería Zeli Demo';

set local role anon;
select set_config('request.jwt.claim.sub','',true),
  set_config('request.jwt.claims','{}',true);
do $$
begin
  if zeli_privado.es_admin() then
    raise exception 'Se detectó un administrador sin sesión';
  end if;
  if (select count(*) from public.productos) < 15 then
    raise exception 'El catálogo público no está disponible';
  end if;
  begin
    perform 1 from public.pedidos;
    raise exception 'Visitante con acceso a pedidos';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('zeli_test.cliente'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('zeli_test.cliente'),'role','authenticated')::text,true);
do $$
declare
  direccion bigint := current_setting('zeli_test.direccion')::bigint;
  variante bigint := current_setting('zeli_test.variante')::bigint;
  clave uuid := current_setting('zeli_test.clave')::uuid;
  items jsonb := jsonb_build_array(jsonb_build_object('id',variante,'cantidad',1));
  respuesta jsonb;
  repeticion jsonb;
begin
  begin
    update public.usuarios set rol = 'admin' where id = auth.uid();
    raise exception 'El cliente pudo editar permisos';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ajustar_inventario(variante,1,'Acción prohibida');
    raise exception 'El cliente pudo modificar inventario';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.asignar_rol(current_setting('zeli_test.otro')::uuid,'admin');
    raise exception 'El cliente pudo asignar permisos mediante RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform zeli_privado.mover_stock(variante,1,'ajuste','Acción prohibida',auth.uid());
    raise exception 'El cliente pudo llamar al auxiliar de inventario';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.productos set precio = 0 where slug = 'libreta-personalizada';
    if found then
      raise exception 'El cliente pudo editar precios';
    end if;
  exception when insufficient_privilege then null;
  end;
  if exists(select 1 from public.inventario) then
    raise exception 'El cliente pudo leer inventario interno';
  end if;
  begin
    perform public.registrar_pedido(items,current_setting('zeli_test.ajena')::bigint,clave,'demo-v1', p_telefono_entrega => '8681234567');
    raise exception 'Se permitió una dirección ajena';
  exception when invalid_parameter_value then
    if sqlerrm <> 'DIRECCION_INVALIDA' then raise; end if;
  end;
  begin
    perform public.registrar_pedido(jsonb_build_array(jsonb_build_object('id',variante,
      'cantidad',current_setting('zeli_test.stock')::integer + 1)),direccion,clave,'demo-v1', p_telefono_entrega => '8681234567');
    raise exception 'Se permitió exceder el stock';
  exception when raise_exception then
    if sqlerrm <> 'STOCK_INSUFICIENTE_O_INVALIDO' then raise; end if;
  end;
  respuesta := public.registrar_pedido(items,direccion,clave,'demo-v1',0, p_telefono_entrega => '8681234567');
  if respuesta->>'estado' is distinct from 'requiere_confirmacion'
    or (respuesta->>'total')::numeric <= 0 then
    raise exception 'El servidor aceptó un total alterado';
  end if;
  respuesta := public.registrar_pedido(items,direccion,clave,'demo-v1',(respuesta->>'total')::numeric, p_telefono_entrega => '8681234567');
  repeticion := public.registrar_pedido(items,direccion,clave,'demo-v1', p_telefono_entrega => '8681234567');
  if respuesta is distinct from repeticion or respuesta->>'estado' is distinct from 'pagado' then
    raise exception 'Idempotencia o pago simulado incorrectos';
  end if;
  perform set_config('zeli_test.pedido',respuesta->>'id',true);
  if (select count(*) from public.pagos where pedido_id = (respuesta->>'id')::bigint
    and estado = 'aprobado' and metodo = 'simulado' and monto = (respuesta->>'total')::numeric) <> 1 then
    raise exception 'Falta el pago simulado';
  end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('zeli_test.otro'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('zeli_test.otro'),'role','authenticated')::text,true);
do $$
begin
  if exists(select 1 from public.pedidos where id = current_setting('zeli_test.pedido')::bigint)
    or exists(select 1 from public.detalle_pedido where pedido_id = current_setting('zeli_test.pedido')::bigint) then
    raise exception 'Un segundo cliente pudo consultar el pedido';
  end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('zeli_test.admin'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('zeli_test.admin'),'role','authenticated')::text,true);
do $$
declare
  pedido bigint := current_setting('zeli_test.pedido')::bigint;
  variante bigint := current_setting('zeli_test.variante')::bigint;
begin
  if (select cantidad from public.inventario where variante_id = variante)
    is distinct from current_setting('zeli_test.stock')::integer - 1 then
    raise exception 'La venta no descontó exactamente una unidad';
  end if;
  perform public.cambiar_estado_pedido(pedido,'preparando','Preparar verificación');
  perform public.cambiar_estado_pedido(pedido,'enviado','Despachar verificación',
    current_setting('zeli_test.empresa')::bigint,'DEMO-' || gen_random_uuid()::text);
  perform public.cambiar_estado_pedido(pedido,'entregado','Entregar verificación');
end $$;

select set_config('request.jwt.claim.sub',current_setting('zeli_test.cliente'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('zeli_test.cliente'),'role','authenticated')::text,true);
do $$
declare
  pedido bigint := current_setting('zeli_test.pedido')::bigint;
  partida bigint;
  items jsonb;
begin
  select id into strict partida from public.detalle_pedido where pedido_id = pedido;
  items := jsonb_build_array(jsonb_build_object('id',partida,'cantidad',1));
  perform set_config('zeli_test.devolucion',public.solicitar_devolucion(pedido,items,'Motivo ficticio')::text,true);
  begin
    perform public.solicitar_devolucion(pedido,items,'Segunda solicitud');
    raise exception 'Se permitió devolver más unidades que las compradas';
  exception when invalid_parameter_value then
    if sqlerrm <> 'CANTIDAD_DEVOLUCION_EXCEDIDA' then raise; end if;
  end;
  begin
    perform public.resolver_devolucion(current_setting('zeli_test.devolucion')::bigint,'aprobada','Acción prohibida');
    raise exception 'El cliente pudo aprobar su devolución';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub',current_setting('zeli_test.admin'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('zeli_test.admin'),'role','authenticated')::text,true);
do $$
declare
  solicitud bigint := current_setting('zeli_test.devolucion')::bigint;
  variante bigint := current_setting('zeli_test.variante')::bigint;
begin
  perform public.resolver_devolucion(solicitud,'aprobada','Prueba de aprobación');
  if (select cantidad from public.inventario where variante_id = variante)
    is distinct from current_setting('zeli_test.stock')::integer - 1 then
    raise exception 'Aprobar repuso stock antes de recibir el artículo';
  end if;
  perform public.resolver_devolucion(solicitud,'recibida','Prueba de recepción',true);
  if (select cantidad from public.inventario where variante_id = variante)
    is distinct from current_setting('zeli_test.stock')::integer then
    raise exception 'La recepción no repuso la unidad';
  end if;
  if (select count(*) from public.movimientos_inventario where devolucion_id = solicitud) <> 1 then
    raise exception 'Movimiento de devolución ausente o duplicado';
  end if;
  begin
    perform public.resolver_devolucion(solicitud,'recibida','Recepción duplicada',true);
    raise exception 'Se autorizó una segunda reposición';
  exception when invalid_parameter_value then
    if sqlerrm <> 'TRANSICION_DEVOLUCION_INVALIDA' then raise; end if;
  end;
end $$;

reset role;
rollback;
select 'Verificación secuencial completada. Ejecutar la prueba de concurrencia en dos conexiones.' as resultado;

-- Concurrencia manual (usar una variante de prueba con stock = 1 y dos clientes).
-- A y B obtienen cotización con un teléfono válido.
-- A: BEGIN, confirma y mantiene la transacción abierta.
-- B: confirma con otra clave y espera el bloqueo. A: COMMIT.
-- B debe recibir STOCK_INSUFICIENTE_O_INVALIDO. Verificar un pedido y un movimiento
-- de venta para esa prueba y saldo 0. Limpiar las pruebas en el entorno aislado.
