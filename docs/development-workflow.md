# Flujo de trabajo con Copilot CLI

## Procedimiento por tarea

1. Abrir Copilot CLI desde la raíz del repositorio `panaderia` para que descubra las instrucciones.
2. Para tareas grandes, usar primero `/plan` o activar Plan mode con `Shift+Tab`; revisar el plan. Para tareas acotadas, puede ejecutarse directamente con un prompt preciso.
3. Implementar una sola fase por prompt. No pedir “construye toda la aplicación”.
4. Copilot debe inspeccionar el estado real antes de editar, no asumir que este paquete describe todos los archivos presentes.
5. Revisar `git diff` tras la implementación.
6. Ejecutar verificaciones apropiadas; registrar honestamente las que fallan o no se ejecutaron.
7. No aceptar cambios de esquema, dependencias mayores, migraciones o despliegue fuera del alcance pedido.

## Comprobaciones mínimas a considerar

- Backend: `npm run build`, `npm test` y `npm run test:e2e` si esos scripts ya existen y están configurados.
- Prisma, solo cuando sea pertinente: `npx prisma validate` y `npx prisma generate`.
- Frontend en una tarea de Angular: `npm run build` o el script de build equivalente de su `package.json` y tests disponibles.

## Informe de finalización requerido

Copilot debe terminar con:

- resumen de lo implementado;
- lista de archivos modificados;
- comandos ejecutados y resultado real de cada uno;
- decisiones o limitaciones detectadas;
- cambios manuales que sean necesarios;
- confirmación explícita de que no modificó el esquema/migraciones ni datos fuera del alcance.

Nunca reportar “todo correcto” sin evidencias de build/tests. Si detecta una incompatibilidad importante, debe limitar los cambios, explicar el bloqueo y no ocultarlo con casts, desactivando TypeScript estricto ni silenciando tests.
