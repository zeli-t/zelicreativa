# Diccionario de datos

Fuente de verdad: migraciones 001–005. Esquema public salvo indicación. Los tipos incluyen tamaño cuando está definido; text y jsonb no tienen longitud declarada. PK implica NOT NULL. Las restricciones compuestas se listan con su definición y generan índice cuando son PK o UNIQUE.

## roles

Catálogo de roles.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| codigo | text | No | primary key |
| nombre | text | No | not null |

## usuarios

Perfil vinculado a Auth.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | uuid | No | primary key references auth.users(id) on delete restrict |
| rol | text | No | not null default 'cliente' references public.roles(codigo) |
| nombre | text | No | not null check (length(btrim(nombre)) between 1 and 100) |
| telefono | text | Sí | — |
| activo | boolean | No | not null default true |
| creado_en | timestamptz | No | not null default now() |

## direcciones

Direcciones del cliente.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| usuario_id | uuid | No | not null references public.usuarios(id) |
| destinatario | text | No | not null |
| calle | text | No | not null |
| numero | text | No | not null |
| colonia | text | No | not null |
| ciudad | text | No | not null |
| estado | text | No | not null |
| codigo_postal | text | No | not null check (codigo_postal ~ '^[0-9]{5}$') |
| referencia | text | Sí | — |
| principal | boolean | No | not null default false |
| activa | boolean | No | not null default true |

- `unique (id, usuario_id)`
- `create unique index direccion_principal on public.direcciones(usuario_id) where principal and activa;`

## categorias

Clasificación del catálogo.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| slug | text | No | not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') |
| nombre | text | No | not null |
| descripcion | text | Sí | — |
| activa | boolean | No | not null default true |

## productos

Ficha comercial.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| categoria_id | bigint | No | not null references public.categorias(id) |
| slug | text | No | not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') |
| nombre | text | No | not null |
| descripcion | text | No | not null |
| precio | numeric(12,2) | No | not null check (precio >= 0 and precio < 'Infinity'::numeric) |
| precio_anterior | numeric(12,2) | Sí | check (precio_anterior > precio and precio_anterior < 'Infinity'::numeric) |
| peso_g | integer | Sí | check (peso_g > 0) |
| largo_mm | integer | Sí | check (largo_mm > 0) |
| ancho_mm | integer | Sí | check (ancho_mm > 0) |
| alto_mm | integer | Sí | check (alto_mm > 0) |
| activo | boolean | No | not null default true |

- `create index productos_categoria on public.productos(categoria_id, activo);`

## variantes_producto

Variantes con SKU y precio.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| producto_id | bigint | No | not null references public.productos(id) |
| sku | text | No | not null unique check (length(btrim(sku)) > 0) |
| nombre | text | No | not null |
| precio_adicional | numeric(12,2) | No | not null default 0 check (precio_adicional >= 0 and precio_adicional < 'Infinity'::numeric) |
| predeterminada | boolean | No | not null default false |
| activa | boolean | No | not null default true |

- `unique (producto_id, nombre)`
- `create unique index variante_predeterminada on public.variantes_producto(producto_id) where predeterminada and activa;`

## imagenes_producto

Galería de productos.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| producto_id | bigint | No | not null references public.productos(id) |
| ruta | text | No | not null |
| texto_alternativo | text | No | not null |
| orden | integer | No | not null default 0 check (orden >= 0) |
| principal | boolean | No | not null default false |

- `unique (producto_id, ruta)`
- `create unique index imagen_principal on public.imagenes_producto(producto_id) where principal;`

## inventario

Saldo por variante.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| variante_id | bigint | No | primary key references public.variantes_producto(id) |
| cantidad | integer | No | not null default 0 check (cantidad >= 0) |
| stock_minimo | integer | No | not null default 5 check (stock_minimo >= 0) |
| actualizado_en | timestamptz | No | not null default now() |

## carritos

Cabecera de carrito.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| usuario_id | uuid | No | not null references public.usuarios(id) |
| estado | text | No | not null default 'activo' check (estado in ('activo','cerrado')) |
| creado_en | timestamptz | No | not null default now() |

- `create unique index carrito_activo on public.carritos(usuario_id) where estado = 'activo';`
- `create index carritos_usuario on public.carritos(usuario_id);`

## carrito_detalle

Partidas de carrito.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| carrito_id | bigint | No | PK compuesta. references public.carritos(id) on delete cascade |
| variante_id | bigint | No | PK compuesta. references public.variantes_producto(id) |
| cantidad | integer | No | not null check (cantidad > 0) |

- `primary key (carrito_id, variante_id)`
- `create index carrito_detalle_variante on public.carrito_detalle(variante_id);`

## cupones

Reglas de promoción.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| codigo | text | No | not null unique check (codigo ~ '^[A-Z0-9_-]+$') |
| descripcion | text | Sí | — |
| tipo | text | No | not null check (tipo in ('fijo','porcentaje')) |
| valor | numeric(12,2) | No | not null check (valor > 0 and valor < 'Infinity'::numeric) |
| inicio | timestamptz | No | not null default now() |
| fin | timestamptz | Sí | — |
| limite_usos | integer | Sí | check (limite_usos > 0) |
| activo | boolean | No | not null default true |

- `check (fin is null or fin > inicio)`
- `check (tipo <> 'porcentaje' or valor <= 100)`

## estados_pedido

Catálogo de estados.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| codigo | text | No | primary key |
| nombre | text | No | not null |

## metodos_pago

Métodos de pago.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| codigo | text | No | primary key |
| nombre | text | No | not null |
| activo | boolean | No | not null default true |

## empresas_paqueteria

Catálogo de paqueterías.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| nombre | text | No | not null unique |
| telefono | text | Sí | — |
| sitio_web | text | Sí | — |
| activa | boolean | No | not null default true |

## pedidos

Cabecera y datos históricos del pedido.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| folio | uuid | No | not null unique default gen_random_uuid() |
| usuario_id | uuid | No | not null references public.usuarios(id) |
| direccion_id | bigint | No | not null |
| estado | text | No | not null references public.estados_pedido(codigo) |
| cupon_id | bigint | Sí | references public.cupones(id) |
| direccion_entrega | jsonb | No | not null check (jsonb_typeof(direccion_entrega) = 'object') |
| terminos_version | text | No | not null |
| terminos_aceptados_en | timestamptz | No | not null default now() |
| clave_idempotencia | uuid | No | not null |
| solicitud | jsonb | No | not null |
| creado_en | timestamptz | No | not null default now() |
| subtotal | numeric(12,2) | No | not null check (subtotal >= 0 and subtotal < 'Infinity'::numeric) |
| iva | numeric(12,2) | No | not null check (iva >= 0 and iva < 'Infinity'::numeric) |
| envio | numeric(12,2) | No | not null check (envio >= 0 and envio < 'Infinity'::numeric) |
| descuento | numeric(12,2) | No | not null check (descuento between 0 and subtotal) |
| total | numeric(12,2) | Sí | generated always as (subtotal + iva + envio - descuento) stored |
| contacto_entrega | jsonb | Sí |  Snapshot de correo Auth y teléfono normalizado, añadido en 005. |

- `foreign key (direccion_id, usuario_id) references public.direcciones(id, usuario_id)`
- `unique (usuario_id, clave_idempotencia)`
- `unique (id, usuario_id)`
- `create index pedidos_usuario_fecha on public.pedidos(usuario_id, creado_en desc);`
- `create index pedidos_estado_fecha on public.pedidos(estado, creado_en desc);`
- `create index pedidos_direccion on public.pedidos(direccion_id, usuario_id);`
- `create index pedidos_cupon on public.pedidos(cupon_id) where cupon_id is not null;`

## detalle_pedido

SKU, cantidades y precios históricos.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| pedido_id | bigint | No | not null references public.pedidos(id) |
| variante_id | bigint | No | not null references public.variantes_producto(id) |
| nombre_producto | text | No | not null |
| nombre_variante | text | No | not null |
| sku | text | No | not null |
| cantidad | integer | No | not null check (cantidad > 0) |
| precio_unitario | numeric(12,2) | No | not null check (precio_unitario >= 0 and precio_unitario < 'Infinity'::numeric) |
| subtotal | numeric(12,2) | Sí | generated always as (cantidad * precio_unitario) stored |

- `unique (pedido_id, variante_id)`
- `unique (id, pedido_id)`
- `create index detalle_pedido_variante on public.detalle_pedido(variante_id);`

## pagos

Registro de pago simulado.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| pedido_id | bigint | No | not null references public.pedidos(id) |
| metodo | text | No | not null references public.metodos_pago(codigo) |
| referencia | uuid | No | not null unique default gen_random_uuid() |
| monto | numeric(12,2) | No | not null check (monto >= 0 and monto < 'Infinity'::numeric) |
| estado | text | No | not null check (estado in ('aprobado','reembolsado')) |
| creado_en | timestamptz | No | not null default now() |

- `unique (pedido_id, estado)`

## envios

Envío y seguimiento.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| pedido_id | bigint | No | not null unique references public.pedidos(id) |
| empresa_id | bigint | No | not null references public.empresas_paqueteria(id) |
| numero_guia | text | No | not null |
| fecha_envio | timestamptz | No | not null default now() |
| fecha_entrega | timestamptz | Sí | — |
| costo_envio | numeric(12,2) | No | not null check (costo_envio >= 0 and costo_envio < 'Infinity'::numeric) |
| estado | text | No | not null check (estado in ('enviado','entregado')) |

- `check (fecha_entrega is null or fecha_entrega >= fecha_envio)`
- `unique (empresa_id, numero_guia)`

## lista_deseos

Favoritos de usuario.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| usuario_id | uuid | No | PK compuesta. references public.usuarios(id) |
| producto_id | bigint | No | PK compuesta. references public.productos(id) |
| creado_en | timestamptz | No | not null default now() |

- `primary key (usuario_id, producto_id)`
- `create index lista_deseos_producto on public.lista_deseos(producto_id);`

## resenas

Reseñas y moderación.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| usuario_id | uuid | No | PK compuesta. references public.usuarios(id) |
| producto_id | bigint | No | PK compuesta. references public.productos(id) |
| calificacion | smallint | No | not null check (calificacion between 1 and 5) |
| comentario | text | Sí | check (length(comentario) <= 500) |
| moderacion | text | No | not null default 'pendiente' check (moderacion in ('pendiente','publicada','rechazada')) |
| creado_en | timestamptz | No | not null default now() |

- `primary key (usuario_id, producto_id)`
- `create index resenas_producto on public.resenas(producto_id, moderacion);`

## solicitudes_devolucion

Cabecera de devolución.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| pedido_id | bigint | No | not null |
| usuario_id | uuid | No | not null |
| motivo | text | No | not null check (length(btrim(motivo)) between 1 and 1000) |
| estado | text | No | not null default 'solicitada' check (estado in ('solicitada','aprobada','rechazada','recibida')) |
| resolucion | text | Sí | — |
| creado_en | timestamptz | No | not null default now() |
| resuelto_en | timestamptz | Sí | — |

- `foreign key (pedido_id, usuario_id) references public.pedidos(id, usuario_id)`
- `unique (id, pedido_id)`
- `create index devoluciones_pedido on public.solicitudes_devolucion(pedido_id);`
- `create index devoluciones_usuario on public.solicitudes_devolucion(usuario_id, creado_en desc);`
- `create index devoluciones_estado on public.solicitudes_devolucion(estado, creado_en);`

## detalle_devolucion

Partidas de devolución.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| solicitud_id | bigint | No | PK compuesta. not null |
| pedido_id | bigint | No | not null |
| detalle_pedido_id | bigint | No | PK compuesta. not null |
| cantidad | integer | No | not null check (cantidad > 0) |

- `primary key (solicitud_id, detalle_pedido_id)`
- `foreign key (solicitud_id, pedido_id) references public.solicitudes_devolucion(id, pedido_id)`
- `foreign key (detalle_pedido_id, pedido_id) references public.detalle_pedido(id, pedido_id)`
- `create index detalle_devolucion_partida on public.detalle_devolucion(detalle_pedido_id, pedido_id);`

## movimientos_inventario

Bitácora y saldo de inventario.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| variante_id | bigint | No | not null references public.inventario(variante_id) |
| pedido_id | bigint | Sí | references public.pedidos(id) |
| devolucion_id | bigint | Sí | references public.solicitudes_devolucion(id) |
| actor_id | uuid | Sí | references public.usuarios(id) |
| tipo | text | No | not null check (tipo in ('inicial','ajuste','venta','cancelacion','devolucion')) |
| variacion | integer | No | not null check (variacion <> 0) |
| saldo | integer | No | not null check (saldo >= 0) |
| motivo | text | No | not null |
| creado_en | timestamptz | No | not null default now() |

- `check ( (tipo in ('inicial','ajuste') and pedido_id is null and devolucion_id is null) or (tipo = 'venta' and variacion < 0 and pedido_id is not null and devolucion_id is null) or (tipo = 'cancelacion' and variacion > 0 and pedido_id is not null and devolucion_id is null) or (tipo = 'devolucion' and variacion > 0 and pedido_id is not null and devolucion_id is not null) )`
- `create index movimientos_variante_fecha on public.movimientos_inventario(variante_id, creado_en desc, id desc);`
- `create unique index movimiento_venta_cancelacion on public.movimientos_inventario(pedido_id, variante_id, tipo) where tipo in ('venta','cancelacion');`
- `create unique index movimiento_devolucion on public.movimientos_inventario(devolucion_id, variante_id) where tipo = 'devolucion';`
- `create unique index movimiento_inicial on public.movimientos_inventario(variante_id) where tipo = 'inicial';`

## historial_estados_pedido

Historial de transiciones de pedido.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| pedido_id | bigint | No | not null references public.pedidos(id) |
| actor_id | uuid | Sí | references public.usuarios(id) |
| estado_anterior | text | Sí | references public.estados_pedido(codigo) |
| estado_nuevo | text | No | not null references public.estados_pedido(codigo) |
| motivo | text | No | not null |
| creado_en | timestamptz | No | not null default now() |

- `create index historial_pedido_fecha on public.historial_estados_pedido(pedido_id, creado_en, id);`

## auditoria

Bitácora de cambios.

| Campo | Tipo | Admite NULL | Claves, valor inicial o regla |
|---|---|---|---|
| id | bigint | No | generated always as identity primary key |
| actor_id | uuid | Sí | references public.usuarios(id) |
| entidad | text | No | not null |
| registro | text | No | not null |
| accion | text | No | not null |
| cambios | jsonb | No | not null default '{}'::jsonb |
| creado_en | timestamptz | No | not null default now() |

- `create index auditoria_entidad_registro on public.auditoria(entidad, registro, creado_en);`

## Objetos externos y funciones

- auth.users es gestionada por Supabase Auth. La aplicación depende de id, email y raw_user_meta_data.
- zeli_privado agrupa funciones internas y no define tablas en las migraciones revisadas.
- La migración 005 agrega contacto_entrega y reemplaza la firma de registrar_pedido.
