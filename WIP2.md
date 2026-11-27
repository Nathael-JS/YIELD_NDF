# WIP · fase 2: ruta, filtros, unidades y hora por hora (plan, 27 nov)

Sigue a [WIP.md](WIP.md) (W1–W7 terminados). Todo va a **un solo PR**, que se fusiona al final.

## Pedido

1. **Versiones:** actualizar frameworks, librerías y módulos, y **optimizar el sistema**.
2. **`BASE_DE_DATOS.md`:** despliegue de la base en PostgreSQL, con la guía de referencia como modelo.
3. **Dashboard con un WIP de una sola orden:** verificar que funcione. Filtros por **orden, modelo y estación**.
4. **«Dónde están · por etapa»** con la **ruta** de las imágenes:
   - la línea principal de estaciones en orden;
   - las reparaciones `R_` debajo de su estación;
   - los retornos de reparación a otra estación.
   Se ve **junto** con la separación por Process Stage y Board, sin perder lo que ya hay.
5. **Paneles con sus unidades:** En proceso, Bloqueadas, Urgentes y Terminadas abren la lista de unidades, en **Yield, WIP y el Dashboard**.
6. **Filtro por Process Stage y Board** (de la estructura de yield W48) en WIP y el Dashboard.
7. **«Flujo por estación» mejorado:**
   - minimalista;
   - separado por Process Stage y Board;
   - con el ícono de semáforo;
   - un clic lleva a esas unidades.
8. **Hora por hora:** los cambios de unidades por estación, siguiendo el flujo.

## Datos revisados

- **`wip_unico.xlsx`:** 97 piezas de una orden (127526, modelo SA029400, sección SI).
  - Trae `GROUP_NAME` (la estación anterior) y `NEXT_STATION`.
  - Su cadena `GROUP_NAME` → `WIP_GROUP` da tramos de la ruta, por ejemplo FATP_VI → KANBAN_IN y WC_PRESSURE → WC_WATER_FILL → FT.
- **Estructura W48:** para SA029400 solo trae las **7 estaciones con yield**:
  - SYS_ASSY_VI, J_TAG, FRONT_PANEL_VI, FT, FATP_VI, PRESSURE_TEST y LEAKAGE_CHECK;
  - todas en System Level → Final Assy.
- **La ruta de las imágenes tiene 21 estaciones,** de ASSY_SA_SWB a STOCKIN, con 18 reparaciones `R_`. La estructura de yield sola no alcanza para dibujarla. **Decisión:** se guarda una **ruta por modelo** que se arma con tres fuentes:
  1. la estructura de yield (el orden y la etapa);
  2. lo que cada WIP por orden enseña (`GROUP_NAME` → `WIP_GROUP`, y `R_X` con su estación de regreso);
  3. una edición a mano en Base de datos.
  La de SA029400 se siembra con las imágenes.

## Dirección visual (`/creative`, nivel L2: dentro del sistema de diseño, sin tokens nuevos)

**Tema:** *preciso, calmado, legible en piso*. Es una línea de metro de planta:
- la línea principal es un riel con nodos;
- las reparaciones cuelgan debajo;
- el color **solo** significa tiempo (el semáforo), nunca decoración.

| Pieza | Composición | Del sistema |
|---|---|---|
| Mapa de ruta | Bandas de **Process Stage** y **Board** arriba, como encabezados que abarcan sus estaciones. Debajo, el riel con un nodo por estación (`UnitIcon` con su conteo) y la fila de reparaciones. Los retornos son líneas finas en SVG. Con muchas estaciones hay scroll horizontal dentro de la tarjeta, nunca de la página; en celular se muestra como lista vertical. | `UnitIcon`, `--sem-*`, `--line`, `.yc-card` |
| Vista por etapa | Se queda el `FlowMap` actual (columnas Stage → Board) para **todos los modelos**. Al elegir un modelo, o con un WIP de una sola orden, aparece el **mapa de ruta** de ese modelo debajo: las dos vistas juntas. | `FlowMap` |
| Flujo por estación | Una fila por estación, agrupada por Stage → Board. Cada fila: nombre, total, 4 `UnitIcon` (menos de 2 h, de 2 a 20 h, de 20 a 100 h, urgente), cada uno con su conteo y que abre sus seriales, y la pieza más vieja. La línea de tiempo de burbujas queda detrás de su botón, más ligera. | `UnitIcon`, `Seriales` |
| Hora por hora | Tabla de estaciones en orden de ruta × las últimas 12 horas. La celda es cuántas piezas llegaron en esa hora, con intensidad neutra (no semáforo) y el número escrito; un clic abre sus seriales. Con varios cortes en el día se agrega la fila del cambio de un corte a otro. | `.yc-table`, `Seriales` |
| Paneles con unidades | `KpiTile` se vuelve botón cuando tiene `onClick` (foco visible y `aria-label`) y abre la ventana de seriales. | `KpiTile` (variante nueva) |

## Revisión de diseño (`/design-review`, L2) de lo que hay hoy

**Qué funciona:**
- la escala logarítmica pone minutos y semanas en la misma línea;
- respeta «reducir movimiento»;
- el conteo por estación se lee a la izquierda;
- el `FlowMap` ya usa el semáforo y abre los seriales.

| # | Prioridad | Dónde | Problema | Arreglo |
|---|---|---|---|---|
| 1 | P1 | Línea de tiempo | Las burbujas no se pueden tocar: solo el nombre de la estación abre algo | Cada marca es un botón que abre los seriales de ese rango |
| 2 | P1 | Línea de tiempo | Agrupa por sección del MES (SMT, TEST), no por Process Stage y Board como el Dashboard | Agrupar con la estructura de flujo, igual que `flujoDe` |
| 3 | P1 | Línea de tiempo | El tamaño de la burbuja es el único dato de cantidad: no se lee el número | Escribir el conteo; `UnitIcon` en lugar de círculo |
| 4 | P1 · a11y | Línea de tiempo | Las burbujas no tienen foco y solo se distinguen por color | Botones con `aria-label` («GLUING · 20 a 100 h: 4 piezas») |
| 5 | P2 | Línea de tiempo | Las zonas de fondo, rojas en 3/4 del ancho, pesan más que los datos | Zonas como marcas finas en el eje, no como fondo |
| 6 | P2 | Leyenda | La leyenda usa `UnitIcon` y las marcas son círculos | Un solo lenguaje: `UnitIcon` |
| 7 | P2 | Dashboard | «Dónde están» no muestra la ruta ni las reparaciones junto a su estación | Mapa de ruta (R3) |
| 8 | P3 | Movimiento | El retraso escalonado llega a ~0.6 s con muchas estaciones | Tope de 0.25 s |

## Fases

| Fase | Qué | Cómo se verifica |
|---|---|---|
| **R0** · 0.51 | **Versiones y optimización.** React 19, Vite 8, TypeScript 7, plugin-react 6, three 0.187, motion 14.14 y parches. Servidor: Brotli en los archivos de la app, caché de un año en `assets/` (llevan hash) y gzip en las respuestas JSON grandes. **`BASE_DE_DATOS.md`.** | Build, pruebas, Playwright (login 3D, PDF, Dashboard), `curl` de cabeceras |
| **R1** · 0.52 | **Filtros comunes** en Dashboard y WIP: Process Stage, Board, Modelo, Orden y Estación. La etapa y el board de cada pieza salen de `lugarDe()`, la misma regla que `flujoDe`. Verificar el Dashboard con `wip_unico.xlsx`. | Prueba de `lugarDe`; Playwright con el WIP total y el de una orden |
| **R2** · 0.53 | **Paneles con unidades:** `KpiTile` con `onClick`. Dashboard y WIP: En proceso, Bloqueadas, Urgentes y Terminadas. El corte guarda también las **terminadas** en forma compacta (serial, modelo, orden, hora), para verlas sin el archivo. Yield: la primera falla abre los seriales de FirstFail (si está cargado) y los demás paneles abren su tabla por estación. | Validación del corte, prueba y Playwright |
| **R3** · 0.54 | **Ruta por modelo:** tabla `wip_rutas` (modelo, estaciones, retornos), `GET/POST /api/wip/rutas` y aprendizaje desde cada WIP por orden. Edición en Base de datos; SA029400 sembrada con las imágenes. **`RouteMap`** en el Dashboard junto al `FlowMap`. | Prueba del armado de la ruta; Playwright con `wip_unico.xlsx` |
| **R4** · 0.55 | **Flujo por estación** nuevo (filas Stage → Board con 4 `UnitIcon`) y la línea de tiempo más ligera (hallazgos 1–6 y 8). | Playwright: clic en cada ícono, teclado, 390 px |
| **R5** · 0.56 | **Hora por hora** (`/wip/horas`) | Prueba del agrupado por hora; Playwright |
| **R6** | **Sistema de diseño:** `KpiTile` con `onClick`, `RouteMap` y las filas de flujo, con README, tipos y vista previa (`/ds-make`). Sincronizar el artifact. | Vista previa del sistema de diseño |
| **R7** | `/code-review` del PR, `MEJORAS.md`, `CHANGELOG.md` y `WIP.md` | — |

**Lo que no se hace:**
- **`/map-design`:** el sistema de diseño ya existe (L2) y está documentado en el artifact; un `DESIGN.md` aparte lo duplicaría.
- **`/figma-setup`:** el conector de Figma no conecta desde esta sesión. El diseño se trabaja con el sistema de diseño y capturas.

## Pendientes que siguen de WIP.md

- Turno de 22:30 a 07:00.
- Carga inteligente (ML), en pausa.
