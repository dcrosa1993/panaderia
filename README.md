# Paquete inicial de arquitectura y Copilot CLI — Panadería

Este paquete NO contiene implementación de funcionalidades. Contiene instrucciones persistentes, decisiones de arquitectura y el primer prompt para delegar a Copilot CLI la infraestructura base de NestJS.

## Instalación segura

1. Haz commit del estado actual del repositorio o crea una rama, para poder revisar y revertir cambios.
2. Extrae estos archivos en la raíz de `C:\Users\denis\Documents\GitHub\panaderia` conservando la estructura de carpetas.
3. Si ya existe `AGENTS.md`, `.github/copilot-instructions.md` o alguno de los documentos, compara y combina manualmente; no sobrescribas instrucciones anteriores sin revisarlas.
4. Abre Copilot CLI desde la raíz de `panaderia`.
5. Ejecuta `/instructions` en la sesión y verifica que se descubran las instrucciones del repositorio. Si Copilot ya estaba abierto, reinicia la sesión después de agregar los archivos.
6. Abre `prompts/01-backend-foundation.md`, copia el prompt y entrégaselo a Copilot CLI.
7. Revisa `git diff` y los resultados de build/tests antes de continuar con el prompt de la siguiente fase.

El prompt 01 está acotado a infraestructura del backend. No debe modificar el esquema, las migraciones ni los datos existentes.
