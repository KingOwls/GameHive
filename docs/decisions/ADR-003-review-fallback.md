# ADR-003 — Revisión manual mientras faltan revisores independientes

Fecha: 2026-11-07. Estado: autorizado por el propietario mientras los revisores no estén disponibles.

La segunda ronda de GH-023 se interrumpió: los tres agentes devolvieron un límite de uso y ningún informe completo. No se interpreta como una revisión aprobada. Los paquetes autónomos exigidos por BMAD quedaron preparados localmente en `_bmad-output/implementation-artifacts/gh023-review-round2-*-standalone.md`; contienen copias del diff y se excluyen de Git para evitar duplicarlo.

El propietario respondió explícitamente «Autorizar revisión manual y continuar» a sustituir las rondas independientes por revisión manual del coordinador y pruebas automáticas mientras esos revisores no estén disponibles. Se conserva la primera ronda independiente de GH-023 y la resolución de sus doce hallazgos.

Se mantienen aprobación de historias, intención congelada, auditoría de tareas y matriz, pruebas ejecutadas, documentación de errores y límites de publicación. Cada entrega afectada debe identificar la sustitución; una revisión manual nunca se presenta como tres revisiones independientes. Cuando vuelvan a estar disponibles se recupera el procedimiento independiente.

Esta decisión no autoriza despliegues, cargos, cambios al repositorio de referencia ni integración en la rama principal.
