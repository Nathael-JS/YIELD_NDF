# Mejoras

Qué se mejoró, cómo se hizo y qué se usó; después, lo pendiente y lo que no conviene hacer todavía. Versiones en [CHANGELOG.md](CHANGELOG.md).

**Forma de trabajo:** el cambio más pequeño que resuelve todo (*ponytail*): primero lo que ya existe en el proyecto, después lo que trae el navegador, y solo al final una dependencia nueva. Los componentes visuales salen del sistema de diseño; si falta algo, se agrega al componente y al artefacto, no se parcha con CSS en la app. Cada cálculo nuevo lleva su prueba y cada pantalla se recorre en el navegador con los archivos reales.

## Hechas

| Versión | Mejora | Cómo se hizo | Qué se usó |
| --- | --- | --- | --- |
| 0.13.0 | **Super administrador, MFA y base de datos** | TOTP propio con `node:crypto` (vectores del RFC 6238); contraseña temporal obligatoria de cambiar; la API limita la cuenta hasta completar la seguridad; Cuentas con crear/editar/restablecer/borrar; página Base de datos con espacio, CSV y limpieza | `qrcode` (cargado solo en Seguridad), `yc-table`, `KpiTile`, `HistoryList`, `Badge` |
| 0.11.0 | **Pantalla de cuentas y roles** | Tabla con estado y rol por cuenta; Activar/Desactivar y Hacer/Quitar admin. El servidor revisa activo y rol en la base en cada llamada | `yc-table`, `Badge`, `Button`; `GET/POST /api/usuarios` |
| 0.10.0 | **Cuentas reales y API protegida** | `scrypt` con sal para claves; cookie firmada con HMAC (`HttpOnly`, `SameSite=Strict`, `Secure`); la API exige sesión y toma usuario/sesión de ella; límite de intentos; solo JSON en POST; cabeceras CSP y demás | `node:crypto` (sin dependencias), pruebas en `server/auth.test.js` |
| 0.9.0 | **Neon en directo e historial por sesión** | Guardado automático al tener TCQS + BOM (efecto en `Layout`, una vez por carga con `savedKey`); `yield_cargas` registra cada carga en la misma transacción que el resumen; Historial agrupa por `sesion` (un `crypto.randomUUID()` por inicio de sesión) | `pg`, transacción `begin/commit`, `HistoryList` con `action` |
| 0.9.0 | **Login con gráficas vivas** | Barras con `transform: scaleY` + `transition`, línea con transición de `d`; cada 3.5 s una oscilación suave (`Math.sin`) sobre la base | CSS y un `setInterval`; nada con movimiento reducido |
| 0.9.0 | **Carrusel con arrastre y clic** | Eventos de puntero (`setPointerCapture`): la gráfica sigue al puntero; > 60 px cambia; clic sin arrastrar avanza o retrocede según el lado | `ChartCarousel` (app, artefacto v21 y reporte HTML) |
| 0.9.0 | **Menos re-dibujos** | Selectores de zustand (`useApp((s) => s.x)`) en lugar de leer todo el almacén | zustand (sin Redux: mismo patrón de almacén único, ~1 KB, sin código extra) |
| 0.8.0 | **Barras horizontales** | `BarChart horizontal`: una fila por estación, nombre completo a la izquierda (se corta con «…» solo si no cabe) | Componente nuevo en la app y en el artefacto (v20) |
| 0.8.0 | **▲/▼ de RTY y recuperado** | `change()` genérico: RTY del periodo anterior se calcula con sus estaciones | `src/lib/tcqs.ts` con prueba |
| 0.8.0 | **Carrusel animado** | La gráfica entra del lado al que se navega, barras que crecen y líneas que se dibujan (CSS, `pathLength`); ← →; nada con movimiento reducido | `ChartCarousel`; dirección de diseño con *creative* |
| 0.8.0 | **Reporte HTML** | `renderToStaticMarkup` de los mismos componentes + CSS incluido + ~20 líneas de JS para carrusel y buscador; se carga al pedirlo | `react-dom/server`, CSS `?inline` de Vite |
| 0.8.0 | **Reporte PDF** | Documento A4 con primitivas de react-pdf (barras, Pareto, tendencia, tabla) y colores de los tokens; se carga al pedirlo (1.2 MB) | `@react-pdf/renderer` |
| 0.8.0 | **Seguimiento en Neon** | Servidor `node:http` + `pg` (sin framework) que sirve la app y la API; la conexión solo en `DATABASE_URL`; validación de cada fila; upsert en una consulta con `unnest`. El histórico entra como un TCQS | `pg`, Postgres local para probar, Render |
| 0.7.0 | **▲/▼ contra el periodo anterior** en Yield | Selector *Periodo* (último día/semana/mes o todo el rango). `change()` resta el valor del periodo anterior a un decimal y no compara si alguno tiene menos de 10 entradas (regla 1 de la guía). El retest que sube cuenta como malo | `KpiTile` (`delta`, `good`), `Select`, `periodsOf`/`change` en `src/lib/tcqs.ts` con prueba |
| 0.7.0 | **Archivos guardados** entre recargas | El último archivo de cada tipo, ya leído, se guarda en IndexedDB y se recupera al abrir. Al salir se borra todo (el equipo puede ser compartido). Si el navegador no lo permite, la app sigue en memoria | IndexedDB del navegador (`src/lib/saved.ts`, ~25 líneas, sin dependencias); no localStorage: tiene límite de ~5 MB y pierde las fechas de Excel |
| 0.6.0 | **Dónde mirar primero → estación en Yield** | El enlace lleva la estación en el `#` de la dirección; Yield resalta la fila y la desplaza a la vista | React Router (`hash`), `scrollIntoView`, `aria-current` |
| 0.6.0 | **✓ del menú por estado real** | `PipelineNav` recibe `done`; la app lo llena con «TCQS leído» y «hay filas de Juliet» | Prop nueva en el componente y en el artefacto (v19) |
| 0.5.0 | **Fórmulas de la guía SFC** | Se aplicó cada regla al TCQS real: 211/211 filas cumplen entradas = 1er pase + 1ra falla; 29 filas sin dato; 17 filas donde no cuadraba FPY + Retest = Final | Guía *YieldRateSFC y RetestRate*, `tcqs.ts`, script de comprobación con papaparse |
| 0.5.0 | **Login animado** | Barras que crecen, línea de FPY que se dibuja y archivos que pasan a «Cargado»; CSS (`transform`, `stroke-dashoffset`), una sola vez, quieto con `prefers-reduced-motion` | `LoginPanel backdrop` (nuevo), `FileChip`, `KpiTile`; dirección elegida con *creative* (variante equilibrada) |
| 0.5.0 | **Inicio como landing** | Titular con el dato principal, indicadores, 3 estaciones a revisar con su acción y carrusel | `ChartCarousel`, `KpiTile`, `Badge`, `diagnose()` |
| 0.5.0 | **Menú** | Fijo arriba, enlace a Inicio, chip de usuario; en móvil una sola fila de pasos | CSS del componente (artefacto v17) |
| 0.4.0 | **Lectura del TCQS y filtro a Juliet** | Columnas obligatorias, filas inválidas, modelos del BOM sacados del texto de las celdas con una expresión regular | `read-excel-file`, `papaparse`, `modelsFrom()` |
| 0.2.0 | **`FileChip` como zona de carga** | Clic o arrastrar y soltar dentro del componente | Prop `onFile` en el componente y el artefacto |
| 0.1.0 | **Base del proyecto** | Componentes del artefacto (`bundle.js`) portados a TSX; tokens generados de `tokens.json` | Vite, React 18, TypeScript, zustand, React Router, fuentes IBM Plex locales |

## Pendientes (en orden)

1. **Confirmar con el piso:** meta FPY (95 %) y mínimo de muestra (10 entradas).
2. **Proteger más la información** (en orden):
   - Usuario de Neon con solo los permisos que usa la app (sin `drop`/`alter`) y rama de Neon aparte para pruebas.
   - Revocar sesiones al cerrar sesión (tabla de sesiones) y límite de intentos en la base.
   - Respaldos: restauración a un punto en el tiempo de Neon activada y probada.
   - Retención: cuánto tiempo guardar `yield_cargas` y quién puede verlas.
3. **DATA ANALYSIS y QM:** validación y match por serial + estación; Pareto 2do nivel por código de error.
4. **PDF:** anexo con validación y fórmulas, si se pide.
5. **Etiquetas de git** por versión (`v0.1.0`…`v0.8.0`).

## No relevante por ahora

- **Redux:** zustand ya es un almacén único con acciones, como Redux; cambiarlo no hace la app más rápida. La ganancia real eran los selectores (hecho en 0.9.0).

- **Selector de tema claro/oscuro:** la app sigue al sistema operativo; `data-theme` ya lo permite si se pide.
- **Cambiar a SheetJS:** `read-excel-file` ya lee los archivos reales.
- **Guardar más de un archivo por tipo:** el historial guarda la lista; reabrir versiones viejas no se ha pedido.
- **Animaciones en las pantallas de trabajo:** el sistema las limita al login para que el dato se lea primero.
- **Horario de corte 08:00:** el TCQS solo trae la fecha, sin hora.
