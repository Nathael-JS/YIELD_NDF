# WIP · plan del dashboard

El área WIP ya tiene: carga (general o por orden, uno o varios archivos), validación, la página **WIP** (flujo por estación, ruta, filtros, vista por orden, línea de tiempo), descargas en HTML y PDF, y el **historial** en la base desde la 0.43 (`wip_cortes`: un corte por carga con su resumen por estación × modelo, sin seriales).

El **dashboard** es la vista de un vistazo: cuánto hay, dónde se acumula, desde hace cuánto y si va subiendo o bajando. La página WIP se queda como el detalle (pieza por pieza).

## Dónde va

- Nueva vista **Dashboard** en el riel derecho de WIP, la primera, como «Inicio» en Yield.
- Funciona **con el WIP cargado** (el estado de ahora) y **con el historial** (la tendencia). Sin archivo cargado muestra el último corte de la base.

## Contenido

| # | Bloque | Qué muestra | De dónde sale | Componente |
| --- | --- | --- | --- | --- |
| 1 | **KPIs** | En proceso (con el cambio contra el corte anterior), bloqueadas, urgentes (> 100 h), horas promedio, terminadas | Archivo + último corte | `KpiTile` (ya existe) |
| 2 | **Semáforo de antigüedad** | Piezas < 2 h · 2–20 h · 20–100 h · > 100 h | Archivo (`nivel`, `urgente`) | `SplitBar` (ya existe) |
| 3 | **Dónde se acumula** | Top 10 estaciones por piezas, en el orden de la ruta | Archivo (`stations`) | `BarChart` horizontal (ya existe) |
| 4 | **Por estado** | Línea · Hold · Reparación · Bonpile | Archivo (`estadoOf`) | `SplitBar` |
| 5 | **Por modelo** | Piezas en proceso por modelo | Archivo | `BarChart` |
| 6 | **Tendencia** | En proceso y bloqueadas por corte (últimos 30 días) | Historial | `TrendChart` (ya existe) |
| 7 | **Qué cambió** | Estaciones que más subieron o bajaron contra el corte anterior | Historial (dos resúmenes) | Tabla `yc-table` |
| 8 | **Críticas** | Las 10 piezas más viejas o bloqueadas, con enlace a la página WIP | Archivo (`criticas`) | `UnitTable` (ya existe) |

- **Filtro por modelo** arriba: cambia todos los bloques.
- Clic en una estación (bloque 3 o 7) abre la página WIP filtrada en esa estación.
- Todo usa componentes del sistema de diseño que ya existen; no hace falta uno nuevo.

## Fases

| Fase | Qué | Archivos |
| --- | --- | --- |
| **D1** | `tablero(ps)`: KPIs, semáforo, top estaciones, por estado y por modelo, como función pura con prueba | `src/lib/wip.ts` |
| **D2** | Página **Dashboard** con los bloques 1–5 y 8, y el filtro por modelo | `src/areas/wip/Dashboard.tsx`, `src/areas.ts`, `src/main.tsx` |
| **D3** | Tendencia: el listado de cortes trae también las bloqueadas (suma del resumen, en SQL) y se grafica | `server/index.js`, `Dashboard.tsx` |
| **D4** | Qué cambió por estación contra el corte anterior | `Dashboard.tsx` |
| **D5** | Sin archivo cargado: el dashboard se arma con el último corte de la base. Revisión de diseño y accesibilidad | `Dashboard.tsx` |

## Por confirmar

- **Umbrales:** hoy verde < 2 h, naranja < 20 h, rojo ≥ 20 h y «urgente» > 100 h (`nivel` y `urgente` en `src/lib/wip.ts`). ¿Siguen así?
- **Tendencia:** ¿últimos 30 días está bien, o por turno o semana?
- **¿El dashboard debe ser la vista de entrada de WIP** (al elegir el área), en lugar de Carga?
