# Iteración 07 — Unificación visual, formularios modales y diagnóstico de la API

## Contexto del proyecto

Estamos desarrollando una aplicación web para administrar una panadería y calcular sus costes y rentabilidad.

- **Frontend:** Angular, NG-ZORRO y Tailwind CSS.
- **Backend:** NestJS.
- **Base de datos:** PostgreSQL.
- **ORM:** Prisma 7.10.
- **API:** `https://panaderia-api.may.cu/api/v1`
- **Frontend:** `https://panaderia.may.cu`

La aplicación utiliza autenticación JWT y permite administrar panaderías independientes. Algunas operaciones requieren la cabecera `X-Bakery-Id` para identificar la panadería seleccionada.

La iteración anterior implementó el motor de costes históricos, los puestos y tarifas laborales, los gastos indirectos y los escenarios de precios e impuestos. Esos flujos deben conservarse y seguir funcionando.

La base de datos ya está resuelta. No reabras ese problema ni introduzcas cambios de esquema o migraciones salvo que una necesidad demostrada los haga imprescindibles.

## Objetivos de esta iteración

### 1. Estandarizar el diseño visual de la aplicación

Revisa las pantallas existentes y establece un lenguaje visual consistente que utilice los colores corporativos actuales: **azul y verde**.

Antes de modificar los estilos, inspecciona los estilos globales, los tokens CSS, los componentes compartidos y las convenciones visuales que ya existen. Reutiliza los recursos disponibles y evita crear varios sistemas de estilos paralelos.

Unifica, como mínimo:

- Campos de texto, `select`, `nz-select`, controles numéricos, fechas y demás elementos de formulario.
- Altura, ancho, padding, tipografía, bordes, radios y estados de foco.
- Etiquetas, placeholders, mensajes de ayuda y validaciones.
- Botones primarios, secundarios, de cancelar y de acciones destructivas.
- Títulos, subtítulos, márgenes, espaciado y disposición de los formularios.
- Tablas, filtros, estados de carga, mensajes de error y estados vacíos.
- Presentación de tarjetas, indicadores económicos y bloques de información, cuando corresponda.

Los selectores deben verse como parte de la misma familia de componentes que los campos de texto normales, no como controles de otra aplicación. Comprueba tanto el estado cerrado como el desplegable, las opciones seleccionadas, los controles deshabilitados y los mensajes de validación.

Utiliza el azul como color principal de interacción y el verde como color complementario, manteniendo contraste suficiente y diferenciando correctamente los estados de éxito, error, advertencia y deshabilitado.

No introduzcas nuevos colores arbitrariamente ni agregues una biblioteca de componentes adicional sin justificarlo.

### 2. Utilizar modales para los formularios de creación

Modifica los flujos de creación para que los formularios de alta de productos, ingredientes/materiales y costes se abran en modales, en lugar de ocupar directamente el contenido principal de la página.

Inspecciona las pantallas existentes para identificar todos los flujos pertinentes, incluidos los gastos indirectos y los puestos o tarifas laborales cuando su patrón de creación sea equivalente.

Requisitos:

- Mantener la lista o vista principal visible detrás del modal.
- Abrir el modal desde un botón de acción claramente identificado, por ejemplo, «Agregar producto».
- Usar componentes `nz-modal` existentes, si están disponibles en el proyecto.
- Aplicar al modal el mismo sistema visual que al resto de la aplicación.
- Mostrar un título descriptivo, el formulario, las acciones y los errores de validación.
- Validar los campos antes de enviar la petición.
- Mostrar un estado de carga y evitar envíos duplicados.
- Mostrar errores de la API de forma comprensible sin perder los datos que el usuario ya introdujo.
- Cerrar el modal solamente cuando la operación haya terminado correctamente o el usuario cancele.
- Después de crear el registro, actualizar la lista y reflejar el nuevo dato sin exigir una recarga completa de la aplicación.
- Confirmar antes de descartar un formulario modificado cuando resulte necesario.
- Garantizar que los modales funcionan correctamente en pantallas estrechas.

No dupliques innecesariamente la lógica de los formularios ni la comunicación con el backend. Reutiliza los componentes y servicios actuales cuando sea razonable.

Revisa también los flujos de edición. Si su presentación actual resulta inconsistente, adapta su interfaz de forma coherente sin cambiar las reglas de negocio ni los contratos de la API.

### 3. Diagnosticar y corregir los problemas de los endpoints

Actualmente se observan problemas al acceder a estos endpoints:

- `GET /api/v1/labor-roles`
- `GET /api/v1/overhead-expenses`
- `GET /api/v1/tax-settings/rules`
- `GET /api/v1/measurement-units`
- `GET /api/v1/tax-settings/assignments`

Los dos primeros devuelven este error cuando la petición no aporta la cabecera requerida:

```json
{
  "message": "X-Bakery-Id header is required for this endpoint.",
  "error": "Bad Request",
  "statusCode": 400
}
```

Para los tres últimos se ha observado que, al abrir las URL directamente en el navegador, no se obtiene una respuesta HTTP visible. Todavía no se ha determinado la causa exacta.

#### 3.1. Inspección del backend

Localiza y revisa:

- Los controladores, servicios, DTO y guards de los cinco endpoints.
- La configuración del prefijo global `/api/v1`.
- El registro de controladores y módulos en `app.module.ts`.
- Los guards de JWT, la gestión del contexto de panadería y los interceptores o filtros de excepciones.
- Las rutas, los métodos HTTP y las consultas Prisma utilizadas por cada endpoint.
- La correspondencia entre los endpoints y los métodos de `api.service.ts` o los servicios frontend equivalentes.

Determina primero si las rutas existen, están registradas y utilizan el método HTTP esperado. No inventes rutas nuevas antes de comprobar las existentes.

Para cada endpoint, establece expresamente si es global o si pertenece a una panadería concreta. No apliques la misma exigencia de `X-Bakery-Id` a todos los endpoints sin comprobar su modelo de datos y sus reglas de negocio.

#### 3.2. Inspección del frontend y las cabeceras

Revisa el interceptor HTTP que adjunta `X-Bakery-Id` y el mecanismo que determina la panadería activa.

Comprueba si la cabecera se añade actualmente solo a determinadas rutas, por ejemplo, materiales y productos, dejando fuera otras rutas que también necesitan contexto de panadería.

Corrige la causa de manera centralizada y mantenible para que todas las peticiones que realmente requieren contexto de panadería lo reciban.

No añadas la cabecera indiscriminadamente a todas las peticiones. No la inventes cuando no exista una panadería seleccionada. Respeta los endpoints públicos, los de autenticación y los endpoints globales según las reglas del proyecto.

Asegúrate de que el frontend envía correctamente el JWT y que la selección de panadería está disponible cuando se consulta la economía, los puestos laborales, los gastos indirectos y las asignaciones fiscales.

#### 3.3. Investigar los endpoints sin respuesta

No interpretes automáticamente la ausencia de respuesta visible como un error 404 ni des por hecho que los endpoints están ausentes.

Usa las herramientas disponibles para reproducir las peticiones y determinar si se trata de:

- Una ruta inexistente o un método HTTP incorrecto.
- Un problema de autenticación o de cabeceras.
- Un controlador o módulo que no está registrado.
- Una excepción no controlada en NestJS.
- Una consulta Prisma que falla o no termina.
- Un problema de proxy, red, DNS o TLS.
- Un tiempo de espera agotado o una conexión que se cierra sin respuesta.

Examina los registros pertinentes de la aplicación y del proxy, cuando estén disponibles. Distingue entre un error generado por NestJS y un error de infraestructura.

Prueba las rutas con peticiones HTTP controladas. Para los endpoints protegidos, utiliza un JWT válido y añade `X-Bakery-Id` únicamente cuando corresponda. No publiques tokens, contraseñas ni secretos en los registros o en la documentación.

En particular, verifica que:

- Los endpoints registrados devuelvan una respuesta HTTP y terminen la petición.
- Los errores esperados se traduzcan en códigos HTTP apropiados.
- Una petición sin autenticación a una ruta protegida devuelva el error de autenticación correspondiente.
- Una petición sin `X-Bakery-Id` a un endpoint que realmente lo requiera devuelva un error controlado.
- Los errores internos no queden ocultos ni se conviertan en peticiones indefinidamente pendientes.

Si no tienes acceso al entorno desplegado, realiza las pruebas automatizadas que permitan comprobar el comportamiento y especifica qué comprobaciones requieren ejecutar peticiones contra el servidor real.

### 4. Corregir las causas y añadir pruebas

Tras identificar la causa de cada problema, implementa la corrección correspondiente.

Añade o adapta pruebas para comprobar:

- El registro y funcionamiento de las cinco rutas.
- La autenticación y autorización de cada endpoint.
- La exigencia de `X-Bakery-Id` en las rutas que realmente lo necesitan.
- El comportamiento correcto del interceptor HTTP.
- La obtención de datos usando la panadería activa.
- El tratamiento de errores HTTP y excepciones.
- Los principales flujos de creación mediante modales.
- La validación de formularios y la actualización de las listas después de una creación correcta.

Evita limitarte a modificar los mensajes de error, desactivar guards o eliminar requisitos de autenticación para que las peticiones dejen de fallar.

## Restricciones y compatibilidad

- Conserva el comportamiento del motor de costes implementado en la iteración anterior.
- No cambies las reglas de cálculo de costes, tarifas, impuestos ni rentabilidad como parte de esta tarea visual.
- No cambies los contratos de la API sin una razón técnica demostrada.
- No realices cambios de esquema Prisma, migraciones, seeds ni escrituras de negocio innecesarias.
- No hardcodees credenciales ni identidades de panadería.
- Mantén la arquitectura y las convenciones actuales de Angular y NestJS.
- No introduzcas dependencias nuevas cuando los componentes existentes sean suficientes.
- Evita refactorizaciones ajenas a los objetivos de esta iteración.
- No des por solucionado ningún problema basándote únicamente en que el frontend compile.

## Verificaciones obligatorias

Al finalizar, ejecuta las verificaciones pertinentes y disponibles:

**Backend**
- Pruebas unitarias.
- Pruebas e2e.
- Build de producción.
- Lint.
- Validación del esquema Prisma, si los cambios realizados lo justifican.

**Frontend**
- Build de producción.
- Pruebas automatizadas.
- Lint, si está configurado.

Ejecuta `git diff --check` y revisa el diff completo para detectar cambios accidentales.

No ocultes advertencias importantes de compilación ni afirmes que las rutas se han validado en producción si no se han probado contra el servidor desplegado.

## Informe final requerido

Al terminar, presenta un resumen con:

1. Los archivos principales modificados.
2. Los componentes visuales y formularios que ahora utilizan modales.
3. Las mejoras de estandarización visual realizadas.
4. La causa raíz identificada para cada uno de los cinco endpoints.
5. Las correcciones aplicadas en el backend y el frontend.
6. Las pruebas ejecutadas y sus resultados.
7. Las verificaciones que no pudieron realizarse y el motivo.
8. Cualquier problema pendiente que requiera intervención en el VPS o en la configuración de despliegue.

Prioriza primero la identificación y corrección de las causas de los problemas de API y después la mejora de la interfaz. Conserva las funcionalidades existentes y no declares completada una corrección que no haya sido verificada.