-- 003. Privilegios explícitos y políticas de acceso a través de PostgREST.
begin;
grant usage on schema zeli_privado to anon, authenticated;
grant execute on function zeli_privado.es_admin() to anon, authenticated;
grant execute on function zeli_privado.cliente_activo() to authenticated;

grant select on public.categorias, public.productos, public.variantes_producto,
  public.imagenes_producto, public.estados_pedido, public.metodos_pago, public.resenas to anon, authenticated;

grant select on public.roles, public.usuarios, public.direcciones, public.carritos,
  public.carrito_detalle, public.cupones, public.pedidos, public.detalle_pedido,
  public.pagos, public.envios, public.empresas_paqueteria, public.lista_deseos,
  public.inventario, public.movimientos_inventario, public.historial_estados_pedido,
  public.solicitudes_devolucion, public.detalle_devolucion, public.auditoria to authenticated;

-- Clientes no pueden escribir rol, activo, moderación ni registros transaccionales.
grant update(nombre,telefono) on public.usuarios to authenticated;
grant insert(usuario_id,destinatario,calle,numero,colonia,ciudad,estado,codigo_postal,referencia,principal,activa),
  update(destinatario,calle,numero,colonia,ciudad,estado,codigo_postal,referencia,principal,activa)
  on public.direcciones to authenticated;
grant insert(usuario_id), update(estado) on public.carritos to authenticated;
grant insert(carrito_id,variante_id,cantidad), update(cantidad), delete on public.carrito_detalle to authenticated;
grant insert(usuario_id,producto_id), delete on public.lista_deseos to authenticated;
grant insert(usuario_id,producto_id,calificacion,comentario), delete on public.resenas to authenticated;

-- Estas escrituras están disponibles al rol de conexión authenticated,
-- y las políticas de filas limitan su uso al administrador de Zeli.
grant insert, update on public.categorias, public.productos, public.variantes_producto,
  public.imagenes_producto, public.cupones, public.empresas_paqueteria, public.metodos_pago to authenticated;
grant delete on public.imagenes_producto to authenticated;

grant execute on function public.registrar_pedido(jsonb,bigint,uuid,text,numeric,text),
  public.solicitar_devolucion(bigint,jsonb,text), public.ajustar_inventario(bigint,integer,text,integer),
  public.cambiar_estado_pedido(bigint,text,text,bigint,text),
  public.resolver_devolucion(bigint,text,text,boolean),public.asignar_rol(uuid,text) to authenticated;

create policy categorias_lectura on public.categorias for select to anon, authenticated
  using (activa or zeli_privado.es_admin());
create policy productos_lectura on public.productos for select to anon, authenticated
  using ((activo and exists(select 1 from public.categorias c where c.id = categoria_id and c.activa))
    or zeli_privado.es_admin());
create policy variantes_lectura on public.variantes_producto for select to anon, authenticated
  using ((activa and exists(select 1 from public.productos p where p.id = producto_id and p.activo))
    or zeli_privado.es_admin());
create policy imagenes_lectura on public.imagenes_producto for select to anon, authenticated
  using (exists(select 1 from public.productos p where p.id = producto_id));
create policy estados_lectura on public.estados_pedido for select to anon, authenticated using (true);
create policy metodos_lectura on public.metodos_pago for select to anon, authenticated
  using (activo or zeli_privado.es_admin());
create policy roles_admin on public.roles for select to authenticated using (zeli_privado.es_admin());
create policy usuarios_lectura on public.usuarios for select to authenticated
  using (id = (select auth.uid()) or zeli_privado.es_admin());
create policy usuarios_edicion on public.usuarios for update to authenticated
  using (id = (select auth.uid()) and activo) with check (id = (select auth.uid()) and activo);

create policy direcciones_lectura on public.direcciones for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy direcciones_alta on public.direcciones for insert to authenticated
  with check (usuario_id = (select auth.uid()) and zeli_privado.cliente_activo());
create policy direcciones_edicion on public.direcciones for update to authenticated
  using (usuario_id = (select auth.uid()) and zeli_privado.cliente_activo())
  with check (usuario_id = (select auth.uid()) and zeli_privado.cliente_activo());
create policy carritos_lectura on public.carritos for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy carritos_alta on public.carritos for insert to authenticated
  with check (usuario_id = (select auth.uid()) and estado = 'activo' and zeli_privado.cliente_activo());
create policy carritos_cierre on public.carritos for update to authenticated
  using (usuario_id = (select auth.uid()) and estado = 'activo' and zeli_privado.cliente_activo())
  with check (usuario_id = (select auth.uid()) and estado = 'cerrado');
create policy carrito_detalle_lectura on public.carrito_detalle for select to authenticated
  using (exists(select 1 from public.carritos c where c.id = carrito_id and c.usuario_id = (select auth.uid())));
create policy carrito_detalle_escritura on public.carrito_detalle for all to authenticated
  using (zeli_privado.cliente_activo() and exists(select 1 from public.carritos c
    where c.id = carrito_id and c.usuario_id = (select auth.uid()) and c.estado = 'activo'))
  with check (zeli_privado.cliente_activo() and exists(select 1 from public.carritos c
    where c.id = carrito_id and c.usuario_id = (select auth.uid()) and c.estado = 'activo')
    and exists(select 1 from public.variantes_producto v where v.id = variante_id and v.activa));
create policy deseos_propios on public.lista_deseos for all to authenticated
  using (usuario_id = (select auth.uid()) and zeli_privado.cliente_activo())
  with check (usuario_id = (select auth.uid()) and zeli_privado.cliente_activo()
    and exists(select 1 from public.productos p where p.id = producto_id and p.activo));
create policy resenas_lectura on public.resenas for select to anon, authenticated
  using (zeli_privado.es_admin() or usuario_id = (select auth.uid()) or
    (moderacion = 'publicada' and exists(select 1 from public.productos p where p.id = producto_id)));
create policy resenas_alta on public.resenas for insert to authenticated
  with check (usuario_id = (select auth.uid()) and moderacion = 'pendiente'
    and zeli_privado.cliente_activo() and exists(select 1 from public.productos p where p.id = producto_id));
create policy resenas_baja on public.resenas for delete to authenticated
  using (usuario_id = (select auth.uid()) and zeli_privado.cliente_activo());

create policy pedidos_lectura on public.pedidos for select to authenticated
  using (usuario_id = (select auth.uid()) or zeli_privado.es_admin());
create policy devoluciones_lectura on public.solicitudes_devolucion for select to authenticated
  using (usuario_id = (select auth.uid()) or zeli_privado.es_admin());
create policy devolucion_partidas_lectura on public.detalle_devolucion for select to authenticated
  using (exists(select 1 from public.solicitudes_devolucion s where s.id = solicitud_id));

-- Las subconsultas heredan RLS del pedido y funcionan también para administradores.
do $$
declare tabla text;
begin
  foreach tabla in array array['detalle_pedido','pagos','envios','historial_estados_pedido'] loop
    execute format('create policy lectura_desde_pedido on public.%I for select to authenticated
      using (exists(select 1 from public.pedidos p where p.id = pedido_id))',tabla);
  end loop;
  foreach tabla in array array['categorias','productos','variantes_producto',
    'imagenes_producto','cupones','empresas_paqueteria','metodos_pago'] loop
    execute format('create policy gestionar_catalogo on public.%I for all to authenticated
      using (zeli_privado.es_admin()) with check (zeli_privado.es_admin())',tabla);
  end loop;
  foreach tabla in array array['inventario','movimientos_inventario','auditoria'] loop
    execute format('create policy lectura_admin on public.%I for select to authenticated
      using (zeli_privado.es_admin())',tabla);
  end loop;
end $$;

create policy paqueterias_lectura on public.empresas_paqueteria for select to authenticated
  using (activa);
-- Exponer disponibilidad sin cantidades internas, umbrales ni inventario inactivo.
create function public.disponibilidad_catalogo(p_variantes bigint[])
returns table(variante_id bigint, disponible boolean)
language sql stable security definer set search_path = '' as $$
  select v.id, coalesce(i.cantidad > 0,false)
  from public.variantes_producto v
  join public.productos p on p.id = v.producto_id
  join public.categorias c on c.id = p.categoria_id
  left join public.inventario i on i.variante_id = v.id
  where v.activa and p.activo and c.activa
    and cardinality(p_variantes) between 1 and 100 and v.id = any(p_variantes);
$$;
revoke execute on function public.disponibilidad_catalogo(bigint[]) from public, anon, authenticated;
grant execute on function public.disponibilidad_catalogo(bigint[]) to anon, authenticated;
commit;
