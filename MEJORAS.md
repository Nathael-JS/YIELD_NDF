# Mejoras

Qué se mejoró, cómo se hizo y qué se usó; después, lo pendiente y lo que no conviene hacer todavía. Versiones en [CHANGELOG.md](CHANGELOG.md).

**Forma de trabajo:** el cambio más pequeño que resuelve todo (*ponytail*): primero lo que ya existe en el proyecto, después lo que trae el navegador, y solo al final una dependencia nueva. Los componentes visuales salen del sistema de diseño; si falta algo, se agrega al componente y al artefacto, no se parcha con CSS en la app. Cada cálculo nuevo lleva su prueba y cada pantalla se recorre en el navegador con los archivos reales.

## Hechas

| Versión | Mejora | Cómo se hizo | Qué se usó |
| --- | --- | --- | --- |
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
2. **Barras horizontales** para estaciones con nombre largo (hoy el eje muestra una de cada n etiquetas; la tabla las lista todas). Va primero al sistema de diseño.
3. **Delta del RTY** y de «Recuperado en retest» (hoy solo entradas, FPY, Final y retest).
4. **DATA ANALYSIS y QM:** validación y match por serial + estación; Pareto 2do nivel por código de error.
5. **Cuentas reales** y el código de 6 dígitos (`LoginPanel defaultMode="code"`) cuando haya servidor.

## No relevante por ahora

- **Selector de tema claro/oscuro:** la app sigue al sistema operativo; `data-theme` ya lo permite si se pide.
- **Cambiar a SheetJS:** `read-excel-file` ya lee los archivos reales.
- **Guardar más de un archivo por tipo:** el historial guarda la lista; reabrir versiones viejas no se ha pedido.
- **Animaciones en las pantallas de trabajo:** el sistema las limita al login para que el dato se lea primero.
- **Horario de corte 08:00:** el TCQS solo trae la fecha, sin hora.
