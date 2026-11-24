-- Solo lectura. Antes de las pruebas, ambas filas deben mostrar stock 1 y cero pedidos.
select v.sku, v.id as variante_id, i.cantidad as stock,
  (select count(*) from public.detalle_pedido d where d.variante_id = v.id) as partidas,
  (select count(*) from public.movimientos_inventario m
    where m.variante_id = v.id and m.tipo = 'venta') as ventas,
  (select count(*) from public.pagos p
    join public.detalle_pedido d on d.pedido_id = p.pedido_id
    where d.variante_id = v.id and p.estado = 'aprobado' and p.metodo = 'simulado') as pagos_simulados
from public.variantes_producto v
join public.inventario i on i.variante_id = v.id
where v.sku in ('ZELI-E2E-CARRERA','ZELI-E2E-API')
order by v.sku;

select destinatario, id as direccion_id, usuario_id
from public.direcciones where referencia = 'ZELI-CHECKOUT-E2E' order by destinatario;
