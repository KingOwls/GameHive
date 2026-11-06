# Demo funcional local — avance G0–G3

Actualizado: 2026-11-02, America/Bogota. Producto completo P0 todavía pendiente. Esta guía describe la funcionalidad implementada; el cierre verificable de cada historia está en [PROGRESS](PROGRESS.md) y sus informes QA.

La demo mantenida por Codex se abre en [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Es local a este equipo. El build estable actual incluye GH-022 verificado, commit e001062; no confundirlo con un despliegue Vercel. G1/G2 remotos están documentados aparte; G3 no se ha publicado en Supabase remoto.

## Recorrido de jugador

1. Explorar un juego real, por ejemplo Hollow Knight. Comprobar atribución RAWG, metadatos, ficha completa, imágenes y requisitos cuando existan. Los filtros de puntuación propia dependen de GH-026; todavía no hay agregados GameHive.
2. Registrarse con alias único de3–24 letras/números/guion bajo y contraseña de al menos12 caracteres. La cuenta creada es `user`; completar las preferencias del onboarding. Usar datos de demostración no sensibles y no compartir la contraseña.
3. En una ficha RAWG persistida o manual, publicar título y opinión sin spoilers, nota0–10 y, opcionalmente, pros/contras y spoilers. Una sola identidad de reseña por autor+juego. Los spoilers permanecen cerrados hasta pulsar su control.
4. Editar la nota junto a una opinión pública realmente distinta. Retirar y republicar conserva la misma reseña. Recargar o abrir otra sesión confirma persistencia real.
5. Para probar un conflicto, abrir la misma reseña en dos sesiones del navegador, guardar en una y luego intentar guardar un borrador distinto en la otra. Debe conservarse el borrador; cargar la versión guardada es una acción explícita que lo descarta.
6. Cambiar Sistema/Claro/Oscuro, recargar y comprobar persistencia. Navegar con teclado y salto al contenido. La vitrina muestra ejemplos de estados, identificados como ejemplos.

## Recorrido de crítico

Requiere una cuenta con rol `critic` concedido mediante un operador autorizado; registrarse o alterar metadata nunca concede ese rol. No se incluyen usuarios/contraseñas predefinidos ni se ofrece aún la solicitud administrativa GH-023.

En una ficha real, preparar un análisis crítico completo o convertir explícitamente una reseña propia ordinaria. Completar los ocho criterios con nota/explicación, plataforma real, horas jugadas, finalización, transparencia sobre copia facilitada, justificación y preguntas editoriales. El servidor calcula la media simple; la nota orientativa no tiene autoridad. La conversión conserva ID y estado de publicación/retirada.

Las explicaciones y respuestas son públicas sin spoilers; las revelaciones van en la sección protegida existente. Otro visitante ve los criterios, contexto y verificación real. Rol crítico y distintivo verificado son estados separados.

Una preparación todavía no persistida puede cancelarse conservando la reseña ordinaria. Si cambia el banco de preguntas, reintentar su consulta y actualizar conservando respuestas; si una pregunta retirada contiene texto, copiarlo y vaciarlo explícitamente antes de actualizar. El sistema conserva el borrador mientras tanto. Si el autor pierde rol crítico, sus análisis históricos mantienen tipo/nota; solo sus campos básicos son editables como jugador.

## Ejecutar fuera de la sesión actual

Consultar [identidad y stack local](IDENTITY.md), [catálogo y RAWG](CATALOG.md) y [README](../README.md). Mantener separados configuración pública Vite y secretos de servidor. No copiar salidas completas de CLI que contengan claves.

La compilación habitual sin configuración usa el catálogo curado explícito; no acredita una integración real. Para la demo conectada hacen falta el stack local, funciones servidas, clave RAWG privada del servidor y URL/clave publicable de Supabase en el proceso Vite. No usar service_role ni secretos como variables VITE.

Las pruebas crean y limpian sus cuentas/publicaciones temporales. Por eso una ficha puede no tener evaluaciones al terminar la verificación; no se añaden opiniones ficticias para llenar pantallas.

## Pendiente para entrega completa

Solicitudes de crítico, votos, comentarios, agregados, biblioteca/perfiles, moderación/reputación, evaluación integral y publicación Vercel autorizada. Esta demo todavía no demuestra los cinco flujos P0 completos de la especificación §15.
