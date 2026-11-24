-- Datos ficticios para un entorno de demostración. No crea cuentas.
begin;
insert into public.categorias(slug,nombre,descripcion) values
  ('libretas','Libretas','Papel y encuadernación para tus ideas.'),
  ('escritura','Escritura','Plumas, marcadores y accesorios de escritura.'),
  ('stickers','Stickers','Calcomanías y etiquetas de papelería.')
on conflict (slug) do nothing;

with demo(categoria,slug,nombre,descripcion,precio,anterior) as (values
 ('libretas','libreta-personalizada','Libreta personalizada','Libreta con portada personalizada.',180,null),
 ('libretas','libreta-punteada','Libreta punteada','Hojas con cuadrícula de puntos.',145,null),
 ('libretas','libreta-kraft','Libreta kraft','Cubierta de papel kraft.',110,null),
 ('libretas','libreta-de-bolsillo','Libreta de bolsillo','Formato compacto para notas rápidas.',75,null),
 ('libretas','kit-de-journaling','Kit de journaling','Libreta y accesorios para decorar un diario.',165,null),
 ('escritura','set-de-plumas','Set de plumas','Juego de plumas para anotaciones.',95,null),
 ('escritura','marcadores-permanentes','Marcadores permanentes','Marcadores de tinta permanente.',120,150),
 ('escritura','boligrafo-de-gel','Bolígrafo de gel','Punta fina para trazos precisos.',45,null),
 ('escritura','portaminas-pastel','Portaminas pastel','Portaminas ligero para escritura y bocetos.',65,null),
 ('escritura','resaltadores-pastel','Resaltadores pastel','Juego de resaltadores de tonos suaves.',110,null),
 ('stickers','pack-de-stickers','Pack de stickers','Surtido de diseños para decorar.',65,null),
 ('stickers','stickers-florales','Stickers florales','Ilustraciones de flores y hojas.',55,null),
 ('stickers','stickers-escolares','Stickers escolares','Diseños para identificar útiles y cuadernos.',50,null),
 ('stickers','stickers-holograficos','Stickers holográficos','Calcomanías con acabado holográfico.',75,null),
 ('stickers','etiquetas-decorativas','Etiquetas decorativas','Etiquetas para regalos y organizadores.',60,null)
)
insert into public.productos(categoria_id,slug,nombre,descripcion,precio,precio_anterior)
select c.id,d.slug,d.nombre,d.descripcion,d.precio,d.anterior
from demo d join public.categorias c on c.slug = d.categoria
on conflict (slug) do nothing;

with demo(slug,sku,variante,stock,principal) as (values
 ('libreta-personalizada','LIB-001','Rosa',12,true),
 ('libreta-personalizada','LIB-001-AZ','Azul',8,false),
 ('libreta-personalizada','LIB-001-LI','Lila',8,false),
 ('libreta-punteada','LIB-002','Estándar',18,true),
 ('libreta-kraft','LIB-003','Estándar',20,true),
 ('libreta-de-bolsillo','LIB-004','Estándar',25,true),
 ('kit-de-journaling','LIB-005','Estándar',10,true),
 ('set-de-plumas','ESC-001','Estándar',18,true),
 ('marcadores-permanentes','ESC-002','Estándar',14,true),
 ('boligrafo-de-gel','ESC-003','Estándar',30,true),
 ('portaminas-pastel','ESC-004','Estándar',24,true),
 ('resaltadores-pastel','ESC-005','Estándar',16,true),
 ('pack-de-stickers','STK-001','Estándar',30,true),
 ('stickers-florales','STK-002','Estándar',24,true),
 ('stickers-escolares','STK-003','Estándar',28,true),
 ('stickers-holograficos','STK-004','Estándar',16,true),
 ('etiquetas-decorativas','STK-005','Estándar',20,true)
), nuevas_variantes as (
  insert into public.variantes_producto(producto_id,sku,nombre,predeterminada)
  select p.id,d.sku,d.variante,d.principal from demo d join public.productos p on p.slug = d.slug
  on conflict (sku) do nothing returning id,sku
), nuevo_stock as (
  insert into public.inventario(variante_id,cantidad)
  select v.id,d.stock from nuevas_variantes v join demo d on d.sku = v.sku
  returning variante_id,cantidad
)
insert into public.movimientos_inventario(variante_id,tipo,variacion,saldo,motivo)
select variante_id,'inicial',cantidad,cantidad,'Carga de demostración' from nuevo_stock;

with demo(slug,ruta) as (values
 ('libreta-personalizada','2.jpg'),('libreta-punteada','libreta.jpg'),
 ('libreta-kraft','libreta.jpg'),('libreta-de-bolsillo','azul.jpg'),
 ('kit-de-journaling','kit.jpg'),('set-de-plumas','plumas.jpg'),
 ('marcadores-permanentes','marcadores2.jpg'),('boligrafo-de-gel','plumas-producto.jpg'),
 ('portaminas-pastel','morado.jpg'),('resaltadores-pastel','marcadores3.jpg'),
 ('pack-de-stickers','stickers.jpg'),('stickers-florales','stickers.jpg'),
 ('stickers-escolares','estrellas.jpg'),('stickers-holograficos','stickers.jpg'),
 ('etiquetas-decorativas','stickers.jpg')
)
insert into public.imagenes_producto(producto_id,ruta,texto_alternativo,principal)
select p.id,d.ruta,'Imagen de demostración: ' || p.nombre,true
from demo d join public.productos p on p.slug = d.slug
where not exists(select 1 from public.imagenes_producto i where i.producto_id = p.id and i.principal)
-- También ignora un conflicto con el índice de imagen principal si otra
-- sesión acaba de registrar una imagen principal para el mismo producto.
on conflict do nothing;

insert into public.cupones(codigo,descripcion,tipo,valor,limite_usos)
values ('PROFE100','Cupón ficticio de demostración','fijo',100,100)
on conflict (codigo) do nothing;
insert into public.empresas_paqueteria(nombre) values ('Paquetería Zeli Demo')
on conflict (nombre) do nothing;
commit;
