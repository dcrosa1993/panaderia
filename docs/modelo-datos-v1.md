# Panadería — modelo de datos propuesto (v1)

Estado: borrador para revisión. No se han aplicado migraciones.

## Decisiones que recoge

- Aplicación multiempresa: todas las entidades de negocio tienen `bakeryId` y las relaciones entre entidades de negocio usan claves foráneas compuestas donde corresponde.
- Moneda funcional inicial: CUP. Los campos monetarios tienen nombres terminados en `CUP` y usan `NUMERIC`/Prisma `Decimal`.
- Precios, tarifas, perfiles fiscales y recetas conservan versiones o registros históricos.
- Mano de obra: cada puesto tiene un historial de tarifas por hora; cada operación de receta declara minutos por lote y cantidad de trabajadores.
- Los resultados guardan una instantánea de entradas; no deben reconstruirse leyendo únicamente los valores actuales.
- Las dos tasas iniciales (10 % sobre ventas netas y 5 % sobre utilidad estimada) son **supuestos de simulación pendientes de validación normativa**. El seed crea sus plantillas con `PENDING_VALIDATION`, sin fechas legales de vigencia y sin asignarlas a ninguna panadería. Al crear una panadería TCP, la aplicación podrá asignarlas para simulaciones; el resultado siempre debe llevar una advertencia visible hasta que se valide la normativa.
- No incluye inventario real, compras completas, ventas reales, caja ni nóminas.

## Relaciones principales

- `User` ↔ `Bakery` mediante `Membership`.
- `Bakery` → materiales y `MaterialPrice` históricos.
- `Bakery` → productos → `RecipeVersion` → líneas de material y operaciones laborales.
- `LaborRole` → `LaborRate` histórico por hora.
- `OverheadExpense` registra un gasto del período y su método/base de distribución.
- `TaxRule` → `TaxRuleVersion` globales; `BakeryTaxRule` asigna una versión a un negocio.
- `CostCalculation` conserva el coste calculado; `CalculationLine` conserva el desglose.
- `PriceScenario` conserva las hipótesis y los resultados; `ScenarioTaxLine` conserva el detalle fiscal y el estado de validación aplicado.

## Reglas que la aplicación y las migraciones deben imponer

1. Validar permisos de membresía en cada solicitud de API; no confiar en un `bakeryId` enviado por el cliente.
2. Comprobar que unidades de una conversión pertenecen a dimensiones compatibles. La densidad solo permite conversiones masa/volumen cuando esté definida y validada para ese material.
3. Validar que los períodos tengan `validTo > validFrom` y que las tarifas/precios/versiones no tengan períodos solapados cuando sean excluyentes.
4. En versiones publicadas, comprobar que exista una sola receta efectiva para un producto y fecha.
5. Las reglas con `PENDING_VALIDATION` pueden participar en escenarios de estimación solo si fueron asignadas expresamente al negocio; el escenario debe marcarse como supuesto no validado y no presentarse como liquidación fiscal oficial.
6. No sustituir un coste, precio, tasa o tarifa ausente por cero. Marcar el cálculo como incompleto.
7. Usar aritmética decimal y una política única de redondeo documentada.
8. Mantener los registros históricos referenciados por cálculos; preferir archivado a borrado.

## Detalles que requieren una migración SQL adicional

`backend/prisma/constraints-to-merge.sql` contiene un borrador de restricciones temporales de exclusión y restricciones `CHECK` para combinar con la migración inicial de Prisma. Debe revisarse, probarse en una base de desarrollo y luego incorporarse al historial de migraciones. No ejecutarlo como SQL ad hoc en producción. Las reglas de aplicación también deben comprobar coherencia de unidades, perfiles fiscales y estado de validación.

## Impuesto estimado sobre utilidad

La hipótesis del MVP toma como base la utilidad estimada antes de este impuesto y después de descontar el impuesto estimado sobre ventas, el coste de ventas y otros gastos considerados en el escenario. Esta fórmula es únicamente de simulación hasta validar legalmente la base imponible y deducciones aplicables. Las reglas pendientes pueden activarse como supuestos para cálculos gerenciales, pero la interfaz debe identificar claramente su estado no verificado.

## Preguntas que quedan deliberadamente para el diseño del motor

- Si el precio introducido incluye el impuesto sobre ventas o si el impuesto se añade al precio.
- Qué categorías de gastos son deducibles para cada estimación y cómo evitar doble contabilización.
- La normativa y vigencia exactas de las reglas fiscales TCP, antes de activar cualquier regla.
- Los criterios y denominadores disponibles para cada distribución de gastos indirectos.
