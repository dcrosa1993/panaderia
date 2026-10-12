# Instrucciones permanentes de GitHub Copilot CLI

Este repositorio implementa una aplicación web de cálculo de costes y rentabilidad para panaderías independientes. Antes de actuar, lee `@AGENTS.md`, `@docs/architecture-v1.md` y `@docs/development-workflow.md`.

La tarea del prompt actual define el alcance autorizado. No implementes otras fases por anticipado. La persona responsable del proyecto diseña las reglas de negocio y revisa los cambios; tú eres responsable de implementar el alcance, añadir pruebas, ejecutar verificaciones y reportar fielmente los resultados.

El esquema Prisma existente y las tablas existentes de PostgreSQL ya han sido validados y alineados con una migración baseline. No vuelvas a crear tablas, no hagas reset, no uses `db push` y no cambies el esquema ni el historial de migraciones salvo instrucción explícita.

Prioriza seguridad multiempresa, precisión decimal y trazabilidad. Los cálculos de dinero no deben utilizar aritmética binaria `number` como fuente de verdad. No infieras reglas fiscales ni legales: usa únicamente las reglas de producto documentadas.
