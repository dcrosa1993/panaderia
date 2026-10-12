# Panadería — instrucciones para agentes de código

## Forma de trabajo
- Antes de cambiar archivos, inspecciona el árbol del repositorio, `package.json`, configuración TypeScript, `prisma/schema.prisma`, `prisma.config.ts` y los scripts existentes.
- Trabaja solo en la tarea indicada por el prompt actual. No implementes fases futuras ni hagas refactorizaciones ajenas al objetivo.
- Conserva las convenciones y versiones que ya estén funcionando. No actualices dependencias principales por iniciativa propia.
- No inventes reglas del negocio. Si un requisito es ambiguo y afecta al modelo o a cálculos, documenta la ambigüedad y usa el comportamiento más conservador.
- Usa `docs/architecture-v1.md` como referencia arquitectónica y `docs/development-workflow.md` como procedimiento.
- No edites código generado por Prisma. Regénéralo desde el esquema usando el CLI cuando sea necesario.
- No introduzcas secretos, contraseñas, tokens ni `.env` en el repositorio. No imprimas secretos en logs.

## Seguridad de los datos
- La aplicación es multiempresa: toda lectura y escritura de datos de negocio debe estar acotada al negocio autorizado (`bakeryId`) en el backend.
- Nunca confíes en un `bakeryId` enviado por el navegador como prueba de autorización.
- No añadas acceso a tablas empresariales sin definir autorización y pruebas de aislamiento.
- No ejecutes comandos destructivos de datos ni restablezcas PostgreSQL.
- No ejecutes `prisma db push`, `prisma migrate reset` ni migraciones no solicitadas.
- No modifiques `prisma/schema.prisma`, archivos de migración, baseline ni restricciones SQL salvo que la tarea lo autorice explícitamente.

## Calidad
- TypeScript estricto; evita `any` salvo justificación concreta.
- Valida entradas en el servidor. No confíes en validación exclusiva de Angular.
- Escribe pruebas automatizadas para comportamiento nuevo y regresiones relevantes.
- Ejecuta las comprobaciones pertinentes y comunica con exactitud qué pasó y qué no pudo ejecutarse.
- No afirmes que una prueba pasó si no la ejecutaste.
- Al finalizar, informa: resumen, archivos modificados, comandos ejecutados, resultados, decisiones/limitaciones y próximos pasos.
