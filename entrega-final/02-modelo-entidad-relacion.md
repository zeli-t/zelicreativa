# Modelo entidad–relación

Las relaciones compuestas se anotan en el diccionario. Las tres vistas del modelo comparten las mismas entidades.

## Clientes y catálogo

```mermaid
erDiagram
    AUTH_USERS ||--o| usuarios : id
    roles ||--o{ usuarios : rol
    usuarios ||--o{ direcciones : usuario
    categorias ||--o{ productos : categoria_id
    productos ||--o{ variantes_producto : producto_id
    productos ||--o{ imagenes_producto : producto_id
    variantes_producto ||--o| inventario : variante
    usuarios ||--o{ carritos : usuario
    carritos ||--o{ carrito_detalle : carrito_id
    variantes_producto ||--o{ carrito_detalle : variante
    pedidos ||--o| envios : pedido
    empresas_paqueteria ||--o{ envios : empresa_id
    usuarios ||--o{ lista_deseos : usuario
    productos ||--o{ lista_deseos : producto_id
```

## Compra y seguimiento

```mermaid
erDiagram
    usuarios ||--o{ pedidos : usuario
    direcciones ||--o{ pedidos : direccion
    estados_pedido ||--o{ pedidos : estado
    cupones o|--o{ pedidos : cupon_id
    pedidos ||--o{ detalle_pedido : pedido
    variantes_producto ||--o{ detalle_pedido : variante
    pedidos ||--o{ pagos : pedido
    metodos_pago ||--o{ pagos : metodo
    pedidos ||--o{ historial_estados_pedido : pedido
    usuarios o|--o{ historial_estados_pedido : actor
    estados_pedido o|--o{ historial_estados_pedido : estado_anterior
    estados_pedido ||--o{ historial_estados_pedido : estado_nuevo
```

## Inventario y posventa

```mermaid
erDiagram
    usuarios ||--o{ resenas : usuario
    productos ||--o{ resenas : producto_id
    pedidos ||--o{ solicitudes_devolucion : pedido
    solicitudes_devolucion ||--o{ detalle_devolucion : solicitud_id
    detalle_pedido ||--o{ detalle_devolucion : detalle_pedido_id
    inventario ||--o{ movimientos_inventario : variante
    pedidos o|--o{ movimientos_inventario : pedido
    solicitudes_devolucion o|--o{ movimientos_inventario : devolucion_id
    usuarios o|--o{ movimientos_inventario : actor
    usuarios o|--o{ auditoria : actor
```

El catálogo, las variantes, el inventario y los estados mantienen entidades separadas. Los snapshots de dirección, contacto y partidas conservan la información comercial histórica aunque cambie el catálogo. La FK compuesta de pedidos asegura que dirección y propietario coincidan.
