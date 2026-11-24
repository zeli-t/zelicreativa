# Plan y reporte de pruebas

Fecha de corte 23 de noviembre de 2026. La evidencia se distingue entre corrida local de esta revisión, comprobación previamente reportada por la autora y ejecución pendiente.

| ID | Precondición y pasos | Resultado esperado | Resultado obtenido y evidencia |
|---|---|---|---|
| AUT-01 | Dependencias instaladas; ejecutar `npm.cmd test -- --watch=false` | Suite completa | **Aprobado**, 62/62 en 26 archivos. Primera corrida aislada bloqueada por permisos de lectura; corrida local autorizada completada. |
| AUT-02 | Ejecutar `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit` | Sin errores de tipos | **Aprobado**, sin diagnósticos. |
| AUT-03 | Ejecutar `npm.cmd run build -- --configuration checkout-test` | Artefacto de prueba | **Aprobado**, `dist/papevirtual`, 2.28 MB iniciales sin optimización. |
| A18 | Visitante busca un producto y aplica filtros | Coincidencias y vacío comprensible | Implementado. Captura y recorrido final pendientes. |
| A19 | Agregar dos variantes, cambiar unidades y eliminar una | Cantidades y totales coincidentes | Cubierto por suite de carrito. Captura de aceptación pendiente. |
| A20 | Cliente ficticio intenta superar stock y límite | Operación rechazada, sin pedido nuevo | Seguridad e integración previamente reportadas como aprobadas; adjuntar registro de un caso representativo. |
| A21 | Cliente ficticio completa una compra | Folio UUID y confirmación con PDF | Demostración previamente comprobada por la autora. Captura saneada pendiente. |
| A22 | Administradora busca ese folio y cambia Pagado a Preparando | Estado e historial actualizados | Resultado previo positivo reportado. Adjuntar captura. |
| A23 | Abrir movimientos usando la variante comprada | Movimiento de venta ligado al pedido y saldo consistente | Integración previa reportada como aprobada. Adjuntar comparación ligada al folio. |
| A24 | Cliente solicita devolución de una partida elegible | Solicitud visible con estado y consulta posterior | Flujo previamente comprobado por la autora. Adjuntar evidencia de resolución. |
| A25 | Cliente ficticio intenta abrir administración y usar una RPC de rol | Denegación en interfaz y backend | Suite local y seguridad de checkout disponibles. Adjuntar resultado específico del cliente sin permiso. |
| A26 | Abrir políticas desde footer y checkout | Páginas accesibles y aceptación visible | Rutas verificadas en código. Captura final pendiente. |
| A27 | Respaldar origen autorizado y restaurar en base local nueva | Conteos coincidentes, FK válidas, mismo pedido y movimientos | **Aprobado** el 23 de noviembre de 2026. Coincidieron los conteos de 25 tablas, 36 claves foráneas y las salidas del folio con partidas, pago y movimientos. Véase el [reporte de recuperación](11-reporte-recuperacion.md). |

## Pendientes de calidad

| Caso | Método y evidencia |
|---|---|
| Compatibilidad y responsive | Usar dos navegadores y tamaños de móvil desde 360 px, tableta y escritorio. Capturar catálogo, checkout y admin. |
| Accesibilidad | Recorrer con teclado y comprobar foco, contraste, etiquetas, textos alternativos y avisos en checkout. Anotar resultado y mejoras. |
| Usabilidad | Observar cinco tareas con datos ficticios y registrar éxito, dudas, tiempo y correcciones. |
| Rendimiento | Medir las vistas principales en navegador y registrar perfil, configuración y resultado. El tamaño de compilación no acredita tiempos de carga. |
| Seguridad adicional | Documentar recuperación de contraseña, sesión expirada, permisos de otro usuario y revisión de dependencias y licencias. |
| Concurrencia | Caso manual con dos conexiones para la última unidad, aplazado por la autora. Mantener identificado como pendiente. |

**Incidencia de validación local:** el primer intento no pudo leer directorios ante el aislamiento de la sesión. Se repitió desde el contexto autorizado y la suite y compilación terminaron correctamente. No se cambió el código para resolver el acceso.
