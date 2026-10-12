# Copilot CLI — Fase 03: Catálogo de materias primas y precios históricos (vertical slice)

## Objetivo

Implementa la primera funcionalidad completa de negocio de Panadería, desde la API hasta Angular: catálogo de materias primas y su historial de precios. Incluye el flujo de inicio de sesión y selección del negocio en Angular solo en la medida necesaria para acceder de forma segura a esta funcionalidad.

Trabaja sobre el repositorio existente. Esta es una aplicación multiempresa; cada petición de datos de una panadería debe estar autorizada en NestJS. La implementación debe reutilizar los módulos de autenticación, los guards y decoradores ya existentes, no crear un segundo mecanismo de seguridad.

## Antes de modificar archivos

1. Lee `AGENTS.md`, `.github/copilot-instructions.md` y los documentos existentes en `docs/`.
2. Inspecciona los `package.json`, configuración Angular, rutas, estilos, configuración de entorno, `src/main.ts`, `AppModule`, `PrismaService`, los módulos `auth` y `bakeries`, el guard/contexto multiempresa y las pruebas existentes tanto en backend como en frontend.
3. Inspecciona el esquema real `backend/prisma/schema.prisma`, el seed existente y los scripts de `package.json`. Confirma los nombres reales de campos, enums, DTOs, rutas de autenticación y forma exacta de sus respuestas. No asumas firmas a partir de este prompt.
4. Conserva ESM/NodeNext, Prisma ORM 7.10.0, `@prisma/adapter-pg`, el cliente generado en `src/generated/prisma`, el prefijo `/api/v1`, el estilo de pruebas y las versiones de dependencias existentes.
5. Antes de codificar, presenta un plan breve y después implementa la tarea completa sin detenerte a pedir confirmación para decisiones ordinarias.

## Alcance A — Angular: sesión y selección de panadería

Implementa una mínima experiencia funcional y en español:

- Página de inicio de sesión con email y contraseña, validación de formulario y mensajes de error genéricos.
- Cliente/servicio de autenticación que consuma las rutas reales existentes `POST /api/v1/auth/login`, `GET /api/v1/auth/me` y `GET /api/v1/bakeries`.
- Guardia de rutas para proteger las vistas privadas y navegación de vuelta a login cuando no haya sesión válida.
- Selector de panadería: lista únicamente las panaderías devueltas por la API para el usuario. Si hay varias, deja elegir el contexto activo; si solo hay una, puede seleccionarla automáticamente. Si no tiene ninguna, muestra un estado vacío claro.
- Barra de aplicación simple que muestre la panadería activa y permita cambiarla o cerrar sesión.
- Un interceptor HTTP reutilizable que envíe `Authorization: Bearer <token>` en solicitudes autenticadas y `X-Bakery-Id` en rutas de negocio que requieran contexto. No añadas `X-Bakery-Id` a login, health u otras llamadas globales sin contexto.
- Si la API devuelve 401, limpiar la sesión del cliente y llevar al usuario a login sin ciclos de redirección.

Para el MVP, si necesitas persistir el token, utiliza `sessionStorage`, no `localStorage`, y centraliza el acceso al almacenamiento para poder cambiarlo después. No guardes contraseñas. Documenta que es una decisión práctica del MVP, no una defensa contra XSS; las páginas deben evitar HTML inseguro y no usar `innerHTML` con datos no confiables. No añadas cookies ni cambies el backend de autenticación en esta tarea.

Respeta el framework/versión Angular y los patrones existentes. Usa componentes standalone si ese es el patrón actual, formularios reactivos si ya se usan o son adecuados, TypeScript estricto y SCSS existente. No añadas una biblioteca visual grande por iniciativa propia.

## Alcance B — Backend: materias primas

Implementa un módulo NestJS `materials` que use `PrismaService` y las abstracciones de autorización existentes.

Rutas propuestas, respetando el prefijo global actual:

- `GET /api/v1/measurement-units`: lista unidades activas del catálogo global, opcionalmente filtradas por `dimension`. Requiere autenticación, pero no contexto de panadería porque las unidades son globales. Devuelve los campos mínimos necesarios para selectores.
- `GET /api/v1/materials`: lista materias primas del negocio activo con paginación y filtros opcionales `search`, `kind`, `isActive`; incluir baseUnit y precio vigente en la fecha actual cuando exista. Orden estable por nombre y después id. Default page 1, pageSize 20 y máximo pageSize 100. Incluye metadatos de paginación.
- `POST /api/v1/materials`: crea material con `name`, `kind`, `baseUnitId` y opcional `densityGramPerMl` si el contrato actual/schema lo permite. El servidor asigna `bakeryId` desde el contexto autorizado; nunca aceptes el `bakeryId` del body como autoridad.
- `GET /api/v1/materials/:id`: devuelve detalle, unidad base y precio vigente actual si existe.
- `PATCH /api/v1/materials/:id`: permite editar campos editables del material sin cambiar `bakeryId`. Los materiales con referencias no deben borrarse físicamente; usa `isActive` para desactivarlos, y no permitas que se seleccione una unidad inactiva.
- `GET /api/v1/materials/:id/prices`: devuelve historial cronológico de precios del material.
- `POST /api/v1/materials/:id/prices`: registra un nuevo precio de compra histórico para el material.

### Autorización obligatoria

- Todas las rutas privadas requieren autenticación.
- Para rutas de materiales se requiere contexto de panadería mediante las abstracciones actuales, incluido `X-Bakery-Id` cuando corresponda.
- `ADMIN` y `EDITOR` pueden crear/editar materiales y añadir precios. `VIEWER` solo puede consultar. Utiliza las reglas de los guards existentes; no reimplementes la autorización a mano en cada controlador.
- Comprueba que el material solicitado pertenece a la panadería activa. Devuelve 404 para IDs de materiales inexistentes o pertenecientes a otro negocio para evitar enumeración interempresa.
- Devuelve 400 para entradas inválidas, 401 sin sesión válida, 403 para un rol sin permiso y 404 para material fuera del negocio.
- Todas las consultas Prisma de negocio deben estar acotadas por `bakeryId` y usar las relaciones existentes del esquema.

## Alcance C — Precios y conversiones

El modelo existente `MaterialPrice` almacena `packagePriceCUP`, `packageQuantity`, `packageUnitId`, `effectiveFrom`, `effectiveTo` y `sourceNote`. Reutiliza exactamente esos campos; no alteres `schema.prisma` ni las migraciones en esta tarea.

- Todos los importes y cantidades monetarias/económicas deben manejarse en el backend usando Decimal, nunca JS `number` para cálculos de dinero. En el JSON de la API devuelve valores decimales como cadenas.
- `packagePriceCUP` debe ser mayor que cero; `packageQuantity` debe ser mayor que cero. Fecha de vigencia con formato estricto `YYYY-MM-DD`; fecha final debe ser posterior o igual a la inicial.
- Para esta fase solo admite conversiones entre unidades de la misma dimensión (`MASS`, `VOLUME`, `COUNT`, etc.). Normaliza cantidad a la unidad base mediante `packageQuantity * packageUnit.conversionFactor / baseUnit.conversionFactor`. Rechaza dimensiones incompatibles con error de validación claro; no infieras densidades ni conviertas masa/volumen en esta fase, porque el historial actual no guarda una instantánea de la densidad usada.
- El precio normalizado por unidad base se calcula como `packagePriceCUP / normalizedPackageQuantity`, con Decimal y precisión apropiada. Devuelve `normalizedQuantityInBaseUnit` y `pricePerBaseUnitCUP` si la respuesta de frontend lo necesita, pero no persistas campos que no existen en el esquema.
- El precio vigente en una fecha es el registro que cumple `effectiveFrom <= date` y (`effectiveTo` es null o `effectiveTo >= date`). Si no existe, devuelve `currentPrice: null` y señala que no hay precio vigente; no asumas coste cero.
- Mantén historial sin permitir solapamientos de períodos para el mismo material. Para el flujo MVP, las nuevas altas deben ser cronológicas: la fecha de inicio debe ser posterior a la última `effectiveFrom` registrada. Si el último precio tiene `effectiveTo: null`, al registrar un precio nuevo cierra ese período al día anterior a la nueva fecha, dentro de una transacción. Rechaza fechas retroactivas o solapadas con un mensaje claro; no edites ni elimines precios históricos desde la API en esta fase.
- Usa una transacción y maneja correctamente errores de unicidad/concurrencia. No afirmes protección absoluta ante escrituras concurrentes si el esquema no tiene una restricción de exclusión en PostgreSQL; documenta cualquier limitación residual y no modifiques el esquema para resolverla en esta tarea.
- En la lectura del historial, devuelve precios más recientes primero o incluye orden configurable, y muestra ambos límites de vigencia.

## Alcance D — Angular: catálogo e historial de precios

Implementa una interfaz sencilla, usable y en español que consuma las rutas reales:

- Ruta `/materials`: tabla/lista con nombre, tipo, unidad base, estado y precio vigente por unidad base; búsqueda, filtro por tipo/estado, paginación, indicador de ausencia de precio y botón de crear material.
- Formulario para crear/editar material con nombre, tipo, unidad base, y densidad solo si la API/schema la admite aunque no se use para conversiones en esta fase. La unidad se selecciona del endpoint global de unidades.
- Detalle o pantalla para el historial de precios de un material con fecha efectiva, precio del paquete, cantidad y unidad de paquete, precio normalizado por unidad base y nota/origen.
- Formulario para registrar precio con `packagePriceCUP`, `packageQuantity`, `packageUnitId`, `effectiveFrom`, `sourceNote`. Mostrar antes de guardar la unidad base y el precio normalizado calculado por el servidor; no usar cálculo de coma flotante del frontend como fuente autoritativa.
- Deshabilita las acciones de escritura para `VIEWER` (además de la autorización obligatoria del backend). No confíes en ocultar botones como mecanismo de seguridad.
- Estados de carga, lista vacía, error de red, validación y confirmación de operaciones. No añadas datos ficticios para reemplazar fallos de API.
- Usa las convenciones visuales existentes. Mantén diseño responsive básico sin introducir una biblioteca visual nueva.

## Seed de unidades

Inspecciona el seed existente. Si ya existe un seed idempotente para `MeasurementUnit`, reutilízalo y verifica que existe un script documentado para ejecutarlo. Si no existe o está incompleto, ajústalo de forma idempotente para las unidades necesarias, conservando los códigos y dimensiones actuales. No ejecutes el seed ni ningún comando que escriba datos en la base de desarrollo durante esta tarea. Documenta el comando que el usuario ejecutará manualmente después de revisar los cambios.

## Seguridad y restricciones explícitas

- No alteres `prisma/schema.prisma`, `prisma.config.ts`, migraciones, baseline, restricciones SQL ni cliente generado.
- No ejecutes `prisma migrate`, `prisma db push`, `prisma migrate reset`, seed ni comandos destructivos/escrituras en PostgreSQL.
- No cambies datos o secretos en `.env`; actualiza `.env.example` solo si hace falta.
- No añadas cuentas, panaderías o datos de demostración.
- No añadas Swagger, librerías visuales grandes ni dependencias que no sean necesarias.
- No ejecutes `npm audit fix` automáticamente ni actualices Prisma. Informa de los advisories detectados, no amplíes su alcance.
- No registres JWT, contraseñas, datos de formulario sensibles ni el contenido completo de las solicitudes en logs.
- No inventes endpoints del backend auth; confirma los contratos existentes inspeccionando su implementación.
- No uses `any` sin justificación concreta.

## Pruebas requeridas

### Backend

- Tests unitarios del servicio de materiales: validación, búsqueda/filtros, paginación, conversión Decimal, precio actual e historial.
- Creación/edición de material y precio con permisos de `ADMIN` y `EDITOR`.
- `VIEWER` puede leer pero recibe 403 al escribir.
- Un usuario no puede leer o modificar material de otro negocio manipulando el UUID o `X-Bakery-Id`.
- Unidad inexistente/inactiva, dimensiones incompatibles, importe/cantidad no positivos, fecha inválida, fecha retroactiva y fechas solapadas se rechazan.
- Alta de precio cierra el período anterior de manera correcta y conserva historial, incluyendo el límite de fecha entre períodos.
- Si existen pruebas e2e basadas en la infraestructura actual, añade cobertura de rutas nuevas sin destruir/restablecer la base de desarrollo.

### Frontend

- Pruebas para login/estado de sesión y tratamiento de 401.
- Interceptor añade Bearer y `X-Bakery-Id` solo donde corresponde.
- La selección de negocio muestra solo los resultados del endpoint del usuario.
- Pruebas de formularios de material y precio, permisos de solo lectura y estados de error/vacío.

## Verificaciones finales

Ejecuta las verificaciones aplicables en las dos carpetas:

Backend:
- `npx prisma validate`
- `npx prisma generate` (solo si es necesario; no debe producir cambios al cliente versionado)
- `npm run build`
- `npm test`
- `npm run test:e2e`
- `npm run lint`
- `git diff --check`

Frontend: primero inspecciona scripts existentes y ejecuta build, pruebas y lint equivalentes definidos en `package.json`.

No marques una comprobación como pasada si no la ejecutaste. Si pruebas e2e requieren configuración local ausente, informa exactamente cuál.

## Criterios de aceptación

- Un usuario puede iniciar sesión, seleccionar una de sus panaderías y trabajar en el catálogo desde Angular.
- Cada llamada empresarial está protegida por autenticación, contexto y rol en NestJS.
- Materias primas y precios están aislados por `bakeryId`.
- Precios actuales e históricos son reproducibles, con conversiones decimales comprobables y sin solapamiento de períodos aceptado por la API.
- Angular no usa fixtures/datos inventados como sustituto de la API.
- El esquema Prisma y el historial de migraciones permanecen intactos; ningún comando de base de datos que escriba datos se ejecutó.

## Informe final

Al terminar, reporta:

1. Funciones completadas y rutas API añadidas.
2. Archivos nuevos/modificados en backend y frontend.
3. Contratos de request/response relevantes.
4. Comandos de build/test/lint ejecutados y resultados exactos.
5. Cómo configurar `JWT_SECRET`, ejecutar `bootstrap:admin` y ejecutar manualmente el seed de unidades, sin exponer secretos ni ejecutar esos comandos por cuenta propia.
6. Limitaciones o riesgos pendientes (incluyendo conversiones masa/volumen y concurrencia del historial si siguen limitadas).
7. Confirmación explícita de que esquema Prisma, migraciones, baseline y datos de PostgreSQL no se modificaron.
