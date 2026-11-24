-- 001. Veinte tablas originales y cinco ampliaciones.
begin;

create table public.roles (
  codigo text primary key,
  nombre text not null
);
create table public.usuarios (
  id uuid primary key references auth.users(id) on delete restrict,
  rol text not null default 'cliente' references public.roles(codigo),
  nombre text not null check (length(btrim(nombre)) between 1 and 100),
  telefono text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create table public.direcciones (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.usuarios(id),
  destinatario text not null, calle text not null, numero text not null,
  colonia text not null, ciudad text not null, estado text not null,
  codigo_postal text not null check (codigo_postal ~ '^[0-9]{5}$'),
  referencia text,
  principal boolean not null default false,
  activa boolean not null default true,
  unique (id, usuario_id)
);
create unique index direccion_principal on public.direcciones(usuario_id) where principal and activa;

create table public.categorias (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null, descripcion text, activa boolean not null default true
);
create table public.productos (
  id bigint generated always as identity primary key,
  categoria_id bigint not null references public.categorias(id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null, descripcion text not null,
  precio numeric(12,2) not null check (precio >= 0 and precio < 'Infinity'::numeric),
  precio_anterior numeric(12,2) check (precio_anterior > precio and precio_anterior < 'Infinity'::numeric),
  peso_g integer check (peso_g > 0),
  largo_mm integer check (largo_mm > 0),
  ancho_mm integer check (ancho_mm > 0),
  alto_mm integer check (alto_mm > 0),
  activo boolean not null default true
);
create index productos_categoria on public.productos(categoria_id, activo);
create table public.variantes_producto (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos(id),
  sku text not null unique check (length(btrim(sku)) > 0),
  nombre text not null,
  precio_adicional numeric(12,2) not null default 0
    check (precio_adicional >= 0 and precio_adicional < 'Infinity'::numeric),
  predeterminada boolean not null default false,
  activa boolean not null default true,
  unique (producto_id, nombre)
);
create unique index variante_predeterminada on public.variantes_producto(producto_id)
  where predeterminada and activa;
create table public.imagenes_producto (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos(id),
  ruta text not null, texto_alternativo text not null,
  orden integer not null default 0 check (orden >= 0),
  principal boolean not null default false,
  unique (producto_id, ruta)
);
create unique index imagen_principal on public.imagenes_producto(producto_id) where principal;
create table public.inventario (
  variante_id bigint primary key references public.variantes_producto(id),
  cantidad integer not null default 0 check (cantidad >= 0),
  stock_minimo integer not null default 5 check (stock_minimo >= 0),
  actualizado_en timestamptz not null default now()
);

create table public.carritos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.usuarios(id),
  estado text not null default 'activo' check (estado in ('activo','cerrado')),
  creado_en timestamptz not null default now()
);
create unique index carrito_activo on public.carritos(usuario_id) where estado = 'activo';
create index carritos_usuario on public.carritos(usuario_id);
create table public.carrito_detalle (
  carrito_id bigint references public.carritos(id) on delete cascade,
  variante_id bigint references public.variantes_producto(id),
  cantidad integer not null check (cantidad > 0),
  primary key (carrito_id, variante_id)
);
create index carrito_detalle_variante on public.carrito_detalle(variante_id);
create table public.cupones (
  id bigint generated always as identity primary key,
  codigo text not null unique check (codigo ~ '^[A-Z0-9_-]+$'),
  descripcion text,
  tipo text not null check (tipo in ('fijo','porcentaje')),
  valor numeric(12,2) not null check (valor > 0 and valor < 'Infinity'::numeric),
  inicio timestamptz not null default now(), fin timestamptz,
  limite_usos integer check (limite_usos > 0),
  activo boolean not null default true,
  check (fin is null or fin > inicio),
  check (tipo <> 'porcentaje' or valor <= 100)
);
create table public.estados_pedido (codigo text primary key, nombre text not null);
create table public.metodos_pago (codigo text primary key, nombre text not null, activo boolean not null default true);
create table public.empresas_paqueteria (
  id bigint generated always as identity primary key,
  nombre text not null unique, telefono text, sitio_web text,
  activa boolean not null default true
);

create table public.pedidos (
  id bigint generated always as identity primary key,
  folio uuid not null unique default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id),
  direccion_id bigint not null,
  foreign key (direccion_id, usuario_id) references public.direcciones(id, usuario_id),
  estado text not null references public.estados_pedido(codigo),
  cupon_id bigint references public.cupones(id),
  direccion_entrega jsonb not null check (jsonb_typeof(direccion_entrega) = 'object'),
  terminos_version text not null,
  terminos_aceptados_en timestamptz not null default now(),
  clave_idempotencia uuid not null,
  solicitud jsonb not null,
  creado_en timestamptz not null default now(),
  subtotal numeric(12,2) not null check (subtotal >= 0 and subtotal < 'Infinity'::numeric),
  iva numeric(12,2) not null check (iva >= 0 and iva < 'Infinity'::numeric),
  envio numeric(12,2) not null check (envio >= 0 and envio < 'Infinity'::numeric),
  descuento numeric(12,2) not null check (descuento between 0 and subtotal),
  total numeric(12,2) generated always as (subtotal + iva + envio - descuento) stored,
  unique (usuario_id, clave_idempotencia),
  unique (id, usuario_id)
);
create index pedidos_usuario_fecha on public.pedidos(usuario_id, creado_en desc);
create index pedidos_estado_fecha on public.pedidos(estado, creado_en desc);
create index pedidos_direccion on public.pedidos(direccion_id, usuario_id);
create index pedidos_cupon on public.pedidos(cupon_id) where cupon_id is not null;
create table public.detalle_pedido (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references public.pedidos(id),
  variante_id bigint not null references public.variantes_producto(id),
  nombre_producto text not null, nombre_variante text not null, sku text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0 and precio_unitario < 'Infinity'::numeric),
  subtotal numeric(12,2) generated always as (cantidad * precio_unitario) stored,
  unique (pedido_id, variante_id),
  unique (id, pedido_id)
);
create index detalle_pedido_variante on public.detalle_pedido(variante_id);
create table public.pagos (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references public.pedidos(id),
  metodo text not null references public.metodos_pago(codigo),
  referencia uuid not null unique default gen_random_uuid(),
  monto numeric(12,2) not null check (monto >= 0 and monto < 'Infinity'::numeric),
  estado text not null check (estado in ('aprobado','reembolsado')),
  creado_en timestamptz not null default now(),
  unique (pedido_id, estado)
);
create table public.envios (
  id bigint generated always as identity primary key,
  pedido_id bigint not null unique references public.pedidos(id),
  empresa_id bigint not null references public.empresas_paqueteria(id),
  numero_guia text not null,
  fecha_envio timestamptz not null default now(), fecha_entrega timestamptz,
  costo_envio numeric(12,2) not null check (costo_envio >= 0 and costo_envio < 'Infinity'::numeric),
  estado text not null check (estado in ('enviado','entregado')),
  check (fecha_entrega is null or fecha_entrega >= fecha_envio),
  unique (empresa_id, numero_guia)
);
create table public.lista_deseos (
  usuario_id uuid references public.usuarios(id),
  producto_id bigint references public.productos(id),
  creado_en timestamptz not null default now(),
  primary key (usuario_id, producto_id)
);
create index lista_deseos_producto on public.lista_deseos(producto_id);
create table public.resenas (
  usuario_id uuid references public.usuarios(id),
  producto_id bigint references public.productos(id),
  calificacion smallint not null check (calificacion between 1 and 5),
  comentario text check (length(comentario) <= 500),
  moderacion text not null default 'pendiente' check (moderacion in ('pendiente','publicada','rechazada')),
  creado_en timestamptz not null default now(),
  primary key (usuario_id, producto_id)
);
create index resenas_producto on public.resenas(producto_id, moderacion);

-- Ampliaciones.
create table public.solicitudes_devolucion (
  id bigint generated always as identity primary key,
  pedido_id bigint not null,
  usuario_id uuid not null,
  foreign key (pedido_id, usuario_id) references public.pedidos(id, usuario_id),
  motivo text not null check (length(btrim(motivo)) between 1 and 1000),
  estado text not null default 'solicitada' check (estado in ('solicitada','aprobada','rechazada','recibida')),
  resolucion text,
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  unique (id, pedido_id)
);
create index devoluciones_pedido on public.solicitudes_devolucion(pedido_id);
create index devoluciones_usuario on public.solicitudes_devolucion(usuario_id, creado_en desc);
create index devoluciones_estado on public.solicitudes_devolucion(estado, creado_en);
create table public.detalle_devolucion (
  solicitud_id bigint not null,
  pedido_id bigint not null,
  detalle_pedido_id bigint not null,
  cantidad integer not null check (cantidad > 0),
  primary key (solicitud_id, detalle_pedido_id),
  foreign key (solicitud_id, pedido_id) references public.solicitudes_devolucion(id, pedido_id),
  foreign key (detalle_pedido_id, pedido_id) references public.detalle_pedido(id, pedido_id)
);
create index detalle_devolucion_partida on public.detalle_devolucion(detalle_pedido_id, pedido_id);
create table public.movimientos_inventario (
  id bigint generated always as identity primary key,
  variante_id bigint not null references public.inventario(variante_id),
  pedido_id bigint references public.pedidos(id),
  devolucion_id bigint references public.solicitudes_devolucion(id),
  actor_id uuid references public.usuarios(id),
  tipo text not null check (tipo in ('inicial','ajuste','venta','cancelacion','devolucion')),
  variacion integer not null check (variacion <> 0),
  saldo integer not null check (saldo >= 0),
  motivo text not null,
  creado_en timestamptz not null default now(),
  check (
    (tipo in ('inicial','ajuste') and pedido_id is null and devolucion_id is null)
    or (tipo = 'venta' and variacion < 0 and pedido_id is not null and devolucion_id is null)
    or (tipo = 'cancelacion' and variacion > 0 and pedido_id is not null and devolucion_id is null)
    or (tipo = 'devolucion' and variacion > 0 and pedido_id is not null and devolucion_id is not null)
  )
);
create index movimientos_variante_fecha on public.movimientos_inventario(variante_id, creado_en desc, id desc);
create unique index movimiento_venta_cancelacion on public.movimientos_inventario(pedido_id, variante_id, tipo)
  where tipo in ('venta','cancelacion');
create unique index movimiento_devolucion on public.movimientos_inventario(devolucion_id, variante_id)
  where tipo = 'devolucion';
create unique index movimiento_inicial on public.movimientos_inventario(variante_id) where tipo = 'inicial';
create table public.historial_estados_pedido (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references public.pedidos(id),
  actor_id uuid references public.usuarios(id),
  estado_anterior text references public.estados_pedido(codigo),
  estado_nuevo text not null references public.estados_pedido(codigo),
  motivo text not null,
  creado_en timestamptz not null default now()
);
create index historial_pedido_fecha on public.historial_estados_pedido(pedido_id, creado_en, id);
create table public.auditoria (
  id bigint generated always as identity primary key,
  actor_id uuid references public.usuarios(id),
  entidad text not null, registro text not null, accion text not null,
  cambios jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
create index auditoria_entidad_registro on public.auditoria(entidad, registro, creado_en);

-- Cerrar acceso desde la primera migración. 003 aplica permisos explícitos.
do $$
declare tabla text;
begin
  foreach tabla in array array[
    'roles','usuarios','direcciones','categorias','productos','variantes_producto',
    'imagenes_producto','inventario','carritos','carrito_detalle','cupones','pedidos',
    'detalle_pedido','estados_pedido','metodos_pago','pagos','envios','empresas_paqueteria',
    'lista_deseos','resenas','movimientos_inventario','historial_estados_pedido',
    'solicitudes_devolucion','detalle_devolucion','auditoria'
  ] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('revoke all on table public.%I from public, anon, authenticated', tabla);
  end loop;
end $$;
commit;
