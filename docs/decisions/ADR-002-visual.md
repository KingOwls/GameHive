# ADR-002 — Identidad visual original

Fecha: 2026-10-31. Estado: base implementada, revisión humana pendiente.

Se compararon tres direcciones:

| Propuesta | Paleta | Evaluación |
|---|---|---|
| Abisal | azul profundo + menta + coral | Elegida: contraste, calidez y distancia respecto a referencias |
| Señal | rojo + carbón + blanco | Demasiado cercana al lenguaje de la referencia conceptual |
| Orbital | índigo + lavanda + amarillo | Viable, menor diferenciación para esta base |

Tokens oscuros: fondo `#0b1925`, panel `#142735`, texto `#edf6f7`, acento `#6ff2c2`. Modo claro con fondo `#f3f7f6`, acento `#08654b`. Tipografía del sistema: no se distribuyen fuentes sin licencia. Titulares compactos, símbolo geométrico de colmena y tarjetas con iniciales diseñados en este proyecto; las iniciales no se presentan como portadas oficiales.

Sistema/Claro/Oscuro con preferencia persistida y fallback oscuro. Foco visible, salto de navegación, labels nativos, targets de 44px y movimiento reducido. Mascota provisional geométrica original en SVG/CSS, visible solo ante cargas reales o dentro de la vitrina etiquetada como ejemplo. La mascota expresiva final queda en GH-038.

Se eliminó transición de fondo: axe encontró contraste insuficiente durante el cambio de tema. Tras corregir, axe pasó en catálogo, ficha y vitrina en ambos temas. No equivale a una auditoría manual WCAG completa.
