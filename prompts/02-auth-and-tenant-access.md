# Copilot CLI — Fase 02: Autenticación y contexto multiempresa

## Objetivo

Implementa la base de autenticación y autorización multiempresa del backend NestJS existente. Esta fase prepara el acceso seguro necesario antes de exponer el catálogo de materias primas y cualquier otra información de una panadería.

Trabaja dentro de la arquitectura y las convenciones existentes. No implementes todavía el catálogo de materias primas, recetas ni cálculos económicos.

## Antes de modificar código

1. Lee `AGENTS.md`, `.github/copilot-instructions.md` y la documentación existente en `docs/`.
2. Inspecciona `prisma/schema.prisma`, `prisma.config.ts`, `src/main.ts`, `src/app.module.ts`, la configuración de entorno, `PrismaService`, los módulos de health, las pruebas y los scripts de `package.json`.
3. Confirma cómo se llaman exactamente los campos y enums de `User`, `Bakery` y `Membership`; no asumas nombres que no existan.
4. Conserva ESM/NodeNext, Prisma ORM 7.10, el cliente generado en `src/generated/prisma`, el adaptador `@prisma/adapter-pg`, la instancia única de `PrismaClient`, el prefijo `/api/v1` y las convenciones de pruebas/lint actuales.
5. Antes de codificar, presenta un plan breve. Después impleméntalo en esta tarea sin pedir confirmación para decisiones ordinarias, salvo que encuentres un bloqueo real en el esquema.

## Alcance funcional

### Autenticación

- Implementa `POST /api/v1/auth/login` con email y contraseña.
- Implementa `GET /api/v1/auth/me` para devolver la identidad autenticada y datos mínimos de la cuenta.
- Usa un hash de contraseña seguro (preferiblemente Argon2id o una biblioteca mantenida equivalente compatible con la versión de Node instalada). Nunca almacenes ni registres contraseñas en texto claro.
- Emite un token de acceso JWT Bearer de corta duración. La clave debe proceder de `JWT_SECRET`; no uses una clave secreta fija en el código. Valida las variables de entorno al arrancar y no permitas valores inseguros por defecto en producción.
- Para credenciales incorrectas, cuenta inexistente o cuenta inactiva, devuelve una respuesta de error genérica que no permita enumerar usuarios.
- No implementes registro público, recuperación de contraseña ni refresh tokens en esta fase.

### Negocios accesibles

- Implementa `GET /api/v1/bakeries` para listar únicamente las panaderías a las que pertenece el usuario autenticado mediante una membresía activa. Devuelve solo los campos mínimos necesarios para la interfaz.
- No permitas a un usuario enumerar negocios de otros usuarios.
- Añade un mecanismo de bootstrap local/administrativo para crear el primer usuario administrador y su primera panadería, dado que no habrá registro público. Debe ejecutarse como script explícito, usar variables de entorno dedicadas (por ejemplo, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME` y `BOOTSTRAP_BAKERY_NAME`), no imprimir secretos, y fallar de forma segura si hay conflicto con una cuenta existente. No debe ejecutarse automáticamente al arrancar NestJS. Si el proyecto ya tiene un mecanismo de bootstrap adecuado, reutilízalo en vez de duplicarlo.

### Contexto y autorización multiempresa

- Implementa guardias/decoradores reutilizables para autenticación, contexto del negocio activo y roles, basándote en los roles y estados reales definidos en Prisma.
- Para futuras rutas con ámbito de panadería, acepta un identificador de negocio explícito (preferiblemente el encabezado `X-Bakery-Id`) y comprueba en el backend que el usuario autenticado tiene una membresía activa para ese negocio. Nunca confíes en el ID enviado por el cliente sin comprobar la membresía.
- Proporciona una abstracción reutilizable, como `@CurrentUser()` y `@CurrentBakeryId()`, para que los futuros controladores no extraigan manualmente estos datos de la petición.
- Define la semántica de errores: `401` sin autenticación o token válido; `400` para un identificador de negocio mal formado; `403` cuando el usuario no tiene acceso; y un error claro cuando una ruta que requiere contexto no recibe `X-Bakery-Id`.
- Implementa la infraestructura de roles para los roles existentes (por ejemplo, administrador, editor y consulta, si esos son exactamente los valores del esquema). La consulta no puede modificar datos; los permisos administrativos no se deben conceder globalmente a un usuario por pertenecer a otra panadería.
- Mantén los endpoints de liveness/readiness públicos y con el comportamiento actual. No exijas `X-Bakery-Id` a endpoints globales de autenticación o salud.

## Seguridad y restricciones

- No modifiques `schema.prisma` en esta tarea salvo que sea estrictamente imprescindible. Si lo es, detente antes de introducir una migración y explica qué campo o restricción falta y por qué; no ejecutes migraciones.
- No ejecutes `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, SQL destructivo ni comandos que alteren la base de datos. No cambies ni elimines tablas, datos, historial de migraciones ni el baseline ya registrado.
- No edites `.env` local ni reveles sus valores. Actualiza `.env.example` con nombres de variables y valores de ejemplo no secretos.
- No añadas credenciales por defecto ni secretos reales a archivos versionados.
- Conserva el CORS existente y no habilites orígenes arbitrarios.
- No añadas Swagger ni otras dependencias opcionales que no sean necesarias para esta tarea.
- No hagas `npm audit fix` automáticamente. Si agregas dependencias, explica cuáles y por qué; registra los advisories relevantes que descubras, sin actualizar paquetes ajenos al alcance.

## Pruebas requeridas

Añade pruebas unitarias y e2e según los patrones existentes para comprobar al menos:

1. Login válido emite un token que puede verificarse.
2. Contraseña incorrecta y cuenta inactiva no permiten autenticación y no revelan si el usuario existe.
3. `GET /auth/me` rechaza tokens ausentes o inválidos.
4. `GET /bakeries` solo lista membresías activas del usuario autenticado.
5. Un usuario no puede seleccionar una panadería de la que no es miembro, aunque manipule `X-Bakery-Id`.
6. Una membresía inactiva no concede acceso.
7. Las decisiones de autorización por rol se prueban con los roles realmente definidos en el esquema.
8. Los endpoints health actuales siguen siendo accesibles y sus pruebas existentes continúan pasando.
9. El script de bootstrap no sobrescribe silenciosamente una cuenta existente y no imprime la contraseña.

Usa mocks/fakes para que las pruebas unitarias sean deterministas. Las pruebas e2e deben seguir la configuración del repositorio y no destruir ni restablecer la base de datos de desarrollo.

## Verificaciones finales

Ejecuta y corrige los fallos que puedas resolver dentro del alcance:

- `npx prisma validate`
- `npx prisma generate`
- `npm run build`
- `npm test`
- `npm run test:e2e`
- `npm run lint`
- `git diff --check`

No marques como pasada una verificación que no hayas ejecutado. Si una prueba necesita configuración/servicio ausente, reporta claramente el bloqueo.

## Criterios de aceptación

- No hay endpoints de negocio que confíen en un `bakeryId` del cliente sin validar la membresía.
- La autenticación y autorización se encuentran en componentes reutilizables, no duplicadas manualmente en controladores.
- Ninguna tabla o migración ha sido modificada ni aplicada.
- Los endpoints de salud mantienen su comportamiento actual.
- Las verificaciones se han ejecutado y el resultado está documentado.

## Informe final

Al terminar, resume:

1. Archivos creados/modificados.
2. Rutas implementadas y esquema de autenticación.
3. Variables de entorno nuevas y cómo ejecutar el bootstrap sin mostrar secretos.
4. Dependencias añadidas.
5. Resultados exactos de las verificaciones.
6. Limitaciones, riesgos o decisiones pendientes.
7. Confirmación explícita de si el esquema Prisma, las migraciones y los datos permanecieron intactos.

No implementes materias primas en esta tarea. Ese será el siguiente prompt después de revisar esta fase.
