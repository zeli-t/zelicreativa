# API de Zeli Creativa

Angular consume Supabase Auth y PostgREST. Las rutas HTTP parten del host HTTPS del proyecto de pruebas. Los ejemplos usan valores ficticios. Las consultas protegidas usan `apikey` con la clave publicable y `Authorization: Bearer <JWT de sesión>`. RLS limita filas y los privilegios de PostgreSQL limitan operaciones y columnas.

## Navegación Angular

| Acceso | Rutas reales |
|---|---|
| Público | `/inicio`, `/catalogo`, `/categoria/:slug`, `/detalle-producto`, `/carrito`, `/lista-deseos` |
| Autenticación | `/iniciar-sesion`, `/registro`, `/recuperar-contrasena`, `/restablecer-contrasena` |
| Sesión requerida | `/checkout`, `/confirmacion-pedido?folio=<uuid>`, `/mi-cuenta`, `/mis-direcciones`, `/mis-pedidos` |
| Administración | `/acceso-admin`, `/admin` con guard administrativo |
| Información | `/terminos`, `/privacidad`, `/cambios-y-devoluciones`, `/envios`, `/contacto` |

## Recursos

| Base | Método y recurso | Permiso y uso |
|---|---|---|
| `/auth/v1` | POST `/signup`, `/token?grant_type=password`, `/logout`, `/recover`; PUT `/user` | SDK Supabase. Alta, inicio, cierre, recuperación y actualización de contraseña con sesión. |
| `/rest/v1` | GET `/categorias`, `/productos`, `/variantes_producto`, `/imagenes_producto` | Catálogo público sujeto a RLS. El panel administra con permisos de rol y bajas lógicas donde aplica. |
| `/rest/v1` | GET/PATCH `/usuarios`; GET/POST/PATCH `/direcciones` | Perfil propio; edición de nombre y teléfono. Direcciones propias, con desactivación. Restricciones de columna y fila. |
| `/rest/v1` | GET `/pedidos` con relaciones a partidas, envíos, historial y devoluciones | Cliente ve sus pedidos; administrador consulta el conjunto autorizado. Ejemplo `?folio=eq.<uuid>&select=id,folio,estado,total`. |
| `/rest/v1` | GET `/inventario`, `/movimientos_inventario`, `/auditoria` | El panel consulta inventario y bitácoras bajo reglas de rol. |
| `/rest/v1` | Lectura administrativa de clientes, paqueterías, devoluciones y cupones; edición autorizada del catálogo y cupones | Consultar `administracion.ts` y migración 003 para permisos aplicados a cada tabla. |

El carrito de la interfaz usa almacenamiento local. El checkout calcula los importes definitivos en PostgreSQL y los pagos simulados se registran como parte de la operación del pedido.

## RPC

Todas usan POST con JSON bajo `/rest/v1/rpc/`. El [contrato OpenAPI](04-openapi.json) contiene los parámetros.

| RPC | Acceso | Resultado |
|---|---|---|
| `disponibilidad_catalogo` | Público | Arreglo con ID de variante y disponibilidad booleana |
| `registrar_pedido` | Cliente activo | Cotización si falta confirmación o cambia el total; pedido persistido con folio cuando confirma. El cliente conserva el UUID de idempotencia al reintentar. |
| `solicitar_devolucion` | Cliente activo, pedido propio elegible | ID de solicitud |
| `cambiar_estado_pedido` | Administrador | Transición validada y registrada; paquetería y guía al enviar |
| `ajustar_inventario` | Administrador | Saldo resultante y movimiento |
| `resolver_devolucion` | Administrador | Resolución validada; reposición opcional al recibir cuando proceda |
| `asignar_rol` | Administrador | Cambio auditado de rol |

Ejemplo de cotización para un cliente con dirección propia `15`. Al confirmar, se reutiliza la clave y se envía el total devuelto por el servidor.

```json
{
  "p_items": [{"id": 2, "cantidad": 1}],
  "p_direccion": 15,
  "p_idempotencia": "9a0b2a00-a3fd-4a7d-814e-8e5f82cf24a1",
  "p_terminos_version": "demo-v1",
  "p_total_confirmado": null,
  "p_telefono_entrega": "+528681234567"
}
```

La versión de términos debe corresponder al formulario vigente al ensayar. Una respuesta válida puede ser `200`; las operaciones sin representación también pueden devolver `204`. JSON inválido o validaciones de negocio pueden producir `400`; una sesión ausente o inválida puede producir `401`; permisos insuficientes pueden producir `403` o un resultado vacío si RLS filtra filas. Los conflictos de restricciones pueden devolver `409`. El código y el mensaje de PostgREST permiten diferenciar errores como dirección inválida, cantidad fuera de límite, stock insuficiente y conflictos de idempotencia.

Fuentes: `src/app/app-routing-module.ts`, `src/app/services/`, `supabase/migrations/002_funciones.sql`, `003_seguridad.sql` y `005_seguridad_checkout.sql`.
