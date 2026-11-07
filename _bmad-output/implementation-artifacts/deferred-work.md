
- source_spec: `none`
  summary: G4 GH029: recomendaciones explicables con preferencias e interés por juegos reales.
  evidence: Elección humana2026-11-06: G4 por módulos, biblioteca/privacidad primero. Continúa dentro del alcance G4 y depende de biblioteca.

- source_spec: `none`
  summary: G4 GH030: perfiles y seguimiento exclusivo de críticos elegibles.
  evidence: Elección humana2026-11-06: entrega posterior a biblioteca; GH023 pendiente condiciona cierre del recorrido de admisión.

- source_spec: `none`
  summary: G4 GH031: ajustes completos, exportación y baja con retención definida.
  evidence: Elección humana2026-11-06: entrega posterior; requiere relaciones de biblioteca y pruebas Auth/cascadas reales.

- source_spec: `none`
  summary: G6 GH040: actualizar y revalidar herramientas de desarrollo con alertas npm.
  evidence: Auditoría2026-11-07 informa10moderadas/0altas/0críticas; audit --omit=dev informa0. Afecta cadena ESLint/typescript-eslint y BMAD/csv-parse/glob/minimatch, preexistente sin cambios de dependencias G4. Evaluar versiones compatibles, sin fix --force automático; repetir checks y auditoría. Logs privados /tmp/gamehive-g4-{dependency,production}-audit.json.
