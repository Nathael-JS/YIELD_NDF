# Plan de trabajo — Yield Control

Basado en el sistema de diseño **Yield Control** (artefacto `RqMowPxsmEFcuTiJy8Ntxu`): tokens, 15 componentes `yc-*` y las pantallas de referencia *PantallaPrincipal* y *PantallaYield*. Todo corre en el equipo: sin servidor, los archivos se leen en el navegador.

## Stack

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Framework | React 18 + Vite 7 + TypeScript | Lo que pide el sistema de diseño (React 18) |
| Rutas | react-router-dom 7 | Un paso del flujo = una URL |
| Estado | zustand (persist → localStorage) | Sesión, periodo e historial sobreviven al recargar |
| Archivos | read-excel-file (.xlsx), papaparse (.csv) | Lectura local, mantenidos y sin vulnerabilidades conocidas |
| Fuentes | @fontsource IBM Plex Sans/Mono | Sin depender de Google Fonts |
| Gráficas | SVG propio portado del sistema de diseño | Fiel a los tokens; sin librería de gráficas |
| Pruebas | `node --test` | Sin dependencia extra |

## Mapa pantalla → componentes

| Ruta | Pantalla | Componentes | Estado |
| --- | --- | --- | --- |
| `/login` | Login + usuario de prueba | `LoginPanel`, `Badge` | Hecho |
| `/` | Inicio (landing) | `PipelineNav`, `KpiTile`, `ChartCarousel`, `ParetoChart`, `BarChart`, `Histogram`, `ScatterPlot`, `FileChip` | Hecho con datos de ejemplo |
| `/carga` | Carga de datos | `PeriodTabs`, `FileChip` (zona de carga), `Button` | Hecho |
| `/comparacion` | Comparación | `.yc-table`, `Badge` | Inicial: resumen y columnas en común |
| `/validacion` | Validación | — | Pendiente (fase 2) |
| `/match` | Match | — | Pendiente (fase 2) |
| `/muestra` | Muestra (Yield del periodo) | Ver *PantallaYield* | Pendiente (fase 3) |
| `/graficos` | Gráficos | Las 5 gráficas + `TrendChart` con meta | Hecho con datos de ejemplo |
| `/historial` | Historial | `HistoryList` + respaldo JSON | Hecho |

## Fases

1. **Base (hecha).** Proyecto, tokens claro/oscuro, componentes portados, login con usuario de prueba, carga local de los 3 archivos, historial con respaldo.
2. **Reglas de los archivos.** Definir con ejemplos reales las columnas de TCQS, DATA ANALYSIS y QM (serial, estación, resultado, error code, fecha). Con eso: Validación (columnas obligatorias, tipos, duplicados) y Match (cruce por serial + estación, diferencias con `Badge warn`).
3. **Cálculos.** FPY, Final Yield, RTY por grupo, WIP, NDF y Pareto 1er/2do nivel desde los archivos. Reemplazar `src/data/demo.ts` y quitar el aviso «Datos de ejemplo». Pantalla Muestra según *PantallaYield* (metas con `targets`, tabla con diagnóstico).
4. **Periodo.** Día / Semana / Mes filtran los datos cargados; delta de KPIs contra el periodo anterior.
5. **Persistencia de datos.** Guardar las filas en IndexedDB para que el historial pueda reabrir una comparación (hoy solo guarda la lista).
6. **Cuentas.** Si llega un servidor: autenticación real, validación de cuentas por el encargado y paso de código de 6 dígitos (`LoginPanel defaultMode="code"`).

## Para el sistema de diseño

- `LoginPanel` recibe `children` (avisos debajo del formulario). Se usó para la ayuda del usuario de prueba y el aviso de solicitud enviada. Propuesta: subirlo al artefacto.
- `FileChip` es solo visual; la app lo envuelve en un `<label>` con `<input type=file>` y arrastrar-soltar. Propuesta: variante interactiva en el sistema.
- La marca del menú (`yc-nav-mark`) es un botón que lleva a Inicio.
- Sin selector de tema: se sigue el del sistema operativo (`prefers-color-scheme`); `data-theme` en `<html>` lo fuerza.

## Verificación hecha

- `npm run build` (tipos + build) y `npm test` (escalas de gráficas, lector de CSV, columnas en común).
- Flujo en navegador: login con error y correcto, carga de CSV válido e inválido, comparación, respaldo, recarga con sesión, salir, tema oscuro y móvil (390 px sin scroll horizontal), sin errores de consola.
