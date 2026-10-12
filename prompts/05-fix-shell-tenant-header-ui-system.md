# Iteración 05 — Corregir shell/navegación, contexto de panadería y establecer NG-ZORRO + Tailwind CSS

## Contexto del proyecto

Aplicación multiempresa de gestión de costes de panadería. Monorepo con `frontend/` (Angular) y `backend/` (NestJS), PostgreSQL y Prisma ORM 7.10. Ya existen autenticación JWT, selección de panadería, roles `ADMIN`/`EDITOR`/`VIEWER`, catálogo de materias primas con precios históricos, productos y recetas versionadas.

El acceso a endpoints con contexto empresarial requiere `X-Bakery-Id`; NestJS valida la membresía y el rol. La API tiene prefijo `/api/v1`. No se debe confiar en el encabezado como autorización por sí solo.

## Problemas reproducidos por el usuario

1. Después de iniciar sesión, el menú/nav superior aparece duplicado.
2. Al crear un producto, la API responde HTTP 400:
   `X-Bakery-Id header is required for this endpoint.`
3. El frontend debe adoptar una UI consistente y receptiva usando **NG-ZORRO** (es gratuito y MIT) y **Tailwind CSS**.

## Objetivos de esta iteración

Resolver los dos defectos de extremo a extremo y establecer el sistema de diseño en las pantallas existentes, sin añadir nuevas funcionalidades de negocio.

### A. Corregir navegación duplicada

1. Inspecciona el árbol de componentes, `app.html`/componente raíz, rutas, layouts, guards y componentes de navegación.
2. Identifica la causa raíz de la duplicación; no te limites a ocultar el menú con CSS.
3. Asegura que exista un solo shell/layout autenticado y una sola instancia de la navegación principal.
4. Las rutas públicas (login) no deben montar el shell autenticado. La selección de panadería debe tener un comportamiento intencional y consistente con las rutas actuales.
5. La navegación debe seguir funcionando al iniciar sesión, seleccionar negocio, navegar directamente a `/materials` o `/products`, refrescar, cerrar sesión y cambiar de panadería.
6. Añade pruebas de componentes/routing que demuestren que tras autenticarse se renderiza una única navegación principal y que la ruta de login no la renderiza.

### B. Corregir `X-Bakery-Id` ausente al crear un producto

1. Reproduce el flujo de selección de panadería → `/products` → crear producto y localiza por qué la petición `POST /api/v1/products` sale sin `X-Bakery-Id`.
2. Revisa el servicio de sesión/contexto de negocio, almacenamiento, interceptor HTTP, orden/registro de interceptores, guards y `api.service.ts`.
3. Corrige la causa raíz de manera centralizada para que **todas las peticiones a endpoints protegidos con ámbito de panadería** incluyan el `X-Bakery-Id` de la panadería actualmente seleccionada, incluyendo productos, versiones de recetas y materias primas/precios.
4. No envíes `X-Bakery-Id` a endpoints globales o públicos que no requieren contexto (por ejemplo, login, health y catálogo global de unidades), salvo que el contrato actual del endpoint diga expresamente lo contrario.
5. No codifiques un ID fijo ni uses un valor por defecto inventado. Si no hay una panadería seleccionada, bloquea la operación protegida y redirige a la selección de panadería o muestra un error accionable; no envíes una petición sin contexto.
6. Al cerrar sesión, invalida el contexto de negocio junto con la sesión. Al cambiar de panadería, todas las peticiones siguientes deben usar el ID nuevo y no reutilizar una cabecera obsoleta.
7. El backend debe continuar comprobando token, membresía activa, estado de la panadería y rol. Nunca aceptes `X-Bakery-Id` como prueba de autorización.
8. Mejora el manejo de errores HTTP de forma que una respuesta 400/401/403/404 muestre un mensaje útil en UI, sin filtrar detalles sensibles.
9. Añade pruebas automatizadas que demuestren:
   - `POST /api/v1/products` incorpora el encabezado con la panadería seleccionada.
   - Las rutas de detalle, versión de receta, reemplazo de ingredientes y publicación envían el contexto actual.
   - Login y las rutas globales excluidas no reciben un encabezado de negocio innecesario.
   - La petición no se ejecuta cuando no existe contexto seleccionado.
   - Después de cambiar de panadería se envía el nuevo ID, no el anterior.
   - El backend sigue denegando una panadería a la que el usuario no pertenece.

### C. Integrar NG-ZORRO

NG-ZORRO es una biblioteca gratuita de código abierto con licencia MIT. Utilízala como biblioteca principal de componentes de interfaz.

1. Inspecciona primero `frontend/package.json`, el major exacto de Angular, las versiones de Node/TypeScript y el setup de estilos.
2. Instala una versión de `ng-zorro-antd` compatible con el major ya instalado de Angular. La documentación del proyecto indica que NG-ZORRO sigue el mismo major de Angular.
3. **No actualices Angular de major** para instalar la biblioteca.
4. Si no existe una versión compatible o la integración no es viable sin una actualización mayor, documenta la incompatibilidad y utiliza Angular Material como alternativa. No instales ambas bibliotecas como solución por defecto.
5. Usa componentes NG-ZORRO apropiados donde aporte valor: `nz-layout`, `nz-menu`, `nz-form`, `nz-input`, `nz-select`, `nz-button`, `nz-table`, `nz-pagination`, `nz-alert`, `nz-message`/notificaciones y `nz-popconfirm`/modal cuando proceda. Usa solo los módulos/componentes necesarios y sigue el patrón standalone ya adoptado.
6. Configura idioma español si está soportado en la versión compatible, y define un tema coherente. Mantén etiquetas y mensajes de la aplicación en español.
7. No reemplaces controles sin criterio: prioriza el shell, login, selector de panadería, materias primas/precios, productos y editor de recetas.

### D. Integrar Tailwind CSS

1. Sigue la guía oficial vigente de Tailwind CSS para Angular y el builder de Angular ya instalado. La guía oficial v4 configura `@tailwindcss/postcss`, PostCSS y `@import "tailwindcss"`.
2. Instala versiones compatibles sin `--force` como primera solución. Si npm reporta conflictos de peer dependencies, investiga sus causas y elige versiones compatibles; no ocultes el problema con `--force`.
3. Configura Tailwind para funcionar con los estilos globales existentes (SCSS/CSS), sin dejar el build roto ni borrar estilos necesarios de NG-ZORRO.
4. Utiliza Tailwind para estructura, distribución, spacing, responsive design y estados sencillos. NG-ZORRO debe encargarse de los componentes interactivos complejos. Evita implementar dos sistemas de botones/forms/tablas distintos o duplicar estilos globales.
5. Refactoriza las pantallas existentes cubiertas por esta iteración para que compartan un lenguaje visual coherente, con espacio suficiente, estados de carga/vacío/error, validación de formularios y buen comportamiento en escritorio y móvil.
6. Verifica que Tailwind Preflight no rompa el estilo de los componentes NG-ZORRO; ajusta el orden y configuración de estilos documentadamente.

## Alcance de UI

Aplica el sistema visual y el shell corregido a:
- Login.
- Selección/cambio de panadería.
- Navegación principal y layout autenticado.
- Lista, formulario y detalles de materias primas, incluido historial de precios.
- Lista/formulario/detalle de productos y editor/historial de recetas.

No implementes motor de costes, impuestos, salarios o nuevas tablas de negocio en esta iteración.

## Restricciones críticas

- No modificar `schema.prisma`, `prisma.config.ts`, migraciones, baseline ni cliente generado.
- No ejecutar seeds, bootstrap, migraciones ni comandos que escriban en PostgreSQL.
- No modificar `.env` ni imprimir secretos.
- No crear usuarios ni datos de negocio.
- No añadir IDs hardcodeados, datos ficticios o mocks de UI como sustituto de la API real.
- No hacer un rediseño total fuera del alcance descrito.
- No desactivar verificaciones de seguridad, lint ni TypeScript para lograr un build exitoso.
- No ejecutar `npm audit fix` ni actualizar majors de dependencias sin aprobación.
- Conserva ESM/NodeNext y las convenciones actuales del repositorio.

## Verificación obligatoria

Ejecuta las verificaciones disponibles de ambos proyectos y comunica sus resultados reales:

### Backend
- `npm run build`
- `npm test`
- `npm run test:e2e`
- `npm run lint`
- `npx prisma validate` (solo validación; no `generate` ni migraciones salvo aprobación explícita)

### Frontend
- `npm run build`
- `npm test -- --watch=false`
- Ejecuta lint solo si existe un script configurado. Si no, indícalo y no inventes el resultado.

Además:
- `git diff --check`
- Añade pruebas de interceptor/contexto y del shell/nav duplicado.
- Comprueba que el build funciona con Tailwind y NG-ZORRO activos.
- Si puedes ejecutar pruebas de navegador disponibles en el repo, verifica visualmente el flujo login → selección de negocio → `/products` → crear producto y confirma en la petición que se envía `X-Bakery-Id`.
- No afirmes que se probó contra PostgreSQL real si las pruebas usan mocks.

## Criterios de aceptación

1. Después de login se ve una única navegación principal.
2. Login no muestra el shell autenticado.
3. Con una panadería seleccionada, crear un producto ya no devuelve el error por ausencia de `X-Bakery-Id`.
4. Todas las operaciones empresariales usan el contexto actualmente seleccionado; los endpoints globales/publicos siguen funcionando sin ese encabezado si no lo requieren.
5. Cambiar o cerrar sesión no deja un contexto obsoleto.
6. El backend continúa realizando autorización multiempresa.
7. NG-ZORRO es la única biblioteca de componentes UI principal instalada, salvo que la compatibilidad obligue documentadamente al fallback Material.
8. Tailwind CSS está instalado y se utiliza de forma real en las pantallas de alcance, no solo añadido al package.json.
9. Todas las verificaciones se informan con resultados concretos, sin ocultar fallos.
10. No se cambiaron esquema, migraciones ni datos de PostgreSQL.

## Entrega final de Copilot

Al finalizar, entrega:
- Causa raíz de ambos bugs y cómo se corrigieron.
- Versiones instaladas de NG-ZORRO/Tailwind y cualquier decisión de compatibilidad.
- Archivos modificados.
- Pruebas ejecutadas y resultados.
- Pasos manuales para comprobar el flujo.
- Problemas pendientes conocidos.
