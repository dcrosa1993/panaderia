# Copilot CLI — Fase 04: Productos y recetario digital (vertical slice)

## Objetivo

Implementa una experiencia completa en Angular y NestJS para gestionar productos de una panadería y sus recetas versionadas. Reutiliza las tablas existentes `Product`, `RecipeVersion` y `RecipeMaterial`, así como el catálogo global de unidades, el catálogo de materias primas, la autenticación y el contexto multiempresa.

Esta fase **no** implementa el motor de costes, salarios, gastos indirectos, escenarios de precios ni cálculos fiscales. El objetivo es crear y mantener productos y recetas fiables para alimentar esas fases posteriores.

## Antes de modificar archivos

1. Lee `AGENTS.md`, `.github/copilot-instructions.md`, `docs/architecture-v1.md` y `docs/development-workflow.md` si existen, junto con los README actuales.
2. Inspecciona el código real de Angular y NestJS, `package.json` de ambos, rutas, servicios, DTOs, auth, guard de contexto multiempresa, materiales, unidades, pruebas existentes y `backend/prisma/schema.prisma`.
3. Confirma los contratos reales de autenticación, selección de panadería, respuestas de materiales/unidades y los tipos generados por Prisma. No inventes firmas de servicios ni asumas nombres distintos de los presentes en el esquema.
4. Conserva las versiones actuales de Angular, NestJS, Prisma 7.10.0, ESM/NodeNext, `@prisma/adapter-pg`, el cliente generado en `backend/src/generated/prisma`, el prefijo `/api/v1`, el estilo de pruebas y las convenciones visuales existentes.
5. Presenta primero un plan breve y luego implementa la tarea completa. Para decisiones ordinarias dentro de este alcance, toma una decisión razonable y documéntala en vez de detenerte a preguntar.

## Modelo de datos existente (no modificar)

Reutiliza exactamente las entidades y los campos existentes:

- `Product`: `id`, `bakeryId`, `name`, `description`, `salesUnitId`, `status`, fechas. `status` usa `ProductStatus` (`ACTIVE`, `INACTIVE`, `ARCHIVED`).
- `RecipeVersion`: `id`, `bakeryId`, `productId`, `versionNumber`, `status`, `outputQuantity`, `outputUnitId`, `effectiveFrom`, `effectiveTo`, `preparationNotes`, fechas. `status` usa `RecipeVersionStatus` (`DRAFT`, `PUBLISHED`, `ARCHIVED`).
- `RecipeMaterial`: `id`, `bakeryId`, `recipeVersionId`, `materialId`, `quantity`, `unitId`, `position`, `notes`.
- `Material` incluye `bakeryId`, `name`, `kind`, `baseUnitId`, `isActive`; `MeasurementUnit` es global y contiene `code`, `name`, `dimension`, `conversionFactor` e `isActive`.

No alteres `schema.prisma`, `prisma.config.ts`, migraciones, baseline, restricciones SQL ni cliente generado. Si descubres que una función requerida de forma esencial no puede implementarse con el esquema existente, no cambies el esquema: informa exactamente de la limitación y ofrece una solución compatible con el modelo actual.

## Alcance A — API de productos

Implementa un módulo NestJS para productos y otro de recetas si encaja con la arquitectura actual; evita módulos duplicados o lógica duplicada.

Rutas propuestas bajo el prefijo global actual `/api/v1` (adáptalas solo para mantener coherencia con el estilo de rutas existente y documenta la ruta definitiva):

- `GET /products`: lista productos del negocio activo. Soporta `search`, `status`, `page`, `pageSize`; default página 1, tamaño 20, máximo 100. Orden estable por nombre e id y metadatos de paginación.
- `POST /products`: crea un producto con `name`, `description` opcional y `salesUnitId`. El servidor obtiene `bakeryId` del contexto autorizado; nunca acepta el `bakeryId` del body como autoridad.
- `GET /products/:id`: muestra detalle, unidad de venta y resumen de versiones de receta.
- `PATCH /products/:id`: modifica nombre, descripción y estado permitido. No permite modificar `bakeryId` ni `id`.
- `GET /products/:id/recipe-versions`: lista las versiones en orden descendente por `versionNumber`, con estado y fechas de vigencia.
- `POST /products/:id/recipe-versions`: crea una versión DRAFT con `versionNumber` asignado por el servidor. Si existe una versión publicada, copia su rendimiento, unidad de salida, notas y líneas de ingredientes a la nueva versión para facilitar cambios; si no existe ninguna, crea un borrador vacío con valores proporcionados válidos. La operación de incrementar versión debe ser transaccional y debe manejar conflictos concurrentes de forma controlada.
- `GET /products/:productId/recipe-versions/:versionId`: devuelve una versión y sus líneas, con los nombres/unidades necesarias para la interfaz.
- `PATCH /products/:productId/recipe-versions/:versionId`: permite editar solamente un borrador. Campos editables: `outputQuantity`, `outputUnitId`, `preparationNotes`. No aceptar `status`, `bakeryId`, `productId` ni `versionNumber` desde el body.
- `PUT /products/:productId/recipe-versions/:versionId/materials`: sustituye atómicamente la lista completa de materiales del borrador. Cada línea contiene `materialId`, `quantity`, `unitId` y `notes` opcional. Valida todo el conjunto antes de completar la transacción.
- `POST /products/:productId/recipe-versions/:versionId/publish`: publica un borrador usando `effectiveFrom` con formato estricto `YYYY-MM-DD`. Publicar requiere validaciones descritas abajo.
- `POST /products/:productId/recipe-versions/:versionId/archive`: opcional, solo si encaja sin cambiar el esquema; permite archivar un borrador abandonado, no una versión publicada histórica.

Usa DTOs con validación estricta y rechaza campos no permitidos si la configuración existente lo soporta. No devuelvas entidades Prisma crudas: define respuestas de API explícitas.

## Autorización multiempresa

- Todas las rutas de negocio requieren usuario autenticado y contexto de panadería mediante el mecanismo actual, incluyendo `X-Bakery-Id`.
- Usa los guard/decoradores existentes; no construyas un segundo mecanismo de permisos.
- `ADMIN` y `EDITOR` pueden crear/editar productos, borradores y publicar versiones. `VIEWER` solo puede leer; recibe 403 al intentar escribir.
- Cada consulta y operación se limita por `bakeryId` tomado del contexto validado. Comprueba que producto, versión, materiales y líneas pertenezcan al mismo negocio.
- Para recursos inexistentes o pertenecientes a otra panadería, devuelve 404 con el objetivo de evitar enumeración interempresa.
- No confíes en Angular para aplicar seguridad. Las comprobaciones en NestJS son obligatorias.

## Reglas de producto y versionado

1. Producto nuevo empieza en `ACTIVE`. No borres físicamente productos ni versiones con relaciones. Para ocultar un producto usa el estado permitido y conserva sus recetas históricas.
2. Una versión `DRAFT` se puede editar; una versión `PUBLISHED` es inmutable salvo para cerrar `effectiveTo` de la versión anterior cuando se publique la siguiente. No permitas editar directamente una versión publicada.
3. `versionNumber` se asigna en servidor y es único dentro del producto según las restricciones presentes.
4. Un producto activo puede tener varias versiones históricas publicadas, pero no debe haber dos versiones publicadas con períodos de vigencia que se solapen. Al publicar una versión nueva con fecha posterior a la versión publicada más reciente, la transacción debe cerrar la anterior en el día anterior a la nueva fecha. Si la fecha de publicación es retroactiva o no deja intervalos válidos, recházala con un error claro.
5. En un producto sin versión publicada, la primera fecha de publicación puede ser cualquier fecha válida dentro del flujo de MVP.
6. No publiques una versión con `outputQuantity <= 0`, unidad de salida inactiva/inexistente, cero líneas de ingredientes, cantidades de ingredientes no positivas, material inactivo/inexistente o unidad inactiva/incompatible.
7. La unidad de salida y la unidad de venta del producto deben tener la misma dimensión. En esta fase no se admite convertir masa a volumen ni otras conversiones entre dimensiones diferentes.
8. Cada unidad de una línea de ingrediente debe tener la misma dimensión que la unidad base del material asociado. Puedes convertir cantidades para mostrar equivalencias utilizando factores de conversión decimales, pero conserva en `RecipeMaterial` la cantidad y unidad escogidas por el usuario. No uses densidad para convertir masa/volumen en esta fase.
9. Rechaza materiales duplicados dentro de una sola receta para evitar ambigüedad en la interfaz. Si se necesita utilizar el mismo material en dos etapas, pide que se represente en una línea con su cantidad total o documenta esta limitación de MVP.
10. Una versión publicada debe tener `effectiveFrom`. El campo `effectiveTo` se cierra al publicar la siguiente versión, si corresponde. Trata las fechas como fechas de calendario (`DATE`), no como timestamps con desplazamiento de zona horaria.
11. La disponibilidad de un precio de material no es un requisito para guardar o publicar una receta. Si una materia prima no tiene precio vigente, muestra una advertencia informativa; no supongas un coste cero ni inventes un precio.
12. La publicación de una receta y el cierre de su versión anterior se realizan en una única transacción. Maneja errores de concurrencia/versionado con un mensaje de conflicto controlado. No afirmes protección absoluta contra toda concurrencia si no existe restricción SQL que la garantice.

## Alcance B — Angular: lista de productos y editor de recetas

Implementa una experiencia en español reutilizando la sesión, selector de panadería, interceptor, guards y estilos actuales.

- Ruta `/products`: lista de productos con búsqueda, filtro de estado, unidad de venta, versión vigente/resumen y estado de receta (sin receta, borrador disponible, publicada). Paginación y estados de carga/error/vacío.
- Formulario para crear/editar producto con nombre, descripción y unidad de venta seleccionada desde `GET /api/v1/measurement-units`.
- Vista de detalle del producto con su historial de versiones: número, estado, rendimiento, unidad de salida y fechas de vigencia.
- Acción para crear un borrador nuevo. Si hay una versión publicada, indica claramente que el sistema clonó sus ingredientes y rendimiento a un nuevo borrador.
- Editor de receta borrador: rendimiento del lote, unidad de salida, notas de preparación y tabla dinámica de ingredientes. Cada línea permite elegir una materia prima activa, cantidad positiva, unidad de medida compatible y nota opcional; permite añadir y quitar líneas.
- Consume las rutas reales de materiales para presentar nombre, unidad base y, si la API ya lo entrega, precio vigente solo como dato orientativo. No calcules coste de producción total en esta fase.
- Presenta advertencia si una materia prima no tiene precio vigente, pero permite editar la receta.
- Acción «Publicar versión» con confirmación y fecha de vigencia. Debe explicar que la versión publicada queda de solo lectura y que los cambios posteriores se realizan creando otra versión.
- Acciones de escritura deshabilitadas/ocultas para `VIEWER`, además de validar permisos en backend.
- Implementa validaciones de formularios, mensajes accionables, estado de carga, errores de API, y diseño responsive básico. No añadas una biblioteca visual grande ni datos de demostración.
- No almacenes datos de recetas como fixtures para aparentar que el backend funciona. La fuente real será la API.

## Precisión numérica y contratos

- Cantidades de receta y rendimiento viajan como cadenas decimales en JSON; evita cálculos económicos con `number` en el backend.
- En Angular se permite usar números para validar si el campo está vacío o para controles visuales, pero no como fuente autoritativa de resultados económicos.
- Devuelve decimales como strings y fechas como `YYYY-MM-DD` en contratos de API.
- El servidor debe validar cantidades finitas y positivas con Decimal y comprobar dimensiones desde `MeasurementUnit`.
- Mantén los errores API compatibles con el formato de error global existente.

## Pruebas requeridas

### Backend

- CRUD de producto, búsqueda, filtros, paginación y restricciones por negocio.
- `ADMIN` y `EDITOR` escriben; `VIEWER` puede leer y recibe 403 al modificar o publicar.
- No se puede acceder a productos/versiones de otro negocio cambiando UUID o `X-Bakery-Id`.
- Crear un primer borrador; crear versión nueva clonando una publicada; número de versión correcto.
- Un borrador puede editar rendimiento, unidad, notas e ingredientes; una versión publicada es inmutable.
- Rechazo de cantidades cero/negativas, unidad inactiva, dimensión incompatible, materia prima inactiva, ingredientes duplicados y receta vacía al publicar.
- Publicar la nueva versión cierra el período anterior el día previo; fechas retroactivas y solapamientos se rechazan.
- Operaciones de reemplazo de líneas y publicación son transaccionales: si un elemento falla, no debe guardarse solo parte de los cambios.
- Añade pruebas unitarias y e2e siguiendo la infraestructura existente. Si las pruebas e2e usan mocks, declara ese hecho explícitamente; no afirmes integración real con PostgreSQL si no se ejecuta.

### Frontend

- Tests de servicios y pantallas de productos/recetas.
- Validación de rendimiento y líneas de ingredientes.
- No mostrar acciones de escritura a `VIEWER` y manejar respuestas 403/404.
- Creación, edición, creación de nueva versión, guardado de líneas y publicación.
- Estados vacíos, cargas, error de API, falta de precio vigente y versión publicada de solo lectura.

## Restricciones explícitas

- No modifiques `schema.prisma`, `prisma.config.ts`, migraciones, baseline, restricciones SQL, cliente generado ni el seed global.
- No ejecutes `prisma migrate`, `prisma db push`, `prisma migrate reset`, seed ni comandos que escriban/borran datos en PostgreSQL.
- No cambies el `.env` local ni añadas secretos. Actualiza `.env.example` solo si de verdad es necesario.
- No agregues cuentas, panaderías o recetas de demostración.
- No implementes costes, impuestos, escenarios de precio ni operaciones laborales en esta fase.
- No actualices Angular, NestJS, Prisma ni dependencias a versiones nuevas. No ejecutes `npm audit fix` automáticamente.
- No uses `any` sin una justificación concreta y localizada.
- No registres tokens, contraseñas o payloads sensibles en logs.

## Verificaciones finales

Ejecuta las verificaciones disponibles, según los scripts reales:

Backend:
- `npx prisma validate`
- `npm run build`
- `npm test`
- `npm run test:e2e`
- `npm run lint`
- `git diff --check`

Frontend:
- inspecciona `package.json` y ejecuta build, pruebas y lint solo si existe un script correspondiente. Si lint no existe, indica explícitamente que no fue ejecutado.

No marques una comprobación como exitosa si no se ejecutó. Si hay pruebas con mocks o requisitos locales ausentes, explica el límite.

## Criterios de aceptación

- Un usuario autorizado puede crear un producto, redactar una receta, añadir ingredientes y publicar una versión desde Angular.
- El backend aplica autenticación, contexto y roles de forma coherente con el resto de la app.
- Las recetas están aisladas por `bakeryId` y versionadas; las versiones publicadas quedan protegidas contra edición directa.
- Las fechas de vigencia de versiones publicadas no se solapan en operaciones normales y los conflictos se devuelven claramente.
- Unidades incompatibles y cantidades inválidas no se aceptan.
- La aplicación no simula costes ni datos que no vienen de la API.
- El esquema Prisma y las migraciones permanecen intactos; no se ejecutaron comandos de escritura en PostgreSQL.

## Informe final

Al terminar, informa:

1. Funcionalidades y rutas API implementadas.
2. Archivos nuevos y modificados en backend y frontend.
3. Contratos principales de request/response.
4. Comandos de build, pruebas y lint ejecutados y sus resultados exactos.
5. Cómo probar manualmente la gestión de productos/recetas y qué requisitos de seed/configuración siguen pendientes, sin ejecutar esos pasos por tu cuenta.
6. Limitaciones o riesgos pendientes, especialmente concurrencia de versiones y datos de precio ausentes.
7. Confirmación explícita de que esquema Prisma, migraciones, baseline y datos PostgreSQL no se modificaron.
