# GAMEHIVE — ESPECIFICACIÓN MAESTRA PARA CODEX

**Estado:** especificación de trabajo para la entrega final universitaria.  
**Fecha base:** 31 de octubre de 2026.  
**Producto:** GameHive — aplicación web para descubrir videojuegos y contextualizar reseñas.  
**Equipo humano:** dos estudiantes, con mayor experiencia en backend que en frontend.  
**Propietario previsto del repositorio nuevo:** cuenta de GitHub `KingOwls`.  
**Presupuesto objetivo:** 0 USD. No habilitar servicios de pago sin autorización explícita.

> **MANDATO CRÍTICO:** `https://github.com/KingOwls/ProjectWebVideoGame` es SOLAMENTE una referencia de lectura. No crear allí ramas, commits, issues, pull requests, releases, despliegues ni modificaciones. Crear una implementación independiente desde cero, en un nuevo directorio y, una vez autorizado, un repositorio DIFERENTE. El repositorio original no tiene una licencia de reutilización identificada: NO copiar su código o activos como material de implementación; usar únicamente ideas y especificaciones funcionales, con diseño y código propios.

## 0. Jerarquía de fuentes y resolución de discrepancias

1. Mandatos y decisiones explícitas de este documento, que reflejan las respuestas finales del equipo.
2. Instrucciones de seguridad en el `AGENTS.md` entregado.
3. El archivo `GameHive_Proyecto_Web_DESCARGABLE.docx`, documento maestro del proyecto (27/10/2026): problema, objetivos, 14 pantallas iniciales, funciones, modelos conceptuales y evidencia académica.
4. La estructura y comportamiento observable del repositorio de referencia **solo para análisis de lectura**.
5. Documentación oficial y vigente de Supabase, Vercel, React, Vite, RAWG y BMAD.

**Cambios acordados sobre el documento anterior:**
- La fase final sustituye los mocks de M1/M2 por datos y cuentas reales, con Supabase PostgreSQL y Auth (NO Firebase).
- Se incorpora el rol **Moderador**, además de Usuario, Crítico y Administrador.
- Se agrega biblioteca pública/privada, comentarios con tiempo mínimo, seguimiento de críticos, preferencias de onboarding, reportes detallados y auditoría.
- La estética será original, muy expresiva, inspirada conceptualmente en el dinamismo y tipografía de Persona 3 Reload y Persona 5, sin copiar propiedad intelectual.
- Noticias queda **fuera del alcance obligatorio** y se conserva en el backlog futuro.
- M1 y M2 ya fueron entregados. La prioridad presente es **producto final, no reconstruir dos entregas pasadas**.
- El despliegue final se hará en **Vercel** (GitHub Pages solo si la institución lo requiere expresamente).

## 1. Misión y definición de terminado global

Construir una SPA web de escritorio, mantenible, con identidad visual propia, que permita a jugadores descubrir títulos reales de PC y consolas (AAA e indies), consultar fichas, registrarse, publicar reseñas y críticas, guardar juegos, reportar contenido y ejercer los permisos de los cuatro roles. Los datos comunitarios deben persistir y poder ser observados entre cuentas y sesiones, sin simulaciones presentadas como reales.

**Cinco flujos obligatorios para la evaluación:**
1. Buscar y filtrar un juego real → abrir ficha con metadatos, portada y sinopsis → navegar contenidos relacionados.
2. Registrarse/iniciar sesión → crear UNA reseña del juego → consultar → editar texto y puntuación simultáneamente → visualizar score propio calculado.
3. Demostrar los **cuatro roles** con permisos comprobables: Usuario, Crítico (verificado o no), Moderador y Administrador. Incluye solicitud y aprobación administrativa de críticos.
4. Añadir a biblioteca → clasificar como favoritos, wishlist, jugando, terminado o pendiente → configurar privacidad → consultar desde otra sesión.
5. Reportar contenido, incluidos spoilers sin advertencia → revisar como Moderador/Admin → desestimar/ocultar/sancionar → notificar → registrar la resolución en auditoría.

**No terminado:** botón que no actúa, pantalla con datos inventados presentados como reales, login simulado, políticas RLS ausentes, operación privilegiada validada solo en cliente, o pruebas declaradas sin ejecución.

## 2. Stack y límites

- **Frontend:** React + Vite + TypeScript preferente, React Router; modularidad por feature. CSS propio con variables/tokens y CSS Modules, evitando frameworks de UI que impongan aspecto genérico. Usar librería de animación ligera solo si está justificada.
- **Backend gestionado:** Supabase Auth (correo + contraseña), PostgreSQL, PostgREST/Data API, RLS, Edge Functions cuando sea necesario, migraciones y pruebas SQL. No Firebase.
- **Hosting frontend:** Vercel (plan Hobby si es compatible con los términos y condiciones vigentes); un responsable de infraestructura.
- **Catálogo:** RAWG como fuente principal candidata, con prueba de cobertura y licencia; Steam/itch.io como enriquecimientos limitados únicamente mediante endpoints autorizados. No scraping; no presuponer API pública universal ni precios actuales.
- **Versionado y calidad:** Git/GitHub, PRs revisadas, ESLint, TS checks, Vitest, React Testing Library, Playwright, pruebas SQL/RLS, verificación de build, informes Markdown de incidentes.
- **Metodología:** BMAD Method estable compatible con Codex; `AGENTS.md` para normas persistentes; Skills/agentes por especialidad solo si la instalación ha sido verificada.
- **Costo:** plan gratuito Supabase + despliegue gratuito cuando condiciones lo permitan; comprobar cuotas actuales antes de activar servicios. Usar recursos de demo medidos; no almacenar imágenes/tráilers de proveedores sin permiso ni necesidad.
- **Alcance visual:** prioridad escritorio (1440 y 1280; controlar zoom/anchos mínimos razonables), no construir una aplicación móvil. Accesibilidad de teclado y opción de reducir movimiento sí son obligatorias.

## 3. Interfaz visual: "original con energía de videojuego"

Inspiración de lenguaje — NO reproducción — en Persona 3 Reload y Persona 5: títulos expresivos, diagonales, jerarquía tipográfica, paneles gráficos, movimientos fluidos y fuertes decisiones cromáticas.

**Decisiones concretas:**
- Elegir una paleta propia tras documentar 2–3 propuestas; considerar azul profundo + turquesa + acento coral, rojo/negro o índigo/violeta. No imponer automáticamente la paleta violeta original.
- Seleccionar tipografía **libre y con licencia adecuada** para titulares (p. ej. Syne o Bricolage Grotesque) y lectura (Inter/DM Sans). No distribuir archivos de fuentes sin licencia.
- Oscuro como **fallback**; respetar preferencia `prefers-color-scheme` cuando esté presente; opción explícita Sistema/Oscuro/Claro que sobrescribe la detección.
- Animaciones moderadas: microinteracciones 120–250 ms y transiciones de vista ~250–400 ms si el dispositivo lo permite. Implementar `prefers-reduced-motion` y evitar efectos que bloqueen navegación.
- Loading: una mascota/personaje **original** para estados reales de carga; no crear esperas artificiales. Estados `loading`, `empty`, `error`, `success` por pantalla.
- Componentes: Header, navegación, GameCard, Hero, GamePreview, ScoreBadge, FilterPanel, SearchBox, ReviewCard, SpoilerReveal, ReputationBadge, LibraryAction, ReportModal, AdminTable, EmptyState, Toast, Skeleton, Dialog, ThemeToggle.
- Cuidar contraste, foco visible, tamaños de hit targets, semántica HTML y uso por teclado; paneles administrativos menos ornamentados.
- Juegos comerciales e imágenes: usar metadatos/imágenes servidos mediante las condiciones permitidas por sus proveedores y atribución visible; nunca copiar assets de las referencias de Persona.

## 4. Mapa de pantallas y rutas (base + ampliaciones)

**Catorce pantallas originales ya especificadas en el documento:** Home/Discover, Login, Registro, Explorar, Resultados, Detalle del videojuego, Crear/Editar reseña, Perfil de usuario, Biblioteca, Perfil de crítico, Dashboard administrador, Gestión de juegos, Gestión de usuarios/críticos, Gestión de reportes.

**Rutas sugeridas para la fase final:**

| Ruta | Pantalla | Permisos |
|---|---|---|
| `/` | Home, tendencias y juegos destacados | Pública |
| `/explore` | Catálogo y filtros | Pública |
| `/search?q=` | Resultados | Pública |
| `/games/:id` | Ficha de juego, sinopsis, medios, puntuaciones y opiniones | Pública |
| `/login`, `/register` | Autenticación | Pública |
| `/onboarding` | Géneros/plataformas/"me interesa" | Auth |
| `/games/:id/review` | Crear o editar reseña | Usuario/Crítico |
| `/u/:handle` | Perfil público | Pública |
| `/u/:handle/library` | Biblioteca, según privacidad | Dueño o pública |
| `/critics/:handle` | Perfil de crítico | Pública |
| `/critic/apply` | Solicitud de crítico | Auth elegible |
| `/settings` | Perfil, privacidad, tema, descarga/baja de cuenta | Dueño |
| `/notifications` | Notificaciones internas | Auth |
| `/moderation` | Cola de reportes/acciones | Moderador/Admin |
| `/admin` | Dashboard de administración | Admin |
| `/admin/games` | Catálogo interno manual | Admin |
| `/admin/users` | Roles, verificación, suspensiones | Admin |
| `/admin/reports` | Reportes y auditoría | Admin |

Una ruta puede descomponerse en subcomponentes, pero nunca debe quedar como placeholder vacío si pertenece a P0.

## 5. Reglas de producto: detalles ejecutables

### 5.1 Registro, usuarios y privacidad
- Email+contraseña con Supabase Auth; SIN correo de verificación obligatorio para esta demo académica, sujeto a configuración de proyecto. No OAuth.
- Alias único **insensible a mayúsculas** y distinto del email; reserva transaccional o índice único PostgreSQL sobre versión normalizada. Evitar filtraciones de email por búsqueda pública.
- Cuestionario de onboarding: PC o consolas, géneros, estilo/narrativa, preferencias y juegos que interesan. Puede reabrirse desde perfil.
- Avatares predeterminados y recursos propios; sin subida de archivos por el usuario en MVP.
- Perfil público: alias, bio elegida, avatar, reputación, reseñas públicas, insignias, estadísticas y biblioteca solo si es pública. Datos privados: email, configuraciones, preferencias privadas, borradores, evidencias de solicitudes, reportes y datos internos de moderación.
- Ajustes de tema: Sistema / Oscuro / Claro; oscuro como fallback.
- Descargar información propia y solicitar eliminación de cuenta. Diseñar flujo de limpieza/anonimización explícito y probado, sin violar auditoría mínima.

### 5.2 Catálogo
- PC y consolas; AAA e indies; normalizar nombre, IDs externos, plataformas, géneros, fecha, estudio, publisher, descripción, portadas, capturas, rating de tercero y fuente. `provider+external_id` único.
- RAWG bajo demanda y con cache / catálogo curado; separar campos `external_rating` de `gamehive_user_score` y `gamehive_critic_score`; siempre exhibir origen, escala y muestra. Nunca reinterpretar un score RAWG/Metacritic como score propio.
- Filtros mínimo: texto, género, plataforma, año de lanzamiento, etiqueta, score GameHive, ordenar. Precio/tienda solo si existe proveedor autorizado de precios actuales; sino no mostrar filtro engañoso.
- Detail: ficha breve + completa, sinopsis en preview, plataformas, desarrollador, fecha, género, screenshots/trailer si hay permiso/URL válida, requisitos cuando existan, link a tiendas confiables, reseñas, críticas, destacados y similares cuando la fuente lo permita.
- Juegos ausentes: administrador puede registrar manualmente datos reales respaldados por fuente, sin editar silenciosamente información original del proveedor. Proporcionar `overrides`/`curated_games` separados si hace falta. No crear juegos inventados.
- Buscador eficiente: debounce, paginación, cache controlada, error/reintento, límite de API, fallback honesto. Atribuciones RAWG visibles según condiciones actuales.

### 5.3 Reseñas, críticos y comentarios
- UNA reseña principal vigente por **autor+juego**, con `UNIQUE(author_id, game_id)` (si hay soft delete, definir índice parcial según regla decidida). Si quiere cambiar nota, debe cambiar también el texto del comentario en la misma operación; guardar `updated_at` y auditoría/revisión pertinente.
- Texto spoiler-free y sección opcional con spoilers ocultos por defecto; **NO crear una segunda reseña contabilizable** para el mismo juego. Crítico puede ofrecer lectura sin spoilers y análisis ampliado con spoilers bajo el mismo registro.
- Usuario normal: puntuación, título, opinión, pros/contras opcionales; crítico: ocho campos base — jugabilidad, narrativa, arte, sonido, rendimiento, accesibilidad, contenido, valor — más banco de preguntas por género configurable, plataforma, horas jugadas, finalización, puntos fuertes/débiles, resumen, copia facilitada, justificación de nota editorial.
- Crítico: solicitud administrativa documentando procedencia/grupo/experiencia y muestra; Admin admite o rechaza. `critic` y `critic_verified` son condiciones independientes; no autoverificar por reputación. Los usuarios pueden seguir **solo a críticos**.
- Respuestas/comentarios a juegos/reseñas: supuesto operacional **usuarios regulares después de 10 horas transcurridas desde registrar la cuenta, críticos desde 0 horas**. La restricción no bloquea automáticamente la primera reseña, salvo indicación posterior. Aplicar del lado servidor y mostrar cuenta atrás informativa.
- Votos útiles/no útiles sobre reseñas: `UNIQUE(review_id, voter_id)`; una sola operación irreversible (no retirar ni cambiar signo); sin auto-voto y con anti-abuso. Consentir doble tipo +1/-1 como decisión técnica documentada.
- Puntuaciones GameHive separadas para usuarios y críticos; calcular únicamente con datos elegibles y suficientes; si no hay reseñas: `Sin evaluaciones`, no inventar números.

### 5.4 Biblioteca y recomendaciones
- Cada usuario puede marcar favoritos y estado (`wishlist`, `playing`, `completed`, `backlog`), interés y opcional progreso. Evitar duplicaciones en relación usuario+juego.
- Biblioteca privada por defecto, configurable pública; cuando es privada, API y RLS niegan consulta de terceros, aunque conozcan los IDs.
- Recomendar por géneros/plataformas del onboarding y juegos marcados como `Me interesa`, combinando tendencias generales; algoritmo basado en reglas transparente, sin servicio ML de pago.
- Ranking "mejores del año" basado en criterio calculable definido (fuente y filtro temporal); explicar diferencia entre popularidad de proveedor y votos de GameHive.

### 5.5 Reputación
- Escala 0–100, función determinista y versionada a partir de antigüedad, aportes elegibles, apoyo/desaprobación únicos y penalizaciones **confirmadas**.
- Evitar recompensar spam volumétrico. Definir topes de puntaje por actividad, impedir votos propios, limitar cambios por tiempo y probar colusión sencilla.
- No tomar reputación como prueba de verdad ni conceder roles automáticamente por puntaje. Métrica transparente en interfaz.

### 5.6 Moderación y auditoría
- Motivos: spoiler no señalado, spam, insultos, acoso, contenido inapropiado, engaño/otro; gravedad y prioridad (`low`, `medium`, `high`, `critical`).
- Reportante crea reporte contra contenido identificable, con estado. Moderador/Admin revisa y resuelve (desestimar, ocultar, advertir, sancionar, suspender con límites por rol), justificando cada decisión.
- Suspender usuario: ocultar sus reseñas públicas mientras dure; si hay reportes sobre ellas se conservan para revisión.
- Notificaciones internas cuando se elimina reseña, se aplica sanción o se rechaza petición de crítico. No depender de envío gratuito de emails.
- `audit_logs`: solo inserción a través de operaciones controladas, timestamps de servidor, actor, objeto, acción, motivo y antes/después permitido. RLS niega UPDATE/DELETE desde clientes. **Límite:** no afirmar inmutabilidad absoluta frente a propietarios de DB.

## 6. Arquitectura de PostgreSQL (propuesta para migraciones)

Entidades y relaciones base (migraciones deben definir tipos, FKs, índices, checks, timestamps y RLS):

1. `profiles(id uuid PK references auth.users, username unique normalized, display_name, avatar_key, bio, status, created_at, reputation_score)`.
2. `private_user_settings(user_id PK, theme_mode, library_visibility, onboarding_complete, ... )` y `user_interests(user_id, genre/platform/tag, weight)`.
3. `authz_roles(user_id PK, role enum user/critic/moderator/admin, critic_verified)` en esquema privado/no expuesto, o mecanismo equivalente seguro. Evitar autoridad en `user_metadata`.
4. `games(id PK, provider, provider_game_id, slug, title, summary, description, studio, publisher, released_at, cover_url, ..., source_type)` más `game_provider_ids` y tablas/indexados de taxonomías según necesidad.
5. `reviews(id PK, author_id FK, game_id FK, rating CHECK 0..10, title, body_public, body_spoiler, spoiler_flag, status, created_at, updated_at, UNIQUE(author_id,game_id))`.
6. `review_critic_details(review_id PK FK, platform, hours_played, completed, editorial_score, score_reason, transparency, ...)`, `review_criterion_scores(review_id, criterion_key, score)` y `genre_question_bank`.
7. `review_votes(review_id, voter_id, value CHECK (-1,1), created_at, PRIMARY KEY(review_id,voter_id))`, impedir UPDATE/DELETE para emisor, y auto-voto.
8. `game_comments(id, author_id, game_id, parent_comment_id nullable, body, spoiler, status, created_at)` con regla 10h.
9. `user_library(user_id, game_id, state, favorite, interested, progress, PRIMARY KEY(user_id,game_id))`.
10. `critic_applications(id, user_id, organization, experience, portfolio, sample, status, resolved_by, ...)`; `critic_profiles` y `critic_follows(follower_id, critic_id)`.
11. `reports(id, reporter_id, target_type, target_id, reason, severity, status, created_at, resolved_at, ...)`, `moderation_actions`, `sanctions`, `notifications`.
12. `audit_logs` aislado de usuarios no privilegiados; `game_score_aggregates` materializado/actualizado de forma segura si resulta necesario.

**Nota técnica:** dividir datos personales y públicos para que no haya filtraciones mediante selección de columnas o vistas. En vistas de Postgres usar `security_invoker` cuando proceda. Diseñar claves e índices con datos de prueba reales, no indexar todo ciegamente. No exponer schemas privados a Data API.

## 7. Seguridad obligatoria

- Activar RLS en TODAS las tablas expuestas; empezar con **denegación por defecto**, permitir lectura pública solo sobre juegos/reseñas publicadas y datos de perfil explícitamente públicos.
- `TO authenticated` no equivale a autorización: para escritura/lectura privada exigir propiedad (`auth.uid() = user_id`), rol validado en servidor o función segura. UPDATE siempre con `USING` y `WITH CHECK`.
- Los cambios de rol, reputación, `critic_verified`, resultados de moderación, score agregado y auditoría se realizan mediante operaciones confiables; no permitir modificar campos privilegiados desde cliente.
- Nunca exponer la clave secret/service-role de Supabase, contraseñas PostgreSQL ni API keys privadas en Vite, GitHub público, logs o reportes. En React usar exclusivamente URL y clave **publishable** de Supabase, con políticas RLS efectivas.
- Operaciones administrativas en Edge Functions deben verificar JWT, rol vigente, estado de cuenta, objeto y permisos; registrar auditoría en la misma operación transaccional cuando corresponda.
- `SECURITY DEFINER` solo si indispensable, en schema no expuesto, con `search_path`, grants y validaciones rigurosas. No utilizarlo como atajo para deshabilitar RLS.
- Prevenir XSS en contenido de reseñas: no renderizar HTML sin saneamiento; enlaces externos seguros, validación y límites de longitud en servidor.
- Proteger endpoints contra abusos, consultas masivas, spam, enumeración de cuentas y carreras de concurrencia; verificar políticas RLS adversarialmente.
- Sin confirmación de email obligatoria por decisión académica, señalar el riesgo de suplantación/abuso y limitar el acceso según configuración posible. Considerar CAPTCHA/rate limits cuando no requieran pagos.
- Retención de datos: supresión/anónimización controlada, registro mínimo de auditoría, sin exponer emails o información sensible en perfiles públicos.

## 8. Integración externa y cumplimiento

Crear `catalogProvider` interface y adapters `RawgProvider` / `SteamProvider` / `ItchProvider` solamente cuando la API sea oficial y apta. `Game` normalizado no debe mezclar score externo con puntuación GameHive.

**Prueba RAWG:** búsqueda, paginación, detalle, filtros, imágenes y términos de atribución con al menos ocho juegos reales representativos. Registrar campos presentes/ausentes, límites, tasas, errores y condiciones de uso. No depender de trailers, precios, plataformas específicas ni enlaces de compra si el plan/endpoint no los permite.

Si la API o credenciales no están disponibles: preparar funcionamiento reproducible con un pequeño dataset **curado de juegos reales con IDs/fuentes** y etiquetar explícitamente el modo sin conexión; nunca inventar una respuesta de API o una reseña real. La entrega final conectada deberá documentar cualquier integración pendiente y su bloqueo.

## 9. Entornos y variables

- Desarrollo local en Ubuntu Linux; herramientas Node y Git. Comprobar versiones actuales de Node/Vite/BMAD y seguir documentación oficial.
- Un proyecto Supabase Free para desarrollo académico y demostración, más CLI/local cuando Docker esté disponible.
- Configurar `.env.example` sin valores privados, por ejemplo `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, y claves secretas solo en entorno de Edge Functions. Verificar nombres vigentes del SDK.
- Supabase CLI con migraciones versionadas, seeds **de pruebas** y script de reset local. Los datos de pruebas deben estar separados de los datos reales de la demo.
- Vercel solo para hosting final. La aplicación debe compilar con `npm run build`, enrutar correctamente al refrescar y manejar ausencia de configuración con mensaje de instalación.
- Una persona administrará credenciales y despliegues; el segundo estudiante contribuye código con PRs. No compartir cuentas ni claves por chat.
- Proyecto GitHub nuevo, previsto público bajo KingOwls. Repositorio original permanece intocable. Publicar código nuevo, nunca `.env`, snapshots de DB privada, contraseñas o accesos.

## 10. Estrategia de código y calidad

Diseñar módulos: `auth`, `onboarding`, `catalog`, `game-detail`, `reviews`, `critics`, `library`, `reputation`, `moderation`, `admin`, `preferences`, `notifications`. Reutilizar componentes, tipar servicios, evitar acoplamiento a fetch/Supabase desde vistas y minimizar dependencias.

**Definición de terminado por historia:**
1. Existe requisito enlazado, contratos y pantalla/flujo.
2. Implementación real sin botones inertes, datos de comunidad ficticios ni datos mock encubiertos.
3. Maneja loading, sin resultados, validación, error y recuperación.
4. Tiene pruebas unitarias e integración pertinentes y pruebas E2E si es flujo crítico.
5. Si toca datos: prueba RLS por usuario, tercero, moderador y admin; prueba restricciones/índices y concurrencia.
6. Se ejecutan comandos reales de lint, typecheck, test, build (si están configurados); incluir salida de éxito o fallo.
7. Documentación de módulo y notas de cambio actualizadas, revisión humana para integrar.

**Pruebas mínimas:**
- Auth: contraseña errónea, alias duplicado, sesiones, usuario suspendido, configuración email no confirmatorio.
- Catálogo: texto inexistente, proveedor lento/caído, 429, sin portada, datos parciales, paginación.
- Reviews: una por autor/juego, cambio de puntuación exige edición de texto, anti-XSS, spoiler, crítico no verificado, score no manipulado.
- Votes: duplicado, auto-voto, cambio de voto o retiro denegados, concurrencia, recuentos.
- Comments: reloj en límite 9h59m59s y 10h exactas, crítico inmediato.
- Biblioteca: privado no accesible por ID ajeno; público de forma explícita, estado persistente.
- Reportes: un usuario no puede autoaprobar; moderador sin privilegios de asignar rol; suspensión oculta reseñas, audita.
- UI: teclado, foco, tema claro/oscuro/sistema, `prefers-reduced-motion`, tiempos de carga y errores.
- Integridad: FKs, constraints, cascadas cuidadosas, auditoría append-only para roles de API.
- E2E: buscar → detalle; signup → review; biblioteca; solicitud crítico → aprobación; reportar → moderar → notificar; acceso indebido denegado.
- Seguridad: inyección en entradas, XSS, IDOR, modificación de roles, llamadas directas a Data API, sobrecarga razonable local/emulada.

**Incidentes:** generar reportes `qa-reports/GH-QA-YYYY-NNN.md` con caso, contexto, pasos, esperado, observado REAL, evidencia/logs saneados, severidad, causa probable, solución y retest. No fabricar pruebas.

## 11. Agentes de trabajo (roles de Codex/BMAD, NO procesos ya instalados)

- `GH-AG-01 Product Orchestrator`: decisiones, alcance, arquitectura y backlog.
- `GH-AG-02 UX Motion Designer`: identidad, tema, tipografía, accesibilidad.
- `GH-AG-03 React Engineer`: componentes y frontend.
- `GH-AG-04 Catalog Integration Engineer`: APIs y contratos de juegos.
- `GH-AG-05 Supabase/Postgres Security Engineer`: DB, Auth, migraciones, RLS, Edge Functions.
- `GH-AG-06 Community Systems Engineer`: reseñas, comentarios, biblioteca, reputación, críticas y moderación.
- `GH-AG-07 QA/Security Auditor`: tests, límites, defectos y regresiones.
- `GH-AG-08 Release/Docs`: CI, Vercel, documentación y evaluación.

Implementar estos roles mediante flujo real soportado por la versión instalada de Codex/BMAD. **No inventar nombres de comandos ni afirmar que todos los subagentes están instalados.** `AGENTS.md` da normas globales; Skills contienen instrucciones reutilizables. Preferir BMad v6.12 estable hasta comprobar versión y compatibilidad.

## 12. No objetivos explícitos

- No crear tienda ni procesar pagos.
- No scraping, no compra de API, no marketplace, no ML de pago, no chat en tiempo real, no red social completa.
- No listas colaborativas. No seguidores de usuarios normales (solo seguimiento a críticos).
- No noticias en P0: dejar como enhancement futuro.
- No aplicación móvil ni soporte móvil completo.
- No duplicar las entregas M1/M2 ya presentadas.
- No distribuir el proyecto como producto comercial ni abrirlo como servicio público a largo plazo.

## 13. Errores de interpretación que Codex debe evitar

- "Cuenta pública de GitHub" NO significa que la plataforma de GameHive deba promocionarse públicamente; despliegue para evaluación, con datos de demostración no sensibles.
- "Datos reales" significa juegos de fuentes reales y publicaciones de usuarios de prueba que realmente interactúan; NO fabricar comentarios, críticas y puntuaciones.
- "Más APIs" NO significa fusionarlas indiscriminadamente ni hacer scraping.
- "Una reseña" NO impide un campo público sin spoiler y una sección oculta dentro de la misma reseña.
- "Voto irreversible" significa que no se puede eliminar ni cambiar luego de la primera transacción confirmada.
- "Sin presupuesto" prohíbe activar plan de pago, no prohíbe documentación o pruebas locales.
- "Animaciones Persona" NO permite copiar imágenes, personajes, fuentes o UI protegida.
- "Todos los roles" son cuatro, aunque el documento inicial tenga tres.

## 14. Implementación por puertas de calidad (gates)

**G0 — Preparación:** nuevo directorio/repo, README, `AGENTS.md`, BMAD verificado, stack, scripts, CI, documentación de decisiones; `npm run build` funcional. No editar original.

**G1 — Base y datos:** esquema SQL y migraciones, Auth y perfil/alias, cuatro roles protegidos, RLS con pruebas positivas/negativas, Edge Functions de privilegios necesarios. Sin claves expuestas.

**G2 — Descubrimiento:** RAWG conectado con proveedor encapsulado o bloqueo documentado, búsqueda/filtros, ficha real, datos normalizados, atribución; E2E búsqueda → ficha.

**G3 — Comunidad:** reseñas, críticas, spoilers, comentarios 10h, votos irreversibles, puntuaciones propias. RLS/duplicados/concurrencia comprobados.

**G4 — Biblioteca y perfiles:** onboarding, favoritos/listas públicas/privadas, recomendaciones, críticos, solicitudes, seguimiento y ajustes.

**G5 — Moderación:** reportar → revisar → resolver → sancionar → notificar/auditar; permisos de Moderador/Admin aislados, pruebas adversariales.

**G6 — UX, entrega:** visual Persona-inspired propio, modos, loading mascota original, accesibilidad, rendimiento, test suite y despliegue Vercel cuando esté autorizado; informe de evaluación final.

Mantener en `docs/PROGRESS.md` G0–G6 con estado (`pending/in_progress/verified/blocked`), fecha de actualización, comandos ejecutados, enlaces a pruebas y bloqueos. No declarar gate `verified` sin evidencia.

## 15. Aceptación final demostrable

Realizar una prueba guiada con al menos cuatro cuentas de evaluación: Usuario, Crítico, Moderador y Administrador. Comprobar en navegador de escritorio:

- Visitante encuentra un juego real y su ficha muestra fuente, metadatos e imágenes válidas.
- Usuario se registra, selecciona intereses y guarda juego; puede ver su biblioteca desde otra sesión.
- Usuario crea una reseña, no puede duplicarla, puede editarla, y no puede manipular su score directamente.
- Crítico tiene ficha y análisis con criterios; estado no verificado no se confunde con verificado; usuario puede seguirlo.
- Comentarios respetan antigüedad de cuenta; votos irreversibles impiden repetición.
- Usuario reporta spoiler no avisado; Moderador resuelve; aparece notificación y acción auditada; Administrador ve historial y puede gestionar roles.
- Cuenta ajena NO puede ver biblioteca privada, editar reseñas ajenas, asignarse rol, aprobar reportes ni consultar información privada.
- Modo claro/oscuro/sistema y movimiento reducido funcionan; carga y errores tienen estados visibles.
- CI y pruebas locales pasan o dejan informes de incidencias claramente identificadas; Vercel muestra build operable de la última versión autorizada.

**Restricciones externas:** acceso/credenciales a Supabase, RAWG, Vercel y GitHub, y compatibilidad del despliegue con términos vigentes. Codex puede preparar todo el código local, pero debe registrar bloqueos y pedir autorización/credenciales por canales seguros antes de acciones externas que lo requieran. Nunca afirmar que un servicio está conectado si no lo verificó.

## 16. Documentación y recursos oficiales

- `AGENTS.md` y `BACKLOG.md` de este paquete: reglas operativas y tickets.
- Documento fuente: `GameHive_Proyecto_Web_DESCARGABLE.docx` (debe copiarse opcionalmente a `docs/reference/` en proyecto nuevo, sin exponer datos privados).
- Referencia de solo lectura: https://github.com/KingOwls/ProjectWebVideoGame
- Inspo visual: https://www.gameuidatabase.com/gameData.php?id=618 y https://www.gameuidatabase.com/gameData.php?id=1884
- Codex AGENTS: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- BMad stable: https://docs.bmad-method.org/start/install-bmad/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase seguridad: https://supabase.com/docs/guides/database/secure-data
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- RAWG API: https://rawg.io/apidocs
- Vercel Vite: https://vercel.com/docs/frameworks/frontend/vite

## 17. Entrega técnica que Codex debe producir

1. Repositorio **nuevo** con código React completo y estructura mantenible.
2. Migraciones PostgreSQL con RLS y tests (incluyendo datos de prueba seguros).
3. Autenticación real con email+password y configuración clara de alias únicos.
4. Módulos reales de catálogo, reseñas, roles, biblioteca y reportes.
5. Diseño original, modo oscuro/claro/sistema, animaciones ajustadas y mascota/loading original (o recurso original provisional y documentado).
6. Integraciones API con adaptadores, manejo de errores y atribución.
7. Scripts unitarios/integración/e2e/seguridad y CI; informes `.md` de fallos.
8. README de instalación en Ubuntu, `.env.example`, guías Supabase/Vercel, manual de demo y matriz de trazabilidad.
9. `docs/PROGRESS.md`, riesgos, deuda técnica y lo realmente verificado.
10. Despliegue en Vercel solo después de contar con permisos/cuentas; documentar URL de prueba solo si existe.

**Regla de cierre:** no afirmar «proyecto completo» mientras falte algún flujo P0 o haya defectos críticos de seguridad sin resolver. Presentar estado honesto y siguientes pasos concretos.
