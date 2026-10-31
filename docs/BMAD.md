# BMAD verificado

BMAD Method 6.12.4 (MIT) instalado desde npm, versión stable/latest comprobada el 2026-10-31. La documentación oficial distingue v6.12 estable y v7 preview: https://docs.bmad-method.org/start/install-bmad/.

Comandos realmente consultados: `bmad-method --help`, `install --help`, `install --list-tools`, `install --list-options bmm`. El ID real de Codex es `codex`; directorio `.agents/skills`.

Instalación ejecutada:

```bash
node_modules/.bin/bmad-method install --directory . --modules bmm --tools codex --user-name KingOwls --communication-language Spanish --document-output-language Spanish --output-folder _bmad-output --yes
node_modules/.bin/bmad-method status
```

Resultado: core y bmm 6.12.4, 29 skills instaladas. No se afirma que esas skills sean procesos autónomos activos. Roles de producto/UX/backend/QA son responsabilidades lógicas. La revisión de G0 utilizó un subagente de solo lectura conforme al paso de investigación del flujo instalado.

El instalador anunció erróneamente ausencia de Python/uv, aunque ambos estaban en PATH y `uv run --no-cache` ejecutó el renderizador con éxito. El config generado conservó idioma/nombre por defecto en dos campos; se corrigió mediante `_bmad/custom/config.toml` (override soportado) y se verificó con el resolver real. `--no-cache` evita escrituras a la caché de usuario restringida.

Se ejecutó el renderizador `bmad-build`, se leyeron su workflow, pasos de routing/plan y plantilla. Próximo artefacto: historia G1 en `_bmad-output/implementation-artifacts/spec-gh-007-identidad-segura.md`. El flujo contempla un checkpoint humano antes de implementar esa historia; no se declara ejecutado el flujo build/review completo por tener archivos instalados.

Contexto: requisitos del paquete → decisiones y mini-plan G0 → código y pruebas → revisión independiente → correcciones/retest → PROGRESS. G1–G6 mantienen dependencias y evidencias, sin saltar controles de seguridad.

Para continuar: abrir Codex en la carpeta GameHive y utilizar la skill real `bmad-build` con la historia concreta. Mantener `AGENTS.md` suministrado; no reemplazarlo con instrucciones genéricas del instalador.

Checkpoint pendiente de G1: la skill instalada `bmad-build/SKILL.md` remite al workflow y al paso `step-02-plan.md`, que exige «HALT and give the user a choice» con «Approve and continue» antes de implementar la especificación. La historia está escrita y revisable. Este checkpoint no invalida la evidencia G0 ni requiere repetir autorización para subir a GitHub.
