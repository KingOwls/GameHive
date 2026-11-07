# Demo funcional local — avance G0–G4

Actualizado: 2026-11-07, America/Bogota. Producto completo P0 todavía pendiente. Esta guía describe la funcionalidad implementada; el cierre verificable de cada historia está en [PROGRESS](PROGRESS.md) y sus informes QA.

La demo mantenida por Codex se abre en [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Es local a este equipo. El build estable actual corresponde a la biblioteca GH027–028 verificada localmente en la rama feat/g4-library; se sirve desde una copia independiente de futuras compilaciones. No es un despliegue Vercel. G1/G2 remotos están documentados aparte; G3/G4 no se han publicado en Supabase remoto; las cuentas de esta demo pertenecen al stack local.

## Recorrido de jugador

1. El catálogo RAWG está implementado, pero su disponibilidad actual no está acreditada y B-06 registra un bloqueo de conectividad. Para probar la biblioteca puede usarse su buscador de juegos ya registrados, que no necesita nuevas respuestas RAWG. Los filtros de puntuación propia dependen de GH-026; todavía no hay agregados GameHive.
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

## Biblioteca y perfil básico

1. Iniciar sesión y abrir **Mi biblioteca**. La colección empieza privada y permite buscar juegos RAWG ya consultados o registrados manualmente; el buscador indica ese alcance.
2. Pulsar **Organizar este juego**, elegir estado, favorito, interés y progreso opcional. Las marcas son independientes; también se permite guardar sin clasificar. Abrir otra sesión confirma los cambios persistidos.
3. Elegir **Publicar mi biblioteca** para compartir. Desde **Mi perfil → Ver mi perfil público** puede abrirse el enlace a biblioteca en otra sesión. **Hacer privada** impide nuevas lecturas ajenas, incluidas cuentas moderador/admin.
4. Si otra pestaña cambia la entrada o se pierde la respuesta, consultar el estado guardado y revisar las marcas antes de confirmar de nuevo. Se conserva el borrador durante esa recuperación; una recarga completa descarta cambios no guardados de biblioteca.
5. El listado pagina20juegos y filtra antes de paginar; el perfil muestra alias/bio/avatar y reseñas públicas10porpágina. No presenta reputación, insignias ni estadísticas todavía no implementadas.

La verificación no deja cuentas ni reseñas de relleno. Los votos GH024 están implementados y visibles, pero siguen en verificación independiente de este cierre. Recomendaciones, seguidores y descarga/baja de cuenta permanecen pendientes.

## Ejecutar fuera de la sesión actual

Consultar [identidad y stack local](IDENTITY.md), [catálogo y RAWG](CATALOG.md) y [README](../README.md). Mantener separados configuración pública Vite y secretos de servidor. No copiar salidas completas de CLI que contengan claves.

La compilación habitual sin configuración usa el catálogo curado explícito; no acredita una integración real. Para la demo conectada hacen falta el stack local, funciones servidas, clave RAWG privada del servidor y URL/clave publicable de Supabase en el proceso Vite. No usar service_role ni secretos como variables VITE.

Las pruebas crean y limpian sus cuentas/publicaciones temporales. Por eso una ficha puede no tener evaluaciones al terminar la verificación; no se añaden opiniones ficticias para llenar pantallas.

## Pendiente para entrega completa

Solicitudes de crítico, cierre de verificación de votos, comentarios, agregados, recomendaciones, perfiles/seguimiento de críticos, exportación/baja, moderación/reputación, evaluación integral y publicación Vercel autorizada. Esta demo todavía no demuestra los cinco flujos P0 completos de la especificación §15.
