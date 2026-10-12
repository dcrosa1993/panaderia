# Prompt 01 — Infraestructura base del backend

Copia el bloque siguiente en Copilot CLI desde la raíz del repositorio `panaderia`.

---

Lee primero `AGENTS.md`, `.github/copilot-instructions.md`, `docs/architecture-v1.md` y `docs/development-workflow.md`. Inspecciona el estado real de `backend/`: `package.json`, archivos TypeScript, configuración NestJS, `prisma/schema.prisma`, `prisma.config.ts`, cliente generado y tests. No asumas que los archivos coinciden exactamente con la documentación.

## Objetivo

Implementar solamente la base técnica del backend NestJS para que sea mantenible y pueda usar correctamente PostgreSQL mediante el Prisma Client ya generado. No implementes aún autenticación, CRUD de materiales, recetas, salarios, impuestos ni cálculos de negocio.

## Tareas

1. Asegura una integración Prisma ORM 7.10.0 correcta para PostgreSQL usando `@prisma/adapter-pg`. Implementa un `PrismaService` inyectable y un `PrismaModule` global o compartido siguiendo las convenciones existentes de NestJS. Debe existir una sola instancia de PrismaClient; cierra recursos al apagar la aplicación. Usa el import real generado bajo `src/generated/prisma`; no edites archivos generados.
2. Verifica y resuelve la compatibilidad entre el formato de módulos real de NestJS/TypeScript y Prisma 7. No cambies a ciegas toda la configuración. Haz el cambio mínimo que permita `npm run build`, el arranque de NestJS y las pruebas. Si hay un conflicto amplio o incierto, documenta el problema y detente en lugar de degradar tipos o desactivar comprobaciones.
3. Configura variables de entorno mediante el mecanismo NestJS disponible en el proyecto. Valida al menos `DATABASE_URL`, `PORT` y el origen CORS del frontend. No añadas archivos `.env` reales ni secretos al repositorio; conserva `.env` ignorado por Git. El backend local debe funcionar con la conexión actual a PostgreSQL en localhost:5433.
4. Añade prefijo global `/api/v1` sin romper el arranque actual.
5. Configura un `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true` y `transform: true`.
6. Configura CORS para permitir el origen Angular configurado. En desarrollo, permite por defecto `http://localhost:4200` solo si no hay valor de entorno; no uses `*` si se habilitan credenciales.
7. Implementa endpoints:
   - `GET /api/v1/health/liveness`: devuelve HTTP 200 si el proceso responde.
   - `GET /api/v1/health/readiness`: ejecuta una consulta real de comprobación a PostgreSQL (por ejemplo `SELECT 1`) y devuelve HTTP 200 si funciona y HTTP 503 si la consulta falla. No consideres `$connect()` por sí solo una comprobación suficiente de disponibilidad.
8. Si Swagger/OpenAPI ya está instalado o se puede añadir sin una reorganización importante, configúralo en una ruta `/api/docs`, habilitado en desarrollo y deshabilitado por defecto en producción. Evita instalar dependencias grandes o redundantes.
9. Añade pruebas unitarias o e2e útiles para health liveness/readiness, incluyendo respuesta de readiness cuando la consulta falla si es posible probarlo con mocks sin depender de una caída real de PostgreSQL.
10. Actualiza scripts solo si es necesario para que Prisma Client se genere de forma reproducible antes de compilar. No cambies versiones de Prisma, NestJS, Angular ni TypeScript sin causa demostrada.

## Restricciones críticas

- No modificar `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/`, baseline, restricciones SQL ni seed.
- No ejecutar `prisma db push`, `prisma migrate dev`, `prisma migrate deploy`, `prisma migrate reset` ni SQL destructivo.
- No borrar, truncar ni recrear tablas/datos.
- No implementar endpoints que lean o escriban tablas empresariales.
- No implementar autenticación ficticia ni confiar en un `bakeryId` del cliente.
- No añadir secretos ni mostrar `DATABASE_URL` en logs.
- Mantén la tarea acotada; no refactorices partes no relacionadas.

## Verificación obligatoria

Ejecuta las comprobaciones aplicables, al menos `npx prisma validate`, `npx prisma generate`, `npm run build` y `npm test` si existe ese script. Ejecuta e2e si está configurado y es viable. Si una prueba necesita PostgreSQL, usa la instancia local existente y no la modifiques destructivamente.

Al final, informa de resumen, archivos modificados, comandos con resultados reales, cualquier decisión sobre ESM/CommonJS, limitaciones y confirmación de que el esquema, migraciones y datos quedaron intactos. No afirmes que una comprobación pasó si no se ejecutó.
