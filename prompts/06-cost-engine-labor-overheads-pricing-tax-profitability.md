# Iteración 06 — Motor de costes, mano de obra, gastos indirectos, precios, impuestos y rentabilidad

## Papel y objetivo

Actúa como agente senior full-stack especializado en Angular, NestJS, Prisma ORM 7 y PostgreSQL. Implementa esta iteración en el repositorio existente `panaderia`, respetando la arquitectura, autenticación multiempresa, roles, validación, estilo y dependencias actuales.

**Debes implementar las tres áreas en esta misma iteración**, no limitarte a una propuesta o a la primera parte:

1. Motor de costes de fabricación basado en recetas publicadas y precios históricos.
2. Gestión de puestos/tarifas laborales por hora, operaciones laborales de receta y gastos indirectos con métodos de distribución.
3. Escenarios de precios, impuestos estimados, precio de equilibrio y rentabilidad.

Trabaja por etapas internas en el orden indicado, pero continúa hasta completar las tres áreas y ejecutar las verificaciones. Si una limitación real del esquema impide una parte, implementa las partes que sí sean posibles y reporta con precisión el bloqueo; no inventes campos ni afirmes que una función quedó terminada.

## 0. Inspección obligatoria antes de editar

1. Lee `AGENTS.md`, `.github/copilot-instructions.md`, `docs/architecture-v1.md`, `docs/development-workflow.md` y la documentación existente relacionada con costes y fiscalidad, si existen.
2. Inspecciona el estado Git (`git status` y `git diff`) y **no sobrescribas cambios preexistentes**.
3. Inspecciona el `schema.prisma` real, los módulos NestJS existentes, los contratos API, los guards/decoradores de autorización, el interceptor Angular, las rutas y componentes del catálogo de productos/recetas, y los scripts `package.json`.
4. Confirma cómo interpreta el proyecto `MeasurementUnit.conversionFactor` y cómo el seed normaliza las unidades. No supongas el sentido del factor: dedúcelo del código y las pruebas existentes.
5. El esquema previsto ya contempla `CostCalculation`, `CalculationLine`, `LaborRole`, `LaborRate`, `RecipeLaborOperation`, `OverheadExpense`, `TaxRule`, `TaxRuleVersion`, `TaxBracket`, `BakeryTaxRule`, `PriceScenario` y `ScenarioTaxLine`. Usa las entidades y enumeraciones reales, no crees modelos paralelos.
6. En la versión del esquema diseñada, el enum de reparto es `AllocationMethod.DIRECT_COST_PROPORTION` (no `DIRECT_COST_PERCENT`). Comprueba el esquema real antes de referenciar enums.

## 1. Restricciones no negociables

- No modifiques `schema.prisma`, `prisma.config.ts`, migraciones, baseline ni cliente Prisma generado en esta tarea.
- No ejecutes `prisma migrate`, `prisma db push`, seed, bootstrap del administrador ni ningún comando que escriba en la base PostgreSQL local. No escribas ni borres registros reales.
- No cambies `.env`, no imprimas secretos y no incorpores credenciales al código, snapshots, logs o documentación.
- No actualices el major de Angular, NestJS o Prisma. No ejecutes `npm audit fix` ni actualizaciones masivas.
- Usa las dependencias existentes. Añade nuevas solo si son imprescindibles, explicando por qué.
- Conserva ESM/NodeNext, Prisma ORM 7.10, `@prisma/adapter-pg`, el prefijo `/api/v1`, los endpoints existentes y el sistema visual NG-ZORRO + Tailwind CSS.
- Todas las rutas de datos de negocio deben exigir autenticación y contexto `X-Bakery-Id` mediante los guards/decoradores actuales. El backend es la autoridad; nunca confíes en el ID enviado por el cliente sin validar la membresía activa y el negocio activo.
- Roles: `ADMIN` y `EDITOR` pueden crear/editar recetas de trabajo, tarifas, gastos, ejecutar costes y escenarios; `VIEWER` solo puede consultar. Configurar asignaciones fiscales será exclusivamente `ADMIN`. Ajusta a convenciones existentes si son más estrictas, pero nunca más permisivas.
- Relaciones y consultas deben quedar aisladas por `bakeryId`. Devuelve 404 cuando corresponda ocultar recursos de otro negocio y no filtres datos de otra panadería.
- Usa `Prisma.Decimal` o el tipo decimal compatible generado. **No conviertas importes ni cantidades a `number` de JavaScript para hacer aritmética monetaria**. Serializa los decimales como cadenas en JSON/API.
- No conviertas faltantes en cero. Si falta precio, tarifa, rendimiento, denominador de distribución o regla fiscal necesaria, devuelve un resultado explícitamente incompleto con las razones.
- Los cálculos guardados y las líneas de detalle son históricos/inmutables desde el punto de vista funcional. Recalcular crea otro `CostCalculation`; no actualices ni elimines un cálculo previo cuando cambien precios, tarifas, receta o reglas.
- Usa etiquetas de interfaz en español y manejo de errores coherente con la app.

## 2. Entrega A — Motor de costes

### 2.1 API y flujo

Implementa endpoints coherentes con las convenciones existentes. Contrato propuesto (adáptalo al estilo real del proyecto, manteniendo la semántica):

- `POST /api/v1/products/:productId/cost-calculations`: calcula y guarda un coste histórico. Acepta `valuationDate` (`YYYY-MM-DD`) y opcionalmente `recipeVersionId`; si se omite, selecciona la versión `PUBLISHED` vigente para esa fecha.
- `GET /api/v1/products/:productId/cost-calculations`: lista los cálculos del producto, más recientes primero, paginados si el proyecto ya usa paginación.
- `GET /api/v1/cost-calculations/:calculationId`: detalle completo, desglose por línea, entradas snapshot, advertencias y estado.
- Si la organización existente aconseja anidar el detalle bajo productos, conserva un patrón uniforme, sin duplicar endpoints innecesariamente.

Validar que el producto y la versión pertenecen a la panadería del contexto; que la receta está publicada y vigente en `valuationDate`; que la fecha es una fecha calendario válida; y que no haya más de una versión publicada efectiva para el mismo producto/fecha. Si el dato histórico es ambiguo, no elijas arbitrariamente.

El cálculo debe ser una operación transaccional: crear `CostCalculation`, `CalculationLine` y `inputSnapshot` de forma coherente. Usa las APIs Prisma vigentes en la versión instalada.

### 2.2 Coste de materiales

Para cada `RecipeMaterial`:

1. Cargar el material activo, unidad base, unidad de la línea, y el precio de compra que cubra `valuationDate`: `effectiveFrom <= valuationDate` y (`effectiveTo` nulo o `effectiveTo >= valuationDate`).
2. Si no hay precio o hay varios precios vigentes ambiguos, no asumas cero ni elijas arbitrariamente: añade una razón de incompletitud.
3. Convertir la cantidad de la receta a la unidad base del material.
4. Calcular también la cantidad del paquete de compra en esa misma unidad base.
5. `costPerBaseUnit = packagePriceCUP / packageQuantityInBaseUnit`.
6. `materialLineCost = recipeQuantityInBaseUnit * costPerBaseUnit`.
7. Cada conversión debe respetar dimensiones. Solo permitir masa↔volumen cuando el material tenga densidad positiva configurada, y aplicar esa densidad correctamente. No inferir densidad de la unidad ni usar aproximaciones genéricas.
8. Las unidades inactivas, incompatibles o desconocidas, cantidades no positivas o denominadores inválidos producen error de validación o cálculo incompleto según la etapa, nunca coste cero.

Las líneas `MATERIAL` de `CalculationLine` deben guardar descripción y código de unidad como snapshot, cantidad convertida, precio unitario y total en CUP, e información de origen suficiente en `detailsSnapshot` (IDs/versiones, precio aplicado, unidades y factores de conversión). Los decimales dentro de JSON deben serializarse como strings.

### 2.3 Unidad y rendimiento del producto

`RecipeVersion.outputQuantity` y `outputUnitId` describen la salida vendible del lote. El coste unitario debe corresponder a la unidad comercial `Product.salesUnitId`, no necesariamente a la unidad de salida sin convertir.

- Convertir la salida a `Product.salesUnitId` únicamente si las unidades son compatibles y la conversión está definida.
- Si no se puede convertir con seguridad, marca el cálculo incompleto y no presentes un `unitCostCUP` como válido.
- Aplicar mermas mediante el rendimiento vendible registrado de la receta; no restar mermas una segunda vez.
- Validar rendimiento y cantidad de salida positivos.

### 2.4 Mano de obra incluida en el lote

Para cada `RecipeLaborOperation`, busca la tarifa de `LaborRole` vigente en `valuationDate`, con `effectiveFrom <= valuationDate` y `effectiveTo` nulo o `effectiveTo >= valuationDate`.

Fórmula por operación:

`laborCostCUP = hourlyRateCUP * (durationMinutes / 60) * workersCount`

Usa aritmética Decimal. Si falta la tarifa, hay tarifas superpuestas, el puesto está inactivo o la cantidad/duración no es válida, registra la razón y no presupongas coste cero.

Guarda una línea `LABOR` por operación con puesto, duración, tarifa/hora snapshot, número de trabajadores y resultado. Una receta sin operaciones laborales debe dejar `laborCostCUP` nulo y el cálculo `INCOMPLETE`, con la advertencia explícita “No hay operaciones de mano de obra configuradas”. No inventes ni asumas un coste laboral cero: el usuario debe añadir las operaciones necesarias al borrador y publicar una nueva versión de receta.

### 2.5 Cálculo total y estados

- `materialCostCUP`: suma del componente solo si todos los materiales se valoraron correctamente; de lo contrario nulo.
- `laborCostCUP`: suma solo si todas las operaciones configuradas se valoraron correctamente; de lo contrario nulo.
- `overheadCostCUP`: suma asignada solo si todos los gastos aplicables se pueden calcular; de lo contrario nulo.
- `totalProductionCostCUP` y `unitCostCUP` deben ser nulos cuando exista un faltante que invalide el total.
- Guarda `status = COMPLETE` solo si los tres componentes son calculables y no existen razones bloqueantes; `INCOMPLETE` si falta una entrada necesaria. `FAILED` solo para fallos técnicos que impidan persistir un resultado coherente; propaga errores inesperados después de registrar logs seguros.
- El campo `incompleteReasons` debe ser estructurado y legible, no una cadena genérica. El API/UI debe mostrar el detalle sin exponer datos sensibles.
- Define una única política de redondeo. Mantén precisión Decimal en líneas e intermedios y redondea resultados monetarios a dos decimales en los límites documentados. Para `unitCostCUP`, conserva la precisión compatible con el tipo del esquema y muestra CUP con dos decimales en UI.

## 3. Entrega B — Puestos, tarifas laborales, operaciones y gastos indirectos

### 3.1 Puestos y tarifas por hora

Implementa un módulo backend para `LaborRole` y `LaborRate` y sus pantallas Angular, reutilizando NG-ZORRO y Tailwind:

- Listar/buscar puestos del negocio, ver estado activo y crear/editar o desactivar puestos.
- Ver el historial de tarifas por hora en CUP.
- Crear una tarifa para `effectiveFrom` y opcionalmente `effectiveTo`.
- Validar tarifa no negativa, fechas correctas y evitar rangos inclusivos solapados. Si se introduce una tarifa nueva cronológica, seguir el patrón usado por `MaterialPrice` y cerrar el período anterior al día previo cuando sea seguro; no reescribir registros referenciados históricamente sin necesidad.
- La prevención a nivel servicio debe usar transacción/aislamiento adecuados y convertir conflictos de unicidad/serialización en errores controlados. No afirmes que elimina todas las carreras si no hay restricción SQL.
- Convención API sugerida: `GET/POST /api/v1/labor-roles`, `GET/PATCH /api/v1/labor-roles/:id`, `GET/POST /api/v1/labor-roles/:id/rates`.

### 3.2 Operaciones de mano de obra en el editor de recetas

Integra las operaciones laborales del modelo `RecipeLaborOperation` en el flujo existente de versiones de receta:

- Mostrar, añadir, editar, reordenar y quitar operaciones en versiones `DRAFT`.
- Cada operación incluye nombre, puesto, duración en minutos por lote, trabajadores (puede ser decimal si el modelo lo permite) y notas opcionales.
- Las operaciones solo se pueden modificar si la versión es borrador. Las publicadas quedan de solo lectura; los cambios deben ir a una nueva versión de receta.
- Validar que el puesto pertenece a la misma panadería y está activo.
- Usa una operación bulk y transaccional al reemplazar la lista si ese es el patrón del editor actual.

### 3.3 Gastos indirectos

Implementa CRUD seguro (sin borrado destructivo; como mínimo alta, consulta, edición y archivado lógico si el modelo lo admite) de `OverheadExpense`:

- Campos: nombre, categoría, importe CUP, inicio y fin del período, método de reparto, denominador/base prevista, unidad base cuando corresponda y notas.
- `periodStart` y `periodEnd` deben ser fechas válidas y `periodEnd >= periodStart`.
- `amountCUP` y `allocationBaseQuantity` deben ser positivos; si el método exige base y no está configurada, el gasto no se podrá utilizar en un cálculo completo.
- Mostrar claramente el período al que corresponde cada gasto.
- Endpoints sugeridos: `GET/POST /api/v1/overhead-expenses`, `GET/PATCH /api/v1/overhead-expenses/:id`, con filtro de categoría/fecha si encaja en la arquitectura existente.

Implementa los métodos de distribución según los campos reales del esquema:

- `LABOR_HOURS`: `allocationBaseQuantity` representa las horas de mano de obra totales previstas para el período; `allocationUnitId` debe ser una unidad `TIME` convertible a horas. La parte por lote es `expense.amountCUP * batchLaborHours / periodLaborHours`.
- `BATCHES`: `allocationBaseQuantity` representa el número total de lotes previstos del período. La parte por lote es `expense.amountCUP / expectedBatches`.
- `OUTPUT_QUANTITY`: `allocationBaseQuantity` es la producción total prevista durante el período y `allocationUnitId` la unidad dimensional de referencia. Convertir la salida vendible del lote a esa unidad; asignar `expense.amountCUP * batchOutputQuantity / periodOutputQuantity`.
- `DIRECT_COST_PROPORTION`: dado que el esquema existente almacena el denominador en `allocationBaseQuantity` y no tiene un campo porcentaje separado, documenta y valida que representa el coste directo total previsto en CUP para el período. La parte del lote es `expense.amountCUP * batchDirectCostCUP / periodDirectCostBaseCUP`. `allocationUnitId` debe quedar nulo para este método.

Si la base, unidad, período o método no son suficientes para asignar una partida sin ambigüedad, el cálculo se marca `INCOMPLETE`; no se descarta el gasto ni se inventa un denominador. Solo incluye en el coste los gastos cuyos períodos contienen la fecha de valoración. Si no hay ningún gasto indirecto configurado para la fecha de valoración, marca el cálculo `INCOMPLETE` con “No hay gastos indirectos configurados para esta fecha”; no asumas coste indirecto cero. Si hay gastos registrados solo para otros períodos, no los asignes fuera de vigencia y muestra ese límite en el motivo de incompletitud.

Prevenir doble contabilización: `CostCalculation` incluye los gastos indirectos asignados al producto en el coste de fabricación. En el escenario comercial, `otherOperatingExpensesCUP` debe representar gastos adicionales del período que no estén ya recogidos en `costOfSalesCUP`.

## 4. Entrega C — Impuestos, precios y rentabilidad

### 4.1 Estado fiscal y supuestos acordados

La aplicación debe incluir al inicio las dos reglas de simulación acordadas por el usuario:

- 10 % sobre ventas netas.
- 5 % sobre utilidad estimada.

Son **supuestos de planificación pendientes de validación normativa**; no se deben presentar como una liquidación fiscal oficial de TCP. Comprueba el seed y las tablas globales existentes (`TaxRule`, `TaxRuleVersion`, `BakeryTaxRule`). No dupliques plantillas si ya existen.

- Las reglas con `PENDING_VALIDATION` se pueden emplear en escenarios gerenciales solo cuando un `ADMIN` las asigna y habilita explícitamente para esa panadería.
- La interfaz debe presentar una advertencia visible “Supuesto fiscal no validado; no es una liquidación tributaria oficial”. Mantén `verificationStatusSnapshot` y la tasa/base aplicadas en `ScenarioTaxLine`.
- La configuración fiscal (asignar, habilitar/deshabilitar, vigencia y notas) solo la puede cambiar `ADMIN`. `EDITOR` puede crear escenarios con las reglas habilitadas; `VIEWER` solo consultar.
- Si faltan reglas necesarias, no supongas impuestos de cero: el escenario queda `INCOMPLETE`, guarda y muestra las métricas pretributarias calculables y enumera qué falta. No completes `profitAfterTaxCUP` con un valor ficticio.
- No cambies tasas globales ni su estado de verificación desde la configuración de una panadería; administra la asignación de esa versión a un negocio.
- No hagas afirmaciones legales nuevas ni cambies la configuración pendiente de validación a `VERIFIED`.

Implementa endpoints consistentes, por ejemplo:

- `GET /api/v1/tax-settings/rules`: catálogo de reglas/versiones disponibles para escenarios.
- `GET /api/v1/tax-settings/assignments`: asignaciones de la panadería actual.
- `POST /api/v1/tax-settings/assignments`: asignar versión a esa panadería, con vigencia/nota y estado habilitado explícito según validación.
- `PATCH /api/v1/tax-settings/assignments/:id`: habilitar/deshabilitar o modificar vigencia/notas, siempre limitado por `bakeryId`.

Aprovecha las rutas y convenciones existentes si ya hay módulos fiscales parciales. No dupliques interfaces.

### 4.2 Crear y consultar escenarios

Implementa escenarios persistidos vinculados a un `CostCalculation`:

- Crear escenario con nombre, `salePriceCUP` por unidad de venta, `projectedQuantity`, `salePriceTaxTreatment` (`TAX_EXCLUDED_FROM_PRICE`, `TAX_INCLUDED_IN_PRICE` o `NOT_CONFIGURED`), descuentos/devoluciones en CUP y `otherOperatingExpensesCUP` opcional.
- Lista e historial de escenarios asociados al cálculo y lectura del detalle con `ScenarioTaxLine`.
- La creación de escenarios y su cálculo debe ocurrir en el servidor, con una transacción coherente.
- No se permite crear un escenario de una panadería con el cálculo de otra.
- Reutiliza los campos del esquema: `PriceScenario`, `ScenarioTaxLine`. Los detalles derivados adicionales (por ejemplo, total cobrado al cliente y precio de equilibrio) pueden guardarse en `calculationSnapshot` como strings decimales.
- Un nuevo intento o cambio de precio crea otro escenario o una nueva ejecución de cálculo de escenario sin alterar silenciosamente el resultado histórico previo.

### 4.3 Definiciones inequívocas de fórmulas

Usa estos significados en backend, DTO, documentación y UI:

- `grossSalesCUP = salePriceCUP * projectedQuantity`, antes de descuentos/devoluciones y expresado en la base de precio elegida.
- `discountsReturnsCUP` se introduce en la misma base que el precio mostrado (importe con impuesto incluido si la elección es `TAX_INCLUDED_IN_PRICE`; excluido si es `TAX_EXCLUDED_FROM_PRICE`). Validar que no sea negativo y no supere las ventas brutas.
- `netSalesCUP` representa los ingresos de venta tras descuentos/devoluciones y **excluyendo el impuesto sobre ventas**, de modo que el impuesto no se deduce dos veces del beneficio.
- Para `TAX_EXCLUDED_FROM_PRICE`, la base de ventas es `grossSalesCUP - discountsReturnsCUP`; el impuesto se calcula por encima del precio y se incluye en `customerTotalCUP` para informar lo que pagaría el cliente.
- Para `TAX_INCLUDED_IN_PRICE`, si todos los tributos sobre venta habilitados son `PERCENT_OF_BASE` con base `NET_SALES`, sea `rTotal` la suma de sus tasas fraccionarias; tras descuentos, `customerTotalCUP = grossSalesCUP - discountsReturnsCUP`, `netSalesCUP = customerTotalCUP / (1 + rTotal)` y cada impuesto sobre ventas es `netSalesCUP * rate`. Si hay un método/base no compatible con esta inversión, no la aproximes: marca el escenario incompleto y explica qué regla impide calcularlo.
- Si `salePriceTaxTreatment = NOT_CONFIGURED`, se puede mostrar ingreso y beneficio estimado antes de impuestos cuando sean computables, pero el escenario será `INCOMPLETE`, sin tasas ni resultado después de impuestos inventados.
- `costOfSalesCUP = calculation.unitCostCUP * projectedQuantity`. Solo se calcula si el cálculo de coste está `COMPLETE` y la unidad de venta coincide con la unidad para la que se calculó el coste.
- `profitBeforeProfitTaxCUP = netSalesCUP - costOfSalesCUP - otherOperatingExpensesCUP`. No restes otra vez el impuesto sobre ventas porque `netSalesCUP` ya excluye ese impuesto. `otherOperatingExpensesCUP` no incluye gastos que ya formen parte del coste unitario/coste de ventas.
- Para una regla `PROFIT_OR_INCOME` con base `PROFIT_BEFORE_PROFIT_TAX` y método `PERCENT_OF_BASE`, `profitTaxCUP = max(0, profitBeforeProfitTaxCUP) * rate`. Si la utilidad es negativa, el impuesto estimado sobre utilidad es cero según este supuesto gerencial, pero explica que esto no determina tratamiento fiscal legal.
- `profitAfterTaxCUP = profitBeforeProfitTaxCUP - profitTaxCUP` cuando todas las reglas necesarias estén calculadas.
- `netMarginPercent = profitAfterTaxCUP / netSalesCUP * 100` si `netSalesCUP > 0`; de otro modo es nulo y se muestra que el margen no se puede calcular.
- Guarda en `ScenarioTaxLine` el nombre/base/tasa/importe/estado de verificación usados. No alteres reglas retroactivamente.

Para reglas `PERCENT_OF_BASE` con `NET_SALES` o `PROFIT_BEFORE_PROFIT_TAX`, implementa el cálculo genérico en la medida aplicable. Si `FIXED_AMOUNT`, `PROGRESSIVE_BRACKETS`, `EXEMPTION`, `GROSS_SALES` u otra combinación no se puede soportar correctamente dentro de esta iteración, no la calcules como si fuese porcentaje: devuelve razón de incompletitud explícita. No es obligatorio habilitar estas reglas no usadas aún.

### 4.4 Precio de equilibrio y precio objetivo

Además del escenario a precio introducido, muestra:

- coste total y coste unitario de fabricación;
- ingresos netos estimados, impuesto sobre ventas estimado, coste de ventas, otros gastos adicionales;
- beneficio antes del impuesto sobre utilidad, impuesto sobre utilidad, beneficio final y margen neto;
- precio de equilibrio estimado por unidad para el volumen y supuestos seleccionados;
- campo opcional de margen neto objetivo y precio recomendado, solo si se puede calcular correctamente con las reglas activas soportadas.

El cálculo del precio objetivo debe resolverse en el servidor usando Decimal y las mismas definiciones fiscales que el escenario. Si la algebra depende de una combinación no soportada, deshabilita la recomendación y explica el motivo; no uses aproximaciones silenciosas. Muestra si el precio recomendado incluye o excluye impuesto. Los valores derivados que no tengan columna propia pueden formar parte del `calculationSnapshot` y de la respuesta API, con formato Decimal en strings.

## 5. UI Angular requerida

Mantén NG-ZORRO + Tailwind CSS, estilos y patrones del proyecto. Interfaz en español, adaptable a escritorio y móvil, sin crear un segundo menú/shell.

1. **Puestos y tarifas**: lista de puestos, crear/editar/desactivar, historial de tarifas por hora (CUP), fecha de inicio/fin y validaciones claras.
2. **Gastos indirectos**: lista filtrable por período/categoría, formulario de alta/edición con método de reparto, denominador/unidad que cambia según el método, ejemplos de qué significa la base y avisos por campos faltantes.
3. **Editor de receta**: sección de operaciones de mano de obra solo editable en borradores; mostrar puesto, minutos/lote, número de trabajadores y tarifa vigente informativa cuando pueda resolverse.
4. **Calcular costes** en la página de producto/receta: seleccionar fecha y versión publicada, ejecutar cálculo, mostrar estado completo/incompleto, motivo por cada entrada faltante, coste de materiales, laboral, gastos indirectos, total del lote y coste por unidad.
5. **Historial de costes**: listado de cálculos guardados con fecha, receta/version y estado; detalle de líneas y snapshots. No presentar datos actuales como si fueran los utilizados en un cálculo pasado.
6. **Configuración fiscal**: catálogo de plantillas fiscales disponibles y asignaciones específicas de la panadería. Solo ADMIN puede modificar asignaciones. Mostrar inequívocamente que las reglas del 10 % y 5 % están pendientes de validación normativa.
7. **Escenarios de precio/rentabilidad**: formulario para precio, volumen proyectado, tratamiento del impuesto en precio, descuentos/devoluciones y gastos adicionales; tabla/detalle con los resultados definidos arriba, precio de equilibrio y (cuando sea válido) precio para margen objetivo.
8. Asegura que todos los requests del nuevo módulo incluyen el `X-Bakery-Id` correcto mediante el interceptor actual y que éste no añada el header a rutas globales/públicas donde se excluye.
9. Usa servicios API tipados, estados de carga, confirmaciones, estados vacíos, errores legibles y deshabilita acciones no autorizadas; la autorización real se aplica siempre en backend.
10. No rellenes las pantallas con datos ficticios ni valores por defecto que aparenten ser datos del usuario.

Si el alcance visual requiere muchas vistas, agrúpalas dentro de páginas coherentes (por ejemplo `/labor`, `/overheads`, `/products/:id/costs`, `/settings/taxes`) y sigue el routing que ya utiliza el frontend.

## 6. Pruebas y criterios de aceptación

Añade pruebas unitarias para el motor de cálculo puro, servicios y escenarios. Añade/actualiza e2e de API usando los patrones existentes, y pruebas de componentes/servicios Angular. No declares que se ha probado integración real con PostgreSQL si las e2e usan mocks.

Como mínimo, prueba estos casos numéricos y de error usando datos inyectados en tests (sin escribir en la base local real):

1. Compra de 2 kg de harina por 500 CUP; una receta consume 250 g. El coste de harina calculado es 62.50 CUP.
2. Puesto con tarifa 150 CUP/hora, operación de 30 minutos y 2 trabajadores: coste laboral 150 CUP.
3. Gasto indirecto de 12 000 CUP, base prevista de 600 horas y receta con 0.5 horas-trabajador: asignación 10 CUP.
4. Un coste incompleto por precio o tarifa ausente; nunca sustituirlo por 0 ni calcular un total válido.
5. Conversión de unidades incompatibles y masa/volumen sin densidad: rechazar o marcar incompleto con motivo claro.
6. Historial: un cambio de precio/tarifa no altera cálculo/snapshot previo.
7. Aislamiento multiempresa y permisos: usuario sin membresía no ve ni calcula datos ajenos; VIEWER no puede crear tarifas, gastos, calcular ni cambiar configuración fiscal; EDITOR no puede cambiar asignaciones fiscales.
8. Precio excluido: coste de ventas 1 000 CUP, 100 unidades a 15 CUP, regla sales 10 %, profit 5 %, otros gastos 0. Resultado esperado: net sales 1 500 CUP, impuesto sobre ventas 150 CUP, beneficio antes del impuesto sobre utilidad 500 CUP, impuesto sobre utilidad 25 CUP, beneficio final 475 CUP y margen neto 31.6667 % (según precisión definida). El impuesto sobre ventas se cobra por encima del precio y no vuelve a restarse de `netSalesCUP`.
9. Precio incluido: 100 unidades a 15 CUP impuestos incluidos, tasa sobre ventas 10 %, coste de ventas 1 000 CUP, impuesto sobre utilidad 5 %. Ventas netas excluido impuesto 1 363.636... CUP, impuesto sobre ventas 136.363... CUP, beneficio antes impuesto sobre utilidad 363.636... CUP, impuesto sobre utilidad 18.1818... CUP y beneficio final 345.4545... CUP antes del redondeo monetario documentado.
10. Utilidad negativa: beneficio estimado antes del impuesto sobre utilidad negativo, sin aplicar una tasa positiva de impuesto sobre utilidad bajo el supuesto gerencial; resultado negativo claramente visible.
11. Ausencia de regla fiscal, tratamiento de precio no configurado, regla pendiente de validación, método de impuesto no soportado y base de distribución insuficiente: mensajes explícitos e incompletitud cuando corresponda.
12. Escenarios e historial inmutables: cambios futuros en receta, precio, tarifa o regla no alteran cálculos/escenarios previos.
13. Precio de equilibrio y margen objetivo: casos válidos y casos donde el precio no puede determinarse por reglas no soportadas.

Ejecuta y reporta los comandos que existan:

- backend: `npx prisma validate`, `npm run build`, `npm test`, `npm run test:e2e`, `npm run lint`;
- frontend: `npm run build`, `npm test -- --watch=false`;
- `git diff --check`.

No afirmes que ejecutaste una tarea si no la corriste. Si aparece un fallo previo no relacionado, identifícalo y no lo ocultes. El frontend no tenía necesariamente un script lint; verifica el `package.json` real antes de reportar.

## 7. Criterios para dar la iteración por terminada

La iteración solo queda completada cuando:

- los endpoints y pantallas para costes, mano de obra, gastos, configuración fiscal y escenarios están implementados;
- fórmulas y conversiones se implementan con Decimal y las pruebas numéricas requeridas pasan;
- los faltantes no se reemplazan por cero;
- las consultas, escrituras y relaciones están limitadas por panadería/rol;
- los snapshots históricos conservan los datos usados;
- el frontend compila y puede recorrer el flujo completo por API;
- la documentación explica fórmulas, métodos de reparto, límites fiscales y cómo probar manualmente.

No pares después de crear DTOs o servicios sin conectarlos a la interfaz. No implementes inventario real, compras, ventas reales, nóminas ni contabilidad general; siguen fuera del MVP.

## 8. Informe final obligatorio

Al terminar, devuelve un informe que incluya:

1. Funcionalidades terminadas por las tres áreas y lo que quedó incompleto.
2. Rutas API y páginas Angular añadidas.
3. Fórmulas implementadas y convenciones de redondeo.
4. Cómo se interpretó cada método de reparto y qué valida.
5. Cómo se configura el 10 % y el 5 % y cómo se muestra su carácter no validado.
6. Pruebas ejecutadas con recuentos y resultados exactos.
7. Archivos modificados y dependencias añadidas (si hay).
8. Riesgos restantes, especialmente cualquier limitación del esquema para exclusión concurrente de períodos o asignación de gastos.
9. Confirmación expresa de que no se modificaron esquema/migraciones/cliente ni datos locales.
