# Panadería — arquitectura v1

**Estado:** decisiones de diseño aprobadas; implementación incremental.  
**Stack:** Angular (frontend), NestJS (backend REST), PostgreSQL, Prisma ORM 7 con `@prisma/adapter-pg`.  
**Despliegue objetivo:** `panaderia.may.cu` y `panaderia-api.may.cu`.

## 1. Objetivo del producto

MVP para calcular y comparar costes de producción, precios y rentabilidad estimada de productos panificados. Incluye materias primas con precios históricos, recetas versionadas, mano de obra por hora, gastos indirectos, reglas fiscales configurables y escenarios de precio. No es inicialmente un ERP, un sistema de inventario físico, una caja/ventas reales ni un sistema integral de nóminas o contabilidad.

Moneda de aplicación: CUP. No añadir conversión monetaria al MVP.

## 2. Arquitectura de despliegue y software

- Frontend Angular: interfaz, formularios, navegación y visualización. No es fuente de verdad de reglas de negocio ni cálculos.
- Backend NestJS: API REST versionada en `/api/v1`, validación, autorización, reglas de negocio, cálculos, integración de datos y documentación OpenAPI.
- PostgreSQL: almacenamiento persistente.
- Prisma ORM 7: acceso a datos, tipos y migraciones. Prisma 7 usa una instancia `PrismaClient` con `PrismaPg` (`@prisma/adapter-pg`) y configuración `prisma.config.ts`.
- Código organizado como monolito modular de NestJS; no introducir microservicios.
- No agregar Docker para el frontend/backend en una tarea de infraestructura si el proyecto actual no lo requiere. PostgreSQL ya corre en Docker.

## 3. Estructura objetivo del backend

Mantener el estilo del NestJS ya generado y evolucionar en incrementos. La estructura lógica prevista es:

- `config`: configuración y validación de variables de entorno.
- `prisma`: `PrismaModule` y un único `PrismaService` compartido.
- `health`: endpoints de liveness y readiness.
- `auth`: autenticación y sesiones/tokens (fase futura; no fingir autenticación en endpoints de negocio).
- `tenancy`: resolución de usuario, membresía, rol y negocio autorizado (fase futura).
- `materials`: materias primas, unidades y precios históricos.
- `products` / `recipes`: catálogo de productos, versiones de recetas e ingredientes.
- `labor`: puestos, tarifas por hora e instrucciones de trabajo.
- `overheads`: gastos indirectos y métodos de distribución.
- `costing`: cálculo de costes de fabricación y snapshots.
- `tax`: perfiles, reglas tributarias versionadas y aplicabilidad.
- `scenarios` / `reports`: escenarios de precio, rentabilidad e informes.

No generar ahora todos estos módulos vacíos. Crear cada módulo cuando corresponda a una tarea.

## 4. API

- Prefijo global: `/api/v1`.
- JSON para peticiones y respuestas.
- Validación del servidor mediante `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`.
- Errores consistentes y sin stack traces ni secretos en producción.
- CORS debe permitir el origen configurado de Angular; nunca usar `*` junto con credenciales. El valor local por defecto puede ser `http://localhost:4200` solo en desarrollo.
- Swagger/OpenAPI puede exponerse en desarrollo; deshabilitado por defecto en producción o protegido explícitamente.
- Health: `/api/v1/health/liveness` verifica que el proceso responde; `/api/v1/health/readiness` debe ejecutar una consulta real sencilla (`SELECT 1`) y devolver no-listo/503 si PostgreSQL no responde. No confiar únicamente en `$connect()` del adaptador como prueba de disponibilidad.

## 5. Multiempresa y seguridad

- Cada panadería es un tenant independiente; varias cuentas pueden tener membresía en varios negocios.
- Roles iniciales por membresía: `ADMIN`, `EDITOR`, `VIEWER`.
- Los modelos de negocio están vinculados a `bakeryId` y las relaciones entre datos de negocio deben mantener la misma empresa.
- Todos los accesos deben verificarse en el backend. Nunca autorizar solo con un `bakeryId` proporcionado por el cliente ni con ocultamiento de botones de Angular.
- No implementar endpoints de negocio accesibles sin autenticación. La implementación inicial solo puede incluir health público y documentación de desarrollo.
- Evitar enumeración de usuarios/negocios; validar entrada; no registrar contraseñas, tokens o cuerpos sensibles.

## 6. Modelo de datos y migraciones actuales

- El esquema fuente es `backend/prisma/schema.prisma`; la configuración CLI está en `backend/prisma.config.ts`.
- Prisma ORM está fijado en 7.10.0. El cliente generado se encuentra bajo `backend/src/generated/prisma` según el generador actual.
- La base PostgreSQL se llama `panaderia`, es accesible localmente en el puerto publicado 5433, y el contenedor local conocido es `panaderia-postgres`.
- El usuario informó que `npx prisma validate`, `npx prisma generate` y `npx prisma migrate status` finalizaron correctamente y que el esquema está actualizado.
- Existe una migración baseline registrada como aplicada. Antes de tocar esquema/migraciones debe inspeccionarse la situación actual. No regenerar baseline ni tratar de recrear las tablas.
- No utilizar `prisma db push`, `prisma migrate reset`, `DROP`, ni restablecer datos. Las nuevas migraciones requieren un prompt que autorice explícitamente cambios del modelo y revisar el SQL antes de aplicarlo.

## 7. Precisión monetaria

- PostgreSQL `NUMERIC` y Prisma `Decimal` para importes, tarifas, porcentajes, cantidades y cálculos.
- No convertir `Decimal` a JS `number` para calcular importes. La capa API serializa importes decimales de forma explícita y consistente (preferiblemente cadena decimal en contratos API para evitar pérdida de precisión).
- Documentar política de redondeo. No redondear los intermedios por comodidad; redondear en los puntos definidos por la regla de negocio.
- Cada cálculo histórico debe guardar su snapshot de entradas: versión de receta, precios, tarifas, distribución de gastos y reglas fiscales usadas.
- Un dato obligatorio ausente significa cálculo incompleto/error explícito, nunca coste cero implícito.

## 8. Reglas de cálculo acordadas

- Material: cantidad normalizada × precio por unidad base válido a la fecha de valoración.
- Mano de obra por operación/lote: tarifa CUP/hora × minutos / 60 × cantidad de trabajadores.
- Coste de lote: materiales + mano de obra + gastos indirectos asignados.
- Coste unitario: coste de lote / cantidad vendible resultante.
- Distinguir piezas producidas y piezas vendibles para no duplicar mermas.
- Métodos de distribución previstos: horas laborales, lotes, cantidad producida y proporción de coste directo. Cada gasto debe tener base/periodo explícitos y no imputarse dos veces.
- Recetas publicadas, precios, tarifas y reglas con historial no deben reescribirse retroactivamente; nuevos cambios crean nuevas versiones/registros.

## 9. Supuestos tributarios iniciales del producto

El usuario ha indicado que para el escenario inicial de TCP quiere configurar:

- 10 % sobre ventas netas.
- 5 % sobre utilidad calculada antes de ese impuesto sobre utilidad, con suelo de cero si la utilidad es negativa.

Estas son reglas de cálculo solicitadas para el producto; cualquier estado de validación legal que exista en los datos debe conservarse y mostrarse como corresponde. No hacer afirmaciones de que los resultados son una liquidación fiscal oficial. No cambiar las tasas ni convertirlas en constantes dispersas: deben residir en registros/configuración versionados. Base de ventas netas prevista: ventas brutas menos descuentos y devoluciones, según la definición acordada para escenarios. La utilidad de escenario resta impuesto estimado sobre ventas, coste de ventas y otros gastos no incluidos previamente antes de aplicar el 5 % estimado sobre utilidad.

## 10. Calidad y observabilidad

- TypeScript estricto; DTOs con validaciones servidor.
- Unit tests para reglas de negocio y e2e/integration tests para API y acceso a datos cuando proceda.
- No poner reglas económicas dentro de controllers o componentes Angular; ubicar cálculos en servicios/domino testeables.
- Respuestas de health correctas y logs estructurados sin secretos.
- Añadir o ajustar scripts solo si es necesario y documentar qué comando se debe ejecutar en desarrollo.
