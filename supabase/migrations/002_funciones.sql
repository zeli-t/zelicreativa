-- 002. Operaciones de negocio. 003 concede ejecución por rol.
begin;
-- Fallar si el nombre ya está ocupado. Los auxiliares deben vivir en un
-- esquema creado por el propietario de estas migraciones.
create schema zeli_privado;
revoke all on schema zeli_privado from public, anon, authenticated;

create function zeli_privado.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuarios(id, nombre)
  values (new.id, coalesce(nullif(left(btrim(new.raw_user_meta_data->>'nombre'),100),''),'Cliente'))
  on conflict (id) do nothing;
  return new;
end $$;

create function zeli_privado.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.usuarios
    where id = auth.uid() and activo and rol = 'admin');
$$;

create function zeli_privado.cliente_activo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.usuarios where id = auth.uid() and activo);
$$;

create function zeli_privado.exigir_admin() returns uuid
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not zeli_privado.es_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_REQUERIDO';
  end if;
  return auth.uid();
end $$;

create function zeli_privado.auditar_catalogo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new is distinct from old then
    insert into public.auditoria(actor_id, entidad, registro, accion, cambios)
    values (auth.uid(), tg_table_name, new.id::text, 'actualizar',
      jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new)));
  end if;
  return new;
end $$;
create trigger auditar_producto after update on public.productos
  for each row execute function zeli_privado.auditar_catalogo();
create trigger auditar_variante after update on public.variantes_producto
  for each row execute function zeli_privado.auditar_catalogo();

create function zeli_privado.mover_stock(
  p_variante bigint, p_delta integer, p_tipo text, p_motivo text, p_actor uuid,
  p_pedido bigint default null, p_devolucion bigint default null
) returns integer
language plpgsql set search_path = '' as $$
declare saldo integer;
begin
  update public.inventario
  set cantidad = cantidad + p_delta, actualizado_en = clock_timestamp()
  where variante_id = p_variante and cantidad::bigint + p_delta between 0 and 2147483647
  returning cantidad into saldo;
  if not found then
    raise exception using errcode = 'P0001', message = 'STOCK_INSUFICIENTE_O_INVALIDO';
  end if;
  insert into public.movimientos_inventario
    (variante_id, pedido_id, devolucion_id, actor_id, tipo, variacion, saldo, motivo)
  values (p_variante, p_pedido, p_devolucion, p_actor, p_tipo, p_delta, saldo, p_motivo);
  return saldo;
end $$;

create function public.ajustar_inventario(
  p_variante bigint, p_delta integer, p_motivo text, p_stock_minimo integer default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := zeli_privado.exigir_admin();
  saldo integer;
begin
  if p_delta is null or (p_delta = 0 and p_stock_minimo is null)
    or coalesce(length(btrim(p_motivo)),0) not between 1 and 500
    or p_stock_minimo < 0 then
    raise exception using errcode = '22023', message = 'AJUSTE_INVALIDO';
  end if;
  insert into public.inventario(variante_id) values(p_variante)
    on conflict (variante_id) do nothing;
  if p_stock_minimo is not null then
    update public.inventario set stock_minimo = p_stock_minimo, actualizado_en = clock_timestamp()
    where variante_id = p_variante;
  end if;
  if p_delta <> 0 then
    saldo := zeli_privado.mover_stock(p_variante,p_delta,'ajuste',btrim(p_motivo),actor);
  else
    select cantidad into saldo from public.inventario where variante_id = p_variante;
  end if;
  insert into public.auditoria(actor_id,entidad,registro,accion,cambios)
  values(actor,'inventario',p_variante::text,'ajustar',
    jsonb_build_object('variacion',p_delta,'stock_minimo',p_stock_minimo,'saldo',saldo));
  return saldo;
end $$;

-- Agrupa líneas y valida el contrato para pedidos y devoluciones.
create function zeli_privado.normalizar_partidas(p_items jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare partidas jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'PARTIDAS_INVALIDAS';
  end if;
  if jsonb_array_length(p_items) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'PARTIDAS_INVALIDAS';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_items) as x(id bigint, cantidad integer)
    where id is null or id <= 0 or cantidad is null or cantidad not between 1 and 10000) then
    raise exception using errcode = '22023', message = 'PARTIDAS_INVALIDAS';
  end if;
  select jsonb_agg(to_jsonb(x) order by x.id) into partidas
  from (select id, sum(cantidad)::integer as cantidad
    from jsonb_to_recordset(p_items) as l(id bigint,cantidad integer) group by id) as x;
  return partidas;
end $$;

-- Pago académico aprobado por el simulador interno. Entrada sin datos bancarios.
-- p_total_confirmado es la cotización que vio el cliente; nunca fija el precio.
create function public.registrar_pedido(
  p_items jsonb, p_direccion bigint, p_idempotencia uuid, p_terminos_version text,
  p_total_confirmado numeric default null, p_cupon text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  partidas jsonb;
  solicitud_normalizada jsonb;
  envio_datos public.direcciones%rowtype;
  cupon public.cupones%rowtype;
  existente public.pedidos%rowtype;
  pedido public.pedidos%rowtype;
  linea record;
  ficha record;
  capturas jsonb := '[]'::jsonb;
  base numeric := 0;
  impuesto numeric;
  envio numeric;
  descuento_calc numeric := 0;
  total_calc numeric;
  codigo_cupon text := nullif(upper(btrim(p_cupon)),'');
begin
  if not zeli_privado.cliente_activo() then
    raise exception using errcode = '42501', message = 'SESION_REQUERIDA';
  end if;
  if p_idempotencia is null or p_terminos_version is distinct from 'demo-v1' then
    raise exception using errcode = '22023', message = 'IDEMPOTENCIA_O_TERMINOS_INVALIDOS';
  end if;
  partidas := zeli_privado.normalizar_partidas(p_items);
  solicitud_normalizada := jsonb_build_object(
    'partidas',partidas,'direccion',p_direccion,'cupon',codigo_cupon,'terminos',p_terminos_version);
  -- Serializa reintentos del mismo usuario antes de leer el pedido previo.
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_idempotencia::text,0));
  select * into existente from public.pedidos where usuario_id = actor and clave_idempotencia = p_idempotencia;
  if found then
    if existente.solicitud is distinct from solicitud_normalizada then
      raise exception using errcode = '22023', message = 'IDEMPOTENCIA_EN_CONFLICTO';
    end if;
    return jsonb_build_object('id',existente.id,'folio',existente.folio,'total',existente.total,'estado',existente.estado);
  end if;
  select * into envio_datos from public.direcciones
  where id = p_direccion and usuario_id = actor and activa for share;
  if not found then
    raise exception using errcode = '22023', message = 'DIRECCION_INVALIDA';
  end if;

  -- Todos los pedidos toman el cupón antes de las filas de inventario.
  if codigo_cupon is not null then
    select * into cupon from public.cupones
      where codigo = codigo_cupon and activo and inicio <= now() and (fin is null or fin > now())
      for update;
    if not found then
      raise exception using errcode = '22023', message = 'CUPON_INVALIDO';
    end if;
    if cupon.limite_usos is not null and
      (select count(*) from public.pedidos where cupon_id = cupon.id) >= cupon.limite_usos then
      raise exception using errcode = '22023', message = 'CUPON_AGOTADO';
    end if;
  end if;

  for linea in select * from jsonb_to_recordset(partidas) as x(id bigint,cantidad integer) order by id loop
    select v.sku,v.nombre as variante,p.nombre as producto,p.precio + v.precio_adicional as precio,i.cantidad as stock
    into ficha from public.inventario i
    join public.variantes_producto v on v.id = i.variante_id
    join public.productos p on p.id = v.producto_id
    join public.categorias c on c.id = p.categoria_id
    where v.id = linea.id and v.activa and p.activo and c.activa
    for update of i for share of v,p,c;
    if not found or ficha.stock < linea.cantidad then
      raise exception using errcode = 'P0001', message = 'STOCK_INSUFICIENTE_O_INVALIDO';
    end if;
    base := base + ficha.precio * linea.cantidad;
    capturas := capturas || jsonb_build_array(to_jsonb(ficha) || jsonb_build_object(
      'id',linea.id,'cantidad',linea.cantidad));
  end loop;
  -- Reglas de demostración del prototipo, centralizadas en el servidor.
  impuesto := round(base * 0.16,2);
  envio := case when envio_datos.codigo_postal like '88%' then 50 else 60 end;
  if cupon.id is not null then
    descuento_calc := least(base, case when cupon.tipo = 'fijo' then cupon.valor
      else round(base * cupon.valor / 100,2) end);
  end if;
  total_calc := base + impuesto + envio - descuento_calc;
  if p_total_confirmado is distinct from total_calc then
    return jsonb_build_object('estado','requiere_confirmacion','subtotal',base,
      'iva',impuesto,'envio',envio,'descuento',descuento_calc,'total',total_calc);
  end if;
  perform 1 from public.metodos_pago where codigo = 'simulado' and activo for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'PAGO_SIMULADO_NO_DISPONIBLE';
  end if;
  insert into public.pedidos(usuario_id,direccion_id,estado,cupon_id,direccion_entrega,
    terminos_version,clave_idempotencia,solicitud,subtotal,iva,envio,descuento)
  values(actor,p_direccion,'pagado',cupon.id,
    to_jsonb(envio_datos) - array['id','usuario_id','principal','activa'],
    p_terminos_version,p_idempotencia,solicitud_normalizada,base,impuesto,envio,descuento_calc)
  returning * into pedido;
  for linea in select * from jsonb_to_recordset(capturas)
    as x(id bigint,cantidad integer,producto text,variante text,sku text,precio numeric) order by id loop
    insert into public.detalle_pedido(pedido_id,variante_id,nombre_producto,nombre_variante,sku,cantidad,precio_unitario)
    values(pedido.id,linea.id,linea.producto,linea.variante,linea.sku,linea.cantidad,linea.precio);
    perform zeli_privado.mover_stock(linea.id,-linea.cantidad,'venta','Compra simulada',actor,pedido.id);
  end loop;
  insert into public.pagos(pedido_id,metodo,monto,estado) values(pedido.id,'simulado',pedido.total,'aprobado');
  insert into public.historial_estados_pedido(pedido_id,actor_id,estado_nuevo,motivo)
  values(pedido.id,actor,'pagado','Pago simulado aprobado');
  return jsonb_build_object('id',pedido.id,'folio',pedido.folio,'total',pedido.total,'estado',pedido.estado);
end $$;

create function public.cambiar_estado_pedido(
  p_pedido bigint,p_estado text,p_motivo text,p_empresa bigint default null,p_guia text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := zeli_privado.exigir_admin();
  anterior public.pedidos%rowtype;
  linea record;
begin
  select * into anterior from public.pedidos where id = p_pedido for update;
  if not found or coalesce(length(btrim(p_motivo)),0) not between 1 and 500
    or (case anterior.estado
      when 'pagado' then p_estado in ('preparando','cancelado')
      when 'preparando' then p_estado in ('enviado','cancelado')
      when 'enviado' then p_estado = 'entregado'
      else false end) is distinct from true then
    raise exception using errcode = '22023', message = 'TRANSICION_PEDIDO_INVALIDA';
  end if;
  if p_estado = 'enviado' then
    if coalesce(length(btrim(p_guia)),0) not between 1 and 100 or not exists (
      select 1 from public.empresas_paqueteria where id = p_empresa and activa) then
      raise exception using errcode = '22023', message = 'ENVIO_INVALIDO';
    end if;
    insert into public.envios(pedido_id,empresa_id,numero_guia,costo_envio,estado)
    values(p_pedido,p_empresa,btrim(p_guia),anterior.envio,'enviado');
  elsif p_estado = 'entregado' then
    update public.envios set estado = 'entregado',fecha_entrega = now() where pedido_id = p_pedido;
    if not found then
      raise exception using errcode = '22023', message = 'ENVIO_INEXISTENTE';
    end if;
  elsif p_estado = 'cancelado' then
    for linea in select variante_id,cantidad from public.detalle_pedido
      where pedido_id = p_pedido order by variante_id loop
      perform zeli_privado.mover_stock(linea.variante_id,linea.cantidad,'cancelacion',p_motivo,actor,p_pedido);
    end loop;
    insert into public.pagos(pedido_id,metodo,monto,estado)
    values(p_pedido,'simulado',anterior.total,'reembolsado');
  end if;
  update public.pedidos set estado = p_estado where id = p_pedido;
  insert into public.historial_estados_pedido(pedido_id,actor_id,estado_anterior,estado_nuevo,motivo)
  values(p_pedido,actor,anterior.estado,p_estado,p_motivo);
end $$;

-- En devoluciones, cada id recibido identifica una partida del pedido.
create function public.solicitar_devolucion(p_pedido bigint,p_items jsonb,p_motivo text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  solicitud_id bigint;
  partidas jsonb;
  linea record;
  comprada integer;
  comprometida bigint;
begin
  if not zeli_privado.cliente_activo() then
    raise exception using errcode = '42501', message = 'SESION_REQUERIDA';
  end if;
  -- Bloqueo común con la resolución. Serializa solicitudes del mismo pedido.
  perform 1 from public.pedidos where id = p_pedido and usuario_id = actor and estado = 'entregado' for update;
  if not found or coalesce(length(btrim(p_motivo)),0) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'DEVOLUCION_INVALIDA';
  end if;
  partidas := zeli_privado.normalizar_partidas(p_items);
  insert into public.solicitudes_devolucion(pedido_id,usuario_id,motivo)
  values(p_pedido,actor,btrim(p_motivo)) returning id into solicitud_id;
  for linea in select * from jsonb_to_recordset(partidas) as x(id bigint,cantidad integer) loop
    select cantidad into comprada from public.detalle_pedido where id = linea.id and pedido_id = p_pedido;
    if not found then
      raise exception using errcode = '22023', message = 'PARTIDA_AJENA_AL_PEDIDO';
    end if;
    select coalesce(sum(d.cantidad),0) into comprometida
    from public.detalle_devolucion d join public.solicitudes_devolucion s on s.id = d.solicitud_id
    where d.detalle_pedido_id = linea.id and s.estado <> 'rechazada';
    if comprometida + linea.cantidad > comprada then
      raise exception using errcode = '22023', message = 'CANTIDAD_DEVOLUCION_EXCEDIDA';
    end if;
    insert into public.detalle_devolucion(solicitud_id,pedido_id,detalle_pedido_id,cantidad)
    values(solicitud_id,p_pedido,linea.id,linea.cantidad);
  end loop;
  return solicitud_id;
end $$;

-- Aprobar autoriza el retorno. Recibir registra inspección y decide si vuelve a stock.
create function public.resolver_devolucion(
  p_solicitud bigint,p_estado text,p_resolucion text,p_reponer boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := zeli_privado.exigir_admin();
  anterior public.solicitudes_devolucion%rowtype;
  linea record;
begin
  select * into anterior from public.solicitudes_devolucion where id = p_solicitud;
  if not found then
    raise exception using errcode = '22023', message = 'DEVOLUCION_INEXISTENTE';
  end if;
  perform 1 from public.pedidos where id = anterior.pedido_id for update;
  select * into anterior from public.solicitudes_devolucion where id = p_solicitud for update;
  if coalesce(length(btrim(p_resolucion)),0) not between 1 and 1000
    or (case anterior.estado
      when 'solicitada' then p_estado in ('aprobada','rechazada')
      when 'aprobada' then p_estado = 'recibida'
      else false end) is distinct from true
    or p_reponer is null or (p_reponer and p_estado <> 'recibida') then
    raise exception using errcode = '22023', message = 'TRANSICION_DEVOLUCION_INVALIDA';
  end if;
  if p_reponer then
    for linea in select dp.variante_id,d.cantidad
      from public.detalle_devolucion d join public.detalle_pedido dp on dp.id = d.detalle_pedido_id
      where d.solicitud_id = p_solicitud order by dp.variante_id loop
      perform zeli_privado.mover_stock(linea.variante_id,linea.cantidad,'devolucion',
        'Recepción de devolución',actor,anterior.pedido_id,p_solicitud);
    end loop;
  end if;
  update public.solicitudes_devolucion set estado = p_estado,resolucion = btrim(p_resolucion),
    resuelto_en = now() where id = p_solicitud;
  insert into public.auditoria(actor_id,entidad,registro,accion,cambios)
  values(actor,'solicitudes_devolucion',p_solicitud::text,'resolver',
    jsonb_build_object('antes',anterior.estado,'despues',p_estado,'reposicion',p_reponer));
end $$;

-- La asignación inicial de administrador corresponde al propietario de la BD.
create function public.asignar_rol(p_usuario uuid,p_rol text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := zeli_privado.exigir_admin();
  previo text;
begin
  if p_usuario = actor or p_rol is null or p_rol not in ('admin','cliente') then
    raise exception using errcode = '22023', message = 'ASIGNACION_INVALIDA';
  end if;
  select rol into previo from public.usuarios where id = p_usuario for update;
  if not found then
    raise exception using errcode = '22023', message = 'USUARIO_INEXISTENTE';
  end if;
  if previo is distinct from p_rol then
    update public.usuarios set rol = p_rol where id = p_usuario;
    insert into public.auditoria(actor_id,entidad,registro,accion,cambios)
    values(actor,'usuarios',p_usuario::text,'asignar_rol',jsonb_build_object('antes',previo,'despues',p_rol));
  end if;
end $$;

revoke execute on all functions in schema zeli_privado from public, anon, authenticated;
revoke execute on function public.ajustar_inventario(bigint,integer,text,integer),
  public.registrar_pedido(jsonb,bigint,uuid,text,numeric,text),
  public.cambiar_estado_pedido(bigint,text,text,bigint,text),
  public.solicitar_devolucion(bigint,jsonb,text),
  public.resolver_devolucion(bigint,text,text,boolean),public.asignar_rol(uuid,text)
  from public, anon, authenticated;
commit;
