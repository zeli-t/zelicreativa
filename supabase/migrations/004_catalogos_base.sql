-- 004. Catálogos operativos antes de habilitar el alta de perfiles.
begin;
insert into public.roles(codigo,nombre) values ('cliente','Cliente'),('admin','Administrador');
insert into public.estados_pedido(codigo,nombre) values
  ('pagado','Pagado'),('preparando','En preparación'),('enviado','Enviado'),
  ('entregado','Entregado'),('cancelado','Cancelado');
insert into public.metodos_pago(codigo,nombre) values ('simulado','Pago simulado');
create trigger zeli_crear_perfil after insert on auth.users
  for each row execute function zeli_privado.crear_perfil();

-- Incluye cuentas Auth anteriores a esta instalación. Nunca copia credenciales.
insert into public.usuarios(id,nombre)
select id,coalesce(nullif(left(btrim(raw_user_meta_data->>'nombre'),100),''),'Cliente')
from auth.users
on conflict (id) do nothing;

-- Primer administrador: el propietario de la BD asigna 'admin' a un UUID
-- previamente verificado. Ejecutar esa asignación aparte, en una transacción
-- que también registre en auditoria el origen de la asignación.
commit;
