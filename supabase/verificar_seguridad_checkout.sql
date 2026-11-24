-- Ejecutar como propietario en una instancia local o desechable con Supabase Auth
-- y las migraciones 001 a 005 aplicadas. Usar psql -v ON_ERROR_STOP=1.
-- Crea cuentas ficticias y revierte las filas y el disparador de prueba.
-- Las secuencias de la instancia de prueba pueden avanzar.
begin;

do $$
declare
  cliente uuid := gen_random_uuid();
  otro uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  clave_anterior uuid := gen_random_uuid();
  categoria bigint;
  producto bigint;
  variante bigint;
  segunda bigint;
  direccion bigint;
  ajena bigint;
  sufijo text := gen_random_uuid()::text;
begin
  if to_regprocedure('public.registrar_pedido(jsonb,bigint,uuid,text,numeric,text)') is not null then
    raise exception 'La firma antigua de registrar_pedido sigue existiendo';
  end if;
  if to_regprocedure('public.registrar_pedido(jsonb,bigint,uuid,text,numeric,text,text)') is null then
    raise exception 'Falta la nueva firma de registrar_pedido';
  end if;
  if (select count(*) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'registrar_pedido') <> 1 then
    raise exception 'Existe una sobrecarga inesperada de registrar_pedido';
  end if;
  if not has_function_privilege('authenticated',
    'public.registrar_pedido(jsonb,bigint,uuid,text,numeric,text,text)','EXECUTE')
    or has_function_privilege('anon',
      'public.registrar_pedido(jsonb,bigint,uuid,text,numeric,text,text)','EXECUTE') then
    raise exception 'Permisos EXECUTE inesperados para registrar_pedido';
  end if;
  if has_column_privilege('authenticated','public.usuarios','rol','UPDATE')
    or has_column_privilege('authenticated','public.usuarios','activo','UPDATE') then
    raise exception 'El rol authenticated puede modificar rol o activo de usuarios';
  end if;
  if has_table_privilege('authenticated','public.pedidos','INSERT')
    or has_column_privilege('authenticated','public.pedidos','contacto_entrega','INSERT') then
    raise exception 'El rol authenticated tiene permiso para insertar pedidos directamente';
  end if;
  insert into auth.users(id,email,raw_user_meta_data) values
    (cliente,'cliente-' || sufijo || '@example.test','{}'),
    (otro,'otro-' || sufijo || '@example.test','{}'),
    (admin,'admin-' || sufijo || '@example.test','{}');
  update public.usuarios set telefono = ' 8680000001 ' where id = cliente;
  update public.usuarios set rol = 'admin' where id = admin;
  insert into public.direcciones(usuario_id,destinatario,calle,numero,colonia,ciudad,estado,codigo_postal)
    values (cliente,'Comprador','Calle','1','Colonia','Ciudad','Estado','88000') returning id into direccion;
  insert into public.direcciones(usuario_id,destinatario,calle,numero,colonia,ciudad,estado,codigo_postal)
    values (otro,'Otra persona','Calle','2','Colonia','Ciudad','Estado','88000') returning id into ajena;
  insert into public.categorias(slug,nombre) values ('prueba-' || sufijo,'Pruebas')
    returning id into categoria;
  insert into public.productos(categoria_id,slug,nombre,descripcion,precio)
    values (categoria,'prueba-' || sufijo,'Producto ficticio','Prueba de checkout',10) returning id into producto;
  insert into public.variantes_producto(producto_id,sku,nombre)
    values (producto,'primera-' || sufijo,'Primera') returning id into variante;
  insert into public.variantes_producto(producto_id,sku,nombre)
    values (producto,'segunda-' || sufijo,'Segunda') returning id into segunda;
  insert into public.inventario(variante_id,cantidad) values (variante,20),(segunda,12);

  -- Simula la forma de un pedido previo a 005, con más de 10 unidades.
  insert into public.pedidos(usuario_id,direccion_id,estado,direccion_entrega,
    terminos_version,clave_idempotencia,solicitud,subtotal,iva,envio,descuento)
  values (cliente,direccion,'pagado','{}','demo-v1',clave_anterior,
    jsonb_build_object('partidas',jsonb_build_array(jsonb_build_object('id',variante,'cantidad',11)),
      'direccion',direccion,'cupon',null,'terminos','demo-v1'),110,17.6,50,0);

  perform set_config('zeli_checkout.cliente',cliente::text,true);
  perform set_config('zeli_checkout.otro',otro::text,true);
  perform set_config('zeli_checkout.admin',admin::text,true);
  perform set_config('zeli_checkout.correo','cliente-' || sufijo || '@example.test',true);
  perform set_config('zeli_checkout.variante',variante::text,true);
  perform set_config('zeli_checkout.segunda',segunda::text,true);
  perform set_config('zeli_checkout.direccion',direccion::text,true);
  perform set_config('zeli_checkout.ajena',ajena::text,true);
  perform set_config('zeli_checkout.anterior',clave_anterior::text,true);
  perform set_config('zeli_checkout.reversion',gen_random_uuid()::text,true);
end $$;

-- Simula una falla al registrar el pago, después de insertar el pedido y mover inventario.
create function public.zeli_probar_reversion_checkout() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists(select 1 from public.pedidos where id = new.pedido_id
    and clave_idempotencia = current_setting('zeli_checkout.reversion')::uuid) then
    if not exists(select 1 from public.movimientos_inventario m
      where m.pedido_id = new.pedido_id and m.tipo = 'venta') then
      raise exception 'La falla se inyectó antes del movimiento de inventario';
    end if;
    raise exception using errcode = 'P0001', message = 'FALLA_DE_PAGO_DE_PRUEBA';
  end if;
  return new;
end $$;
create trigger zeli_probar_reversion_checkout before insert on public.pagos
  for each row execute function public.zeli_probar_reversion_checkout();

set local role anon;
do $$
begin
  begin
    perform contacto_entrega from public.pedidos;
    raise exception 'Anon pudo consultar contacto_entrega';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.registrar_pedido('[]',0,gen_random_uuid(),'demo-v1',p_telefono_entrega => '8681234567');
    raise exception 'Anon pudo ejecutar registrar_pedido';
  exception when insufficient_privilege then
    if sqlerrm = 'SESION_REQUERIDA' then
      raise exception 'Anon tenía permiso de ejecución para la RPC';
    end if;
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('zeli_checkout.cliente'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('zeli_checkout.cliente'),
    'role','authenticated','email','correo-declarado@example.test')::text,true);
do $$
declare
  variante bigint := current_setting('zeli_checkout.variante')::bigint;
  segunda bigint := current_setting('zeli_checkout.segunda')::bigint;
  direccion bigint := current_setting('zeli_checkout.direccion')::bigint;
  clave uuid := gen_random_uuid();
  anterior uuid := current_setting('zeli_checkout.anterior')::uuid;
  reversion uuid := current_setting('zeli_checkout.reversion')::uuid;
  una jsonb := jsonb_build_array(jsonb_build_object('id',variante,'cantidad',1));
  once jsonb := jsonb_build_array(jsonb_build_object('id',variante,'cantidad',11));
  duplicadas jsonb := jsonb_build_array(jsonb_build_object('id',variante,'cantidad',6),
    jsonb_build_object('id',variante,'cantidad',4),jsonb_build_object('id',segunda,'cantidad',10));
  agrupadas jsonb := jsonb_build_array(jsonb_build_object('id',segunda,'cantidad',10),
    jsonb_build_object('id',variante,'cantidad',10));
  respuesta jsonb;
  pedido bigint;
  telefono_invalido text;
begin
  respuesta := public.registrar_pedido(once,direccion,anterior,'demo-v1');
  if respuesta->>'estado' is distinct from 'pagado' or not exists(
    select 1 from public.pedidos where id = (respuesta->>'id')::bigint
      and clave_idempotencia = anterior and contacto_entrega is null) then
    raise exception 'El reintento de un pedido anterior perdió compatibilidad';
  end if;
  begin
    perform public.registrar_pedido(once,direccion,clave,'demo-v1',p_telefono_entrega => '8681234567');
    raise exception 'Se aceptaron 11 unidades en una partida';
  exception when invalid_parameter_value then
    if sqlerrm <> 'LIMITE_POR_VARIANTE_EXCEDIDO' then raise; end if;
  end;
  begin
    perform public.registrar_pedido(una || duplicadas,direccion,clave,'demo-v1',p_telefono_entrega => '8681234567');
    raise exception 'Se aceptaron 11 unidades repartidas en partidas duplicadas';
  exception when invalid_parameter_value then
    if sqlerrm <> 'LIMITE_POR_VARIANTE_EXCEDIDO' then raise; end if;
  end;
  begin
    perform public.registrar_pedido(una,current_setting('zeli_checkout.ajena')::bigint,clave,'demo-v1',
      p_telefono_entrega => '8681234567');
    raise exception 'Se aceptó una dirección ajena';
  exception when invalid_parameter_value then
    if sqlerrm <> 'DIRECCION_INVALIDA' then raise; end if;
  end;

  begin
    perform public.registrar_pedido(duplicadas,direccion,clave,'demo-v1',282,null::text);
    raise exception 'La llamada anterior de seis argumentos permitió crear un pedido';
  exception when invalid_parameter_value then
    if sqlerrm <> 'TELEFONO_ENTREGA_INVALIDO' then raise; end if;
  end;
  foreach telefono_invalido in array array[null,'','() .-','868123456','528681234567',
    '+1 8681234567','8681234567 ext 1',E'8681234567\n'] loop
    begin
      perform public.registrar_pedido(duplicadas,direccion,clave,'demo-v1',282,
        p_telefono_entrega => telefono_invalido);
      raise exception 'Se aceptó un teléfono ausente o inválido';
    exception when invalid_parameter_value then
      if sqlerrm <> 'TELEFONO_ENTREGA_INVALIDO' then raise; end if;
    end;
  end loop;
  if exists(select 1 from public.pedidos where clave_idempotencia = clave) then
    raise exception 'La validación de teléfono dejó un pedido';
  end if;
  respuesta := public.registrar_pedido(duplicadas,direccion,clave,'demo-v1',0,
    p_telefono_entrega => '8681234567');
  if respuesta->>'estado' is distinct from 'requiere_confirmacion'
    or (respuesta->>'total')::numeric is distinct from 282::numeric
    or exists(select 1 from public.pedidos where clave_idempotencia = clave) then
    raise exception 'Cotización incorrecta o con efectos de escritura';
  end if;
  respuesta := public.registrar_pedido(duplicadas,direccion,clave,'demo-v1',282,
    p_telefono_entrega => '+52 (868) 123-45.67');
  pedido := (respuesta->>'id')::bigint;
  perform set_config('zeli_checkout.pedido',pedido::text,true);
  perform set_config('zeli_checkout.clave',clave::text,true);
  if respuesta->>'estado' is distinct from 'pagado' or respuesta ? 'contacto_entrega'
    or (select contacto_entrega from public.pedidos where id = pedido) is distinct from
      jsonb_build_object('correo',current_setting('zeli_checkout.correo'),'telefono','+528681234567')
    or (select count(*) from public.detalle_pedido where pedido_id = pedido and cantidad = 10) <> 2
    or (select count(*) from public.pagos where pedido_id = pedido and monto = 282) <> 1 then
    raise exception 'Pedido, cantidades agrupadas o contacto incorrectos';
  end if;
  if public.registrar_pedido(agrupadas,direccion,clave,'demo-v1',
    p_telefono_entrega => '868 123 4567') is distinct from respuesta then
    raise exception 'Cambiar la agrupación alteró el resultado idempotente';
  end if;
  begin
    perform public.registrar_pedido(una,direccion,clave,'demo-v1',p_telefono_entrega => '8681234567');
    raise exception 'Se permitió reutilizar la clave para otra solicitud';
  exception when invalid_parameter_value then
    if sqlerrm <> 'IDEMPOTENCIA_EN_CONFLICTO' then raise; end if;
  end;
  begin
    perform public.registrar_pedido(agrupadas,direccion,clave,'demo-v1',p_telefono_entrega => '8687654321');
    raise exception 'La misma clave aceptó un teléfono distinto';
  exception when invalid_parameter_value then
    if sqlerrm <> 'IDEMPOTENCIA_EN_CONFLICTO' then raise; end if;
  end;
  begin
    update public.pedidos set contacto_entrega = null where id = pedido;
    if found then raise exception 'El cliente pudo alterar el contacto histórico'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.registrar_pedido(una,direccion,reversion,'demo-v1',61.60,
      p_telefono_entrega => '8681234567');
    raise exception 'Se esperaba una falla al registrar el pago';
  exception when raise_exception then
    if sqlerrm <> 'FALLA_DE_PAGO_DE_PRUEBA' then raise; end if;
  end;
  if exists(select 1 from public.pedidos where clave_idempotencia = reversion) then
    raise exception 'La falla dejó un pedido parcial';
  end if;
  update public.usuarios set telefono = '8680000002' where id = auth.uid();
  if not found then raise exception 'El cliente no pudo actualizar su propio perfil'; end if;
end $$;
reset role;

update auth.users set email = 'actualizado-' || id::text || '@example.test'
where id = current_setting('zeli_checkout.cliente')::uuid;

set local role authenticated;
do $$
declare
  pedido bigint := current_setting('zeli_checkout.pedido')::bigint;
  variante bigint := current_setting('zeli_checkout.variante')::bigint;
  segunda bigint := current_setting('zeli_checkout.segunda')::bigint;
  direccion bigint := current_setting('zeli_checkout.direccion')::bigint;
  clave uuid := current_setting('zeli_checkout.clave')::uuid;
  respuesta jsonb;
begin
  respuesta := public.registrar_pedido(jsonb_build_array(jsonb_build_object('id',variante,'cantidad',10),
    jsonb_build_object('id',segunda,'cantidad',10)),direccion,clave,'demo-v1',
    p_telefono_entrega => '+528681234567');
  if (respuesta->>'id')::bigint is distinct from pedido or
    (select contacto_entrega from public.pedidos where id = pedido) is distinct from
    jsonb_build_object('correo',current_setting('zeli_checkout.correo'),'telefono','+528681234567') then
    raise exception 'El reintento sobrescribió el contacto histórico';
  end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('zeli_checkout.otro'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('zeli_checkout.otro'),
    'role','authenticated')::text,true);
do $$
declare
  variante bigint := current_setting('zeli_checkout.segunda')::bigint;
  direccion bigint := current_setting('zeli_checkout.ajena')::bigint;
  una jsonb := jsonb_build_array(jsonb_build_object('id',variante,'cantidad',1));
  respuesta jsonb;
begin
  if exists(select contacto_entrega from public.pedidos where id = current_setting('zeli_checkout.pedido')::bigint) then
    raise exception 'Un cliente pudo leer el contacto de otro';
  end if;
  update public.usuarios set telefono = '000' where id = current_setting('zeli_checkout.cliente')::uuid;
  if found then raise exception 'Un cliente pudo cambiar el teléfono de otro'; end if;
  begin
    perform public.registrar_pedido(jsonb_build_array(jsonb_build_object('id',variante,'cantidad',3)),
      direccion,gen_random_uuid(),'demo-v1',p_telefono_entrega => '8681234567');
    raise exception 'Se aceptó una cantidad dentro del tope pero superior al stock';
  exception when raise_exception then
    if sqlerrm <> 'STOCK_INSUFICIENTE_O_INVALIDO' then raise; end if;
  end;
  respuesta := public.registrar_pedido(una,direccion,gen_random_uuid(),'demo-v1',61.60,
    p_telefono_entrega => '8687654321');
  if (select contacto_entrega->>'telefono' from public.pedidos where id = (respuesta->>'id')::bigint)
    is distinct from '+528687654321' then
    raise exception 'El pedido de una cuenta sin teléfono de perfil no capturó el teléfono de entrega';
  end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('zeli_checkout.admin'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('zeli_checkout.admin'),
    'role','authenticated')::text,true);
do $$
declare
  pedido bigint := current_setting('zeli_checkout.pedido')::bigint;
  variante bigint := current_setting('zeli_checkout.variante')::bigint;
begin
  if (select contacto_entrega->>'telefono' from public.pedidos where id = pedido)
    is distinct from '+528681234567' then
    raise exception 'El administrador no pudo leer el contacto autorizado';
  end if;
  if (select cantidad from public.inventario where variante_id = variante) is distinct from 10
    or (select count(*) from public.movimientos_inventario where variante_id = variante and tipo = 'venta') <> 1
    or (select count(*) from public.historial_estados_pedido where pedido_id = pedido) <> 1 then
    raise exception 'La falla o el reintento dejó movimientos, historial o stock incorrectos';
  end if;
end $$;
reset role;
rollback;
select 'Verificación de seguridad del checkout completada' as resultado;
