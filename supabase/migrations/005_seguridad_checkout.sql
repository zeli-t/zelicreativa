-- 005. Limite de compra por variante y copia historica de contacto.
begin;

-- NULL identifica pedidos anteriores sin una captura de contacto.
alter table public.pedidos add column contacto_entrega jsonb
  constraint pedidos_contacto_entrega_valido check (
    contacto_entrega is null or (
      jsonb_typeof(contacto_entrega) is not distinct from 'object'
      and jsonb_typeof(contacto_entrega->'correo') is not distinct from 'string'
      and coalesce(length(btrim(contacto_entrega->>'correo')),0) > 0
      and jsonb_typeof(contacto_entrega->'telefono') is not distinct from 'string'
      and (contacto_entrega->>'telefono') ~ '^[+]52[0-9]{10}$'
    )
  );

comment on column public.pedidos.contacto_entrega is
  'Contacto al registrar el pedido: correo de Auth y teléfono de entrega normalizado.';
-- La politica pedidos_lectura sigue limitando la lectura al comprador y a administradores.
revoke select on public.pedidos from public, anon;

-- Sin CASCADE: una dependencia inesperada debe detener y revertir la migración.
drop function public.registrar_pedido(jsonb,bigint,uuid,text,numeric,text) restrict;

create function public.registrar_pedido(
  p_items jsonb, p_direccion bigint, p_idempotencia uuid, p_terminos_version text,
  p_total_confirmado numeric default null, p_cupon text default null,
  p_telefono_entrega text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  partidas jsonb;
  solicitud_normalizada jsonb;
  envio_datos public.direcciones%rowtype;
  contacto jsonb;
  telefono_compacto text := translate(p_telefono_entrega,' ().-' || chr(9),'');
  telefono_normalizado text;
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
  -- Los mismos separadores y dígitos ASCII que acepta el checkout.
  telefono_normalizado := case
    when telefono_compacto collate "C" ~ '^[0-9]{10}$' then '+52' || telefono_compacto
    when telefono_compacto collate "C" ~ '^[+]52[0-9]{10}$' then telefono_compacto
    else null
  end;
  partidas := zeli_privado.normalizar_partidas(p_items);
  solicitud_normalizada := jsonb_build_object(
    'partidas',partidas,'direccion',p_direccion,'cupon',codigo_cupon,'terminos',p_terminos_version);
  -- Serializa reintentos del mismo usuario antes de leer el pedido previo.
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_idempotencia::text,0));
  select * into existente from public.pedidos where usuario_id = actor and clave_idempotencia = p_idempotencia;
  if found then
    if existente.solicitud is distinct from solicitud_normalizada
      or (existente.contacto_entrega is not null
        and existente.contacto_entrega->>'telefono' is distinct from telefono_normalizado) then
      raise exception using errcode = '22023', message = 'IDEMPOTENCIA_EN_CONFLICTO';
    end if;
    return jsonb_build_object('id',existente.id,'folio',existente.folio,'total',existente.total,'estado',existente.estado);
  end if;
  -- El valor por defecto permite reintentar pedidos históricos sin teléfono.
  if telefono_normalizado is null then
    raise exception using errcode = '22023', message = 'TELEFONO_ENTREGA_INVALIDO';
  end if;
  -- Los reintentos de pedidos anteriores conservan su resultado, incluso si excedian el tope.
  if exists (select 1 from jsonb_to_recordset(partidas) as x(id bigint,cantidad integer)
    where cantidad > 10) then
    raise exception using errcode = '22023', message = 'LIMITE_POR_VARIANTE_EXCEDIDO';
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
  -- Lee el contacto de la misma cuenta que se usa para autorizar el pedido.
  select jsonb_build_object('correo',nullif(btrim(a.email),''),
    'telefono',telefono_normalizado)
  into contacto
  from auth.users a
  join public.usuarios u on u.id = a.id
  where a.id = actor and u.activo;
  if contacto->>'correo' is null then
    raise exception using errcode = '22023', message = 'CORREO_ENTREGA_REQUERIDO';
  end if;

  insert into public.pedidos(usuario_id,direccion_id,estado,cupon_id,direccion_entrega,contacto_entrega,
    terminos_version,clave_idempotencia,solicitud,subtotal,iva,envio,descuento)
  values(actor,p_direccion,'pagado',cupon.id,
    to_jsonb(envio_datos) - array['id','usuario_id','principal','activa'],contacto,
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

revoke execute on function public.registrar_pedido(jsonb,bigint,uuid,text,numeric,text,text)
  from public, anon, authenticated;
grant execute on function public.registrar_pedido(jsonb,bigint,uuid,text,numeric,text,text)
  to authenticated;

commit;
