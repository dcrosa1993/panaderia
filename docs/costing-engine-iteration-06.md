# Motor de costes y escenarios — Iteración 06

## Alcance implementado

El backend expone el cálculo histórico en `POST /api/v1/products/:productId/cost-calculations`, el historial del producto en `GET /api/v1/products/:productId/cost-calculations` y el detalle/snapshots en `GET /api/v1/cost-calculations/:calculationId`. Los accesos requieren autenticación, membresía activa, contexto `X-Bakery-Id` y rol; únicamente `ADMIN` y `EDITOR` pueden crear cálculos, editar puestos/tarifas/gastos y crear escenarios.

Las operaciones laborales se reemplazan de forma transaccional en versiones `DRAFT`. El editor clona las operaciones al crear un borrador desde una receta publicada. El módulo de configuración permite consultar y editar puestos, consultar/añadir tarifas, y crear/consultar/editar gastos indirectos. `OverheadExpense` no tiene campo de archivo/estado: por eso no se ofrece un borrado ni un archivado lógico que el esquema no pueda representar.

Los ajustes fiscales se sirven desde las plantillas globales existentes y las asignaciones pertenecen a la panadería. Crear, habilitar/deshabilitar y cambiar su vigencia o nota requiere `ADMIN`. Una versión pendiente puede usarse solo si el administrador la asigna y la habilita; su estado se conserva en cada línea del escenario y la respuesta incluye la advertencia visible:

> Supuesto fiscal no validado; no es una liquidación tributaria oficial.

## Precisión y conversiones

Todos los cálculos se hacen con `Prisma.Decimal`. `MeasurementUnit.conversionFactor` multiplica la cantidad para llevarla a la unidad canónica de su dimensión; después se divide por el factor de la unidad destino. Masa/volumen solo se convierten cuando el material aporta densidad positiva en g/ml. La unidad de venta del producto debe ser compatible con la unidad de salida de receta.

Los importes monetarios persistidos se redondean a dos decimales con `ROUND_HALF_UP`; los intermedios permanecen Decimal. El coste unitario se guarda con seis decimales y los derivados de precio mostrados se redondean a dos decimales. Las respuestas HTTP serializan los importes Decimal como cadenas.

Cada cálculo nuevo crea un `CostCalculation` y líneas con snapshots de precio, tarifa, factores/unidades, operación y reparto. Las versiones previas no se actualizan cuando cambian sus entradas.

## Reglas de costes

- Materiales: precio único vigente en la fecha, cantidad de receta y paquete convertidas a la unidad base, costo del paquete dividido por cantidad normalizada. Precios inexistentes o solapados, materiales/unidades inactivos y conversiones no seguras dejan el componente nulo y explican el faltante.
- Mano de obra: tarifa única vigente × minutos / 60 × cantidad de trabajadores. Una receta sin operaciones deja mano de obra nula e incompleta.
- Gastos indirectos: solo los del período que contiene la fecha. `LABOR_HOURS` distribuye por horas normalizadas a minutos; `BATCHES` divide por los lotes previstos; `OUTPUT_QUANTITY` convierte el rendimiento vendible a la unidad configurada; `DIRECT_COST_PROPORTION` usa `allocationBaseQuantity` como coste directo total previsto en CUP y exige unidad nula.
- Si no hay partidas indirectas vigentes, el cálculo queda incompleto, incluso cuando existan partidas de otros períodos. Los gastos operativos adicionales del escenario no se agregan al coste unitario; así se evita duplicar gastos indirectos ya asignados.

## Escenarios fiscales y de precio

Los escenarios se guardan vinculados a un cálculo y a su panadería. La base `NET_SALES` excluye el impuesto de ventas. Con precio excluido, la base es precio × cantidad menos descuentos/devoluciones y el impuesto se informa por encima. Con precio incluido, solo se invierte si todas las reglas de venta habilitadas son `PERCENT_OF_BASE` sobre `NET_SALES`.

La utilidad previa al impuesto sobre utilidad es ventas netas menos coste de ventas y gastos operativos adicionales. El impuesto sobre utilidad soportado es porcentaje de `PROFIT_BEFORE_PROFIT_TAX` aplicado a `max(0, utilidad)`. El esquema permite más métodos/base, pero `FIXED_AMOUNT`, `PROGRESSIVE_BRACKETS`, exenciones y bases distintas quedan explícitamente incompletos, no se aproximan como porcentajes.

`NOT_CONFIGURED` conserva la estimación de ingresos y beneficio antes de impuestos en `calculationSnapshot.preTaxRevenueEstimateCUP` y `profitBeforeProfitTaxCUP`; no escribe ventas netas, impuestos ni beneficio después de impuestos inventados. Las líneas y los importes fiscales son snapshots.

El precio de equilibrio se calcula para precio excluido o incluido bajo las reglas porcentuales soportadas. El precio de margen objetivo se resuelve de forma analítica en el servidor cuando las tasas necesarias están disponibles; fuera de esos supuestos, queda nulo con una razón.

## Límites operativos

- La creación cronológica de tarifas laborales usa una transacción serializable, verifica solapamientos y cierra el período abierto anterior al día previo. Como el esquema no contiene una restricción de exclusión de rangos, esto reduce conflictos y reporta conflictos de serialización, pero no equivale a una garantía SQL absoluta frente a cualquier escritor externo.
- La tarifa mostrada junto al puesto en el editor de recetas es informativa para la fecha actual; el cálculo siempre vuelve a resolver la tarifa histórica para su fecha de valoración.
- El formulario de selección de versión puede mostrar versiones publicadas fuera de vigencia; el servidor valida la fecha seleccionada y devuelve error explícito en vez de usarlas.
- No se modificó el esquema, las migraciones, el baseline ni el cliente generado. No se ejecutaron migraciones, seed, SQL de escritura ni operaciones destructivas sobre PostgreSQL.
