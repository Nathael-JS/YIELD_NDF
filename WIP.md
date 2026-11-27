# WIP · plan: Dashboard, Histórico y mejoras de la vista WIP

> **Terminado (W1–W7, 27 nov):** versiones 0.44 a 0.50, en los PR 35 y 36. Lo que queda abierto está en «Pendientes» al final.

El área WIP ya tiene: carga (general o por orden, uno o varios archivos), validación, la página **WIP** (flujo por estación, ruta, filtros, vista por orden, línea de tiempo), descargas en HTML y PDF, e **historial** en la base desde la 0.43 (`wip_cortes`: un corte por carga).

## Decisiones (27 nov)

1. **Umbrales sin cambio:** verde < 2 h · naranja < 20 h · rojo ≥ 20 h · urgente > 100 h (`nivel` y `urgente` en `src/lib/wip.ts`).
2. **Semáforos con detalle:** al tocar un semáforo se abre una ventana con la lista de seriales y su tiempo.
3. **Tendencia por turno y por semana.** Turno 1 = 07:00–15:00 y Turno 2 = 15:00–22:30, según la hora del corte. La semana es ISO, como en Yield.
4. **El área WIP abre en el Dashboard**, antes que en Carga, con el **último documento guardado** en la base.
5. **Botón y vista nuevos, «Histórico»:** los cambios entre cortes, según la fecha y hora de subida, y una **comparativa** entre dos cortes.
6. **Botón y vista nuevos, «Dashboard»:** el flujo de las unidades armado con la estructura del archivo de yield (**Process Stage → Board → Model → Station**). Es simple, para que lo lean los empleados de producción.
7. **Vista WIP:** los semáforos se cambian por un **ícono de producto** con los mismos colores y la animación de urgente, unido a la ventana del punto 2.
8. **Gráficos en el Dashboard:** Pareto y barras por modelo, serial, orden, tiempo en la estación y última estación registrada.

### Confirmado (27 nov)

- **Se guardan seriales y corte:** el corte llevará las piezas (W2).
- **Diseño aprobado,** con `FlowMap` y `UnitIcon` como componentes nuevos del sistema de diseño (W7).
- **Historial** = archivos cargados (la vista de hoy) · **Histórico** = los cambios entre cortes y la comparativa.
- **De 22:30 a 07:00 queda pendiente:** el botón de ese turno se ve, pero inactivo.

## Revisión de diseño (`/design`, nivel L2: hay sistema de diseño)

### Patrones y componentes que ya existen

| Necesidad | Componente del sistema | Variante |
| --- | --- | --- |
| Números grandes del Dashboard | `KpiTile` | con `delta` contra el corte anterior |
| Semáforo de antigüedad (cuántas en verde, naranja y rojo) | `SplitBar` | partes `pass` · `second` · `fail` · `ndf` |
| Ventana de seriales | Diálogo de la app (`dialog.app-det`, el de Pallets) | lista compacta en `yc-table` |
| Turno o semana · Dashboard u Histórico | `Segmented` | 2–4 opciones a la vista |
| Tendencia | `TrendChart` | barras (en proceso) + línea (bloqueadas) |
| Dónde se acumula / por modelo / por orden | `BarChart` | `horizontal` para nombres largos |
| Pareto | `ParetoChart` | `level` 1 = estaciones, 2 = por estación, con `onPick` |
| Tiempo en la estación | `Histogram` | `tone` por nivel |
| Lista de cortes y comparativa | `HistoryList` + `yc-table` | `action="Comparar"` |

### Faltan en el sistema de diseño (requieren tu aprobación, se crean con `/ds-make`)

| Falta | Para qué | Por qué no alcanza lo que existe |
| --- | --- | --- |
| **`FlowMap`** | El flujo Process Stage → Board → Station con las unidades en cada estación: columnas por etapa, una tarjeta por board, estaciones en orden con su conteo y su color | `FlowTable` (página WIP) es una tabla y `BarChart` no muestra la jerarquía. Hace falta un componente visual de flujo |
| **`UnitIcon`** | El ícono de producto que reemplaza al semáforo: mismo color por nivel, pulso si es urgente, y clic que abre la ventana de seriales | Hoy el semáforo es un punto de CSS dentro de `FlowTable`; no hay un ícono con esos estados |

Sin aprobación hay un camino interino sin componentes nuevos: `FlowMap` se arma como columnas de `yc-card` con `Badge`, y `UnitIcon` como `Badge` con su tono. Funciona, pero se ve menos claro para piso.

### Heurísticas

| Heurística | Riesgo | Ajuste |
| --- | --- | --- |
| Visibilidad del estado | Sin archivo, el Dashboard muestra datos viejos | Arriba se ve siempre «Último corte: 2026-11-27 10:15 · Turno 1 · hace 2 h», con color si es viejo (como Conexión con WIP) |
| Reconocer antes que recordar | Los nombres de estación del MES (`WC_KIT_PRESSURE`) son largos | En `FlowMap` va el nombre completo en mono y el board como encabezado |
| Diseño minimalista | 8 bloques más los gráficos es demasiado para piso | Dashboard = flujo + KPIs + semáforo. Los gráficos van en una sección aparte («Gráficos»), abajo o en una pestaña |
| Accesibilidad | Color e ícono que late | Ícono + número + texto («12 urgentes»); el pulso respeta «reducir movimiento» |

## Datos

- **W6 (0.49):** en **WIP · piezas**, la barra de colores de cada estación pasa a ser hasta 3 **íconos de producto** (< 2 h, < 20 h, ≥ 20 h) con su conteo.
  - El rojo late si hay urgentes, y cada ícono abre la **ventana de seriales** de ese nivel (la misma del Dashboard, ahora en `wipParts.tsx`).
  - El punto de color del tiempo (`Hours`) y la leyenda también usan el ícono.
  - El reporte HTML lleva los mismos íconos, sin JavaScript.
- **W5 (0.48):** nueva vista **Histórico** (`/wip/historico`, botón en el riel derecho).
  - **Tendencia** por **turno** o por **semana**, con el último corte de cada uno (cómo cerró): barras de piezas en proceso y línea de bloqueadas.
  - Filtro de turno **Ambos · T1 · T2**. El de **22:30–07:00** está visible pero inactivo (pendiente), y esos cortes no entran en la tendencia por turno.
  - **Comparativa de dos cortes:** «Antes» y «Después», el total y el cambio, y una tabla por estación con el cambio y las bloqueadas.
  - El **Historial** sigue siendo la lista de archivos cargados.
  - `tendencia()` y `cambioPorEstacion()` en `src/lib/wip.ts`, con prueba. El listado de cortes trae las bloqueadas, sumadas en SQL desde el resumen.
- **W4 (0.47):** sección **Gráficos** en el Dashboard, con un selector «Por».
  - Pareto por estación, modelo, orden y última estación.
  - Barras por rango de tiempo en la estación, de «< 2 h» a «> 2 sem».
  - Los 20 seriales con más tiempo.
  - Junto a cada gráfico, una tabla con «Ver» (sirve también con teclado). Clic en una barra o en «Ver» abre los seriales.
  - `agrupar()` en `src/lib/wip.ts`, con prueba.
  - **«Última estación» necesita `GROUP_NAME`,** que solo trae el reporte WIP por orden; con el WIP general se muestra un aviso.
- **W3 (0.46):**
  - **Entrar a WIP abre el Dashboard** (`/wip`), con el último corte de la base (o el WIP del equipo si no hay base). La página pieza por pieza pasa a `/wip/piezas`.
  - **Encabezado:** corte, turno, semana, hace cuánto y archivo.
  - **KPIs:** en proceso (con el cambio contra el corte anterior), bloqueadas, urgentes, tiempo promedio y terminadas.
  - **Semáforo:** barra e íconos en los colores del semáforo; cada ícono abre sus seriales.
  - **`FlowMap`:** Process Stage → Board → estación; cada estación abre sus seriales.
  - **Dónde se ubica cada pieza:**
    - Las **reparaciones y holds** (`R_…`, `HOLD-…`) van junto a su estación.
    - Las **estaciones que el reporte de yield no trae** (`LINK_CARRIER_B`, `KANBAN_IN`…) van al board de su modelo.
    - Con el WIP real, «Sin etapa» bajó de 1,118 a 61 piezas.
- **W2 (0.45):** el corte guarda sus **piezas en proceso** (`detalle`: serial, modelo, orden, estación, estación anterior, llegada, horas y bloqueada). Con el WIP real de 2,065 piezas ocupa 51 KB en la base. Los cortes de antes de 0.45 vienen con la lista vacía. `turno()` da T1 de 07:00 a 15:00, T2 de 15:00 a 22:30 y «pendiente» de 22:30 a 07:00; `semana()` da la semana ISO.
- **W1 (0.44):** `readFlujo()` y `ubicar()` en `src/lib/wip.ts`, tabla `wip_flujo` (vale la más reciente), `GET/POST /api/wip/flujo` (solo un administrador la cambia) y una sección en **Base de datos** con la vista previa por etapa y board. Con el reporte de W48 salen 81 estaciones en 6 etapas.

- **Estructura de flujo (archivo de yield):** solo se usan sus columnas **Process Stage, Board Name, Model y Station**. Las celdas vacías heredan la de arriba, como en el Excel. Se carga una vez y se guarda como configuración, igual que los modelos de Juliet en Base de datos. Cada estación del WIP se ubica por **modelo + estación**; si no está en la estructura, va a un bloque «Sin etapa».
- **El Dashboard sin archivo** se arma con el último corte de la base. ⚠ Hoy el corte guarda **solo conteos**, sin seriales. La ventana de seriales y los gráficos por serial u orden necesitan las piezas. **Por confirmar:** guardar en el corte la lista de piezas (serial, modelo, orden, estación, última estación, horas y bloqueada), unas decenas de KB por corte, o que esa parte solo funcione con el archivo cargado.
- **Turno de un corte:** por su hora; T1 07:00–15:00 y T2 15:00–22:30. Un corte fuera de esos horarios va a «Fuera de turno».

## Novedades (0.50, pedido durante W6)

- **La campana de la barra superior** tiene un punto cuando hay una versión que todavía no has visto. Al abrirla muestra las últimas 8 versiones del `CHANGELOG.md` con el título de cada cambio, y marca «Nuevo» lo que llegó desde tu última visita.
- **Las notas técnicas no se muestran:** las viñetas con código y sin título en negritas.
- **La versión que ya viste** se guarda en el navegador.

## Fases

| Fase | Qué | Archivos |
| --- | --- | --- |
| **W1** ✅ 0.44 | Estructura de flujo: leer el archivo de yield (Process Stage, Board, Model, Station, con herencia de celdas), guardarla en la base y ubicar cada estación del WIP. Con prueba | `src/lib/wip.ts`, `server/` (tabla `wip_flujo`), Base de datos |
| **W2** ✅ 0.45 | Guardar las piezas en el corte y `turno()` y `semana()` del corte, con prueba | `server/`, `src/lib/wip.ts` |
| **W3** ✅ 0.46 | **Dashboard** (primera vista del área): encabezado del último corte, KPIs, semáforo (`SplitBar`) con ventana de seriales y **`FlowMap`** | `src/areas/wip/Dashboard.tsx`, `areas.ts` |
| **W4** ✅ 0.47 | **Gráficos** del Dashboard: Pareto (estaciones → por estación), barras por modelo y por orden, histograma de tiempo en la estación, y barras por última estación registrada. Cada barra abre los seriales | `Dashboard.tsx` |
| **W5** ✅ 0.48 | **Histórico:** tendencia por turno o semana (`TrendChart`), lista de cortes y **comparativa** de dos cortes (qué estación subió o bajó) | `src/areas/wip/Historico.tsx` (junta el Historial actual) |
| **W6** ✅ 0.49 | **Vista WIP:** `UnitIcon` en lugar del semáforo, con la ventana de seriales | `wipParts.tsx` |
| **W7** ✅ 0.50 | Sistema de diseño: `FlowMap` y `UnitIcon` (versión 42) y, en la 43, dónde se usa `UnitIcon`, el patrón «ventana de seriales» y cómo `FlowMap` ubica las piezas | artefacto |

## Por confirmar

1. **¿Guardamos las piezas (con seriales) en cada corte?** Así la ventana de seriales y los gráficos funcionan sin archivo cargado.
2. **¿Apruebas crear `FlowMap` y `UnitIcon`** en el sistema de diseño, o empezamos con el camino interino?
3. **¿«Histórico» reemplaza al «Historial» actual** de WIP (una sola vista), o conviven las dos?
4. **¿Qué pasa con los cortes de 22:30 a 07:00?** ¿Hay un tercer turno o van como «Fuera de turno»?

## Pendientes (después de W7)

- **Turno de 22:30 a 07:00:** hoy es «pendiente» (botón inactivo). Cuando se defina, se agrega en `turno()`.
- **«Última estación»** solo funciona con el reporte WIP por orden (trae `GROUP_NAME`).
- **Las 61 piezas en «Sin etapa»** son de modelos que el reporte de yield no tiene. Se ubican al cargar una estructura de flujo que los incluya.
- **Espacio:** cada corte con piezas ocupa unos 51 KB. Si un día hace falta, se puede borrar el detalle de los cortes viejos y dejar solo su resumen.
- **Carga inteligente (ML):** ver `ML.md`, en pausa.
