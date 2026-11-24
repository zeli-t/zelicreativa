# Matriz de cumplimiento

Fuente: guía oficial *Diseño y desarrollo de una tienda virtual*, Ing. Alfredo Medrano, 15 páginas. Los estados distinguen código comprobable, ejecución reportada, documentación disponible y evidencia pendiente. La matriz no asigna una calificación.

## Fases y criterios ponderados

| Fase o bloque | Rúbrica | Evidencia presente | Brecha para defensa |
|---|---:|---|---|
| I · Negocio y requisitos | 10 % | Catálogo semilla, alcance académico, historias inferibles de la interfaz | Propuesta de valor, buyer persona, análisis de tres competidores, acta, historias, diagramas de actividad, calendario, RACI individual y registro de riesgos |
| II · UX/UI y frontend | 15 % | Rutas, componentes reutilizables, compra reportada; app navegable en checkout-test | Wireframes móvil/escritorio, guía visual e inventario de recursos, capturas, pruebas responsive y accesibilidad |
| III · Backend y lógica | 20 % | RPC, transacciones, RLS, prueba de integración reportada y contrato API | Adjuntar resultado de concurrencia si se retoma; documentar límites de pagos, reportes y garantías |
| IV · Base de datos | 10 % | Modelo y diccionario; migraciones y semilla; respaldo, integridad y restauración por folio acreditados en el [reporte](11-reporte-recuperacion.md) | Preparar capturas y consultas de reportes para la defensa |
| V · Operación comercial | 10 % | Checkout, PDF, seguimiento y operación administrativa reportados | Capturas, cobertura logística, incidencias, canal de atención y garantía |
| Políticas y privacidad | 10 % | Rutas públicas, aceptación versionada y pago simulado | Matriz legal con fuentes verificadas, cancelación, garantía y documentación de atención; evitar afirmar cumplimiento certificado |
| Seguridad y calidad | 10 % | Suite 62/62, verificación de tipos, compilación, controles en SQL y restauración verificada | Documentar permisos negativos, aceptación, accesibilidad, usabilidad y revisión de dependencias |
| Manuales y documentación | 10 % | Manuales de comprador, administrador, instalación y técnico, diccionario, API y continuidad | Capturas numeradas autenticadas y verificación final por recorrido |
| Presentación y defensa | 5 % | Guion breve al final de este documento | Ensayar, adjuntar diapositivas y preparar el acceso de prueba por canal privado |

## Entregables oficiales

| N.º | Entregable | Estado actual y evidencia |
|---:|---|---|
| 01 | Propuesta de negocio y mercado | Pendiente. La evidencia del catálogo no sustituye el estudio de mercado. |
| 02 | Requisitos y backlog | Parcial. La trazabilidad de esta matriz y el plan de pruebas están listos; falta la especificación formal y su tablero. |
| 03 | Diseño UX/UI | Parcial. Existe implementación navegable; wireframes, guía visual y accesibilidad documentada pendientes. |
| 04 | Código fuente completo | Código Angular, SQL, semilla y README disponibles en la copia. Falta confirmar referencia del repositorio, historial y licencia del código propio para entrega. |
| 05 | Frontend funcional | Compilación checkout-test aprobada. Compra y seguimiento confirmados previamente por la autora; registrar capturas finales. |
| 06 | Backend y API | SQL y servicios disponibles; [API](04-api.md) y [OpenAPI](04-openapi.json) documentados. Integración real previamente reportada. |
| 07 | Base de datos | [Modelo](02-modelo-entidad-relacion.md), [diccionario](03-diccionario-datos.md), migraciones, semilla y [ensayo de recuperación aprobado](11-reporte-recuperacion.md). |
| 08 | Panel administrativo | Compra visible, cambio de estado y devolución reportados. Demostración final por rol pendiente de registrar. |
| 09 | Documentación legal y comercial | Parcial. Páginas académicas y aceptación disponibles. Falta matriz normativa, cobertura de garantía y formalización de procedimientos comerciales. |
| 10 | Manuales | Manual técnico e instalación, comprador y administrador disponibles. Faltan capturas numeradas autenticadas. |
| 11 | Calidad y seguridad | [Plan y reporte](09-plan-reporte-pruebas.md) disponibles. Pruebas y compilación locales aprobadas; ensayos manuales pendientes identificados. |
| 12 | Ficha técnica y arquitectura | [Ficha y diagrama](08-ficha-tecnica-arquitectura.md) disponibles. Referencias de publicación y licencias por confirmar. |
| 13 | Presentación y demostración | Guion preparado. Pendiente ensayo grabado o presencial de 12 a 15 minutos. |

## Guion individual de 13 minutos

1. **1 min.** Explico el objetivo, el alcance y el uso de pago simulado.
2. **4 min.** Demuestro catálogo, variante, carrito, dirección, checkout, folio y PDF.
3. **3 min.** Localizo el mismo pedido en administración, cambio estado y muestro el movimiento de inventario.
4. **2 min.** Presento el caso sin stock y una devolución con su seguimiento.
5. **3 min.** Explico arquitectura, RLS y API. Presento la recuperación por folio y los límites de la comparación.
