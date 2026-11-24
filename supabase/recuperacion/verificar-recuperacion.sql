-- Ejecutar con psql y -v folio=<UUID completo de un pedido ficticio>.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TIME ZONE 'UTC';

SELECT string_agg(
    format('SELECT %L AS tabla, count(*) AS filas FROM %I.%I',
           schemaname || '.' || tablename, schemaname, tablename),
    ' UNION ALL ' ORDER BY schemaname, tablename) || ' ORDER BY tabla'
FROM pg_tables
WHERE schemaname IN ('public', 'zeli_privado')
\gexec

SELECT c.conrelid::regclass AS tabla, c.conname, c.convalidated,
       pg_get_constraintdef(c.oid) AS definicion
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname IN ('public', 'zeli_privado') AND c.contype = 'f'
ORDER BY c.conrelid::regclass::text, c.conname;

SELECT 'usuarios sin identidad' AS comprobacion, count(*) AS huerfanos
FROM public.usuarios u WHERE NOT EXISTS (SELECT FROM auth.users a WHERE a.id = u.id)
UNION ALL
SELECT 'pedidos sin direccion propia', count(*) FROM public.pedidos p
WHERE NOT EXISTS (SELECT FROM public.direcciones d WHERE (d.id, d.usuario_id) = (p.direccion_id, p.usuario_id))
UNION ALL
SELECT 'partidas sin pedido o variante', count(*) FROM public.detalle_pedido d
WHERE NOT EXISTS (SELECT FROM public.pedidos p WHERE p.id = d.pedido_id)
   OR NOT EXISTS (SELECT FROM public.variantes_producto v WHERE v.id = d.variante_id)
UNION ALL
SELECT 'movimientos sin inventario o pedido asociado', count(*) FROM public.movimientos_inventario m
WHERE NOT EXISTS (SELECT FROM public.inventario i WHERE i.variante_id = m.variante_id)
   OR (m.pedido_id IS NOT NULL AND NOT EXISTS (SELECT FROM public.pedidos p WHERE p.id = m.pedido_id));

SELECT p.folio, p.creado_en, p.estado, p.subtotal, p.iva, p.envio, p.descuento, p.total,
       (SELECT count(*) FROM public.pagos g WHERE g.pedido_id = p.id) AS pagos,
       (SELECT count(*) FROM public.historial_estados_pedido h WHERE h.pedido_id = p.id) AS cambios_estado
FROM public.pedidos p
WHERE p.folio = :'folio'::uuid;

SELECT d.sku, d.cantidad, d.precio_unitario, d.subtotal, i.cantidad AS stock_en_respaldo
FROM public.detalle_pedido d
JOIN public.pedidos p ON p.id = d.pedido_id
LEFT JOIN public.inventario i ON i.variante_id = d.variante_id
WHERE p.folio = :'folio'::uuid
ORDER BY d.id;

SELECT g.metodo, g.referencia, g.monto, g.estado, g.creado_en
FROM public.pagos g
JOIN public.pedidos p ON p.id = g.pedido_id
WHERE p.folio = :'folio'::uuid
ORDER BY g.id;

SELECT m.variante_id, m.tipo, m.variacion, m.saldo, m.creado_en
FROM public.movimientos_inventario m
JOIN public.pedidos p ON p.id = m.pedido_id
WHERE p.folio = :'folio'::uuid
ORDER BY m.id;

ROLLBACK;
