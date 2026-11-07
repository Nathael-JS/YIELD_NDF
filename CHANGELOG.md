# Registro de versiones

Todas las versiones de **Yield Control**: la app (este repositorio) y su **sistema de diseño** (artefacto *Yield Control*). Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/): mientras sea `0.x`, una versión menor puede cambiar comportamiento.

Cada cambio dice en qué capa cae, en el orden en que se publica (de abajo hacia arriba):
**Fundamentos** (tokens) → **Componentes** (sistema de diseño) → **Cálculo** (`src/lib`) → **Pantallas** (`src/pages`).
Un cambio de componente se publica primero en el artefacto y después se copia a `src/components` y `src/styles/yc.css`.

Los errores encontrados y cómo se corrigieron están en [ERRORES.md](ERRORES.md); las mejoras y cómo se hicieron, en [MEJORAS.md](MEJORAS.md).

## [0.9.0] — 2026-11-08 · sistema de diseño v21

### Agregado
- **Servidor:** tabla `yield_cargas` (una fila por carga: sesión, usuario, archivo, rango y totales), `GET /api/cargas` y `GET /api/resumen?desde=&hasta=`. El resumen y la carga se guardan en una sola transacción.
- **Pantallas · Neon en directo:** con el TCQS y el BOM cargados, el resumen se guarda solo, una vez por carga (no se repite al recargar la página). Validación muestra el estado.
- **Pantallas · Historial:** las cargas de Neon agrupadas por sesión (cada inicio de sesión es una); *Abrir* lleva esa carga a Yield y *Ver todo el histórico* trae todo.
- **Pantallas · Login:** las gráficas del fondo siguen moviéndose cada 3.5 s (barras con `scaleY` y línea con transición de `d`); quietas con movimiento reducido.
- **Componentes · `ChartCarousel`:** se arrastra con mouse o dedo (la gráfica sigue al puntero) o se hace clic a un lado; también en el reporte HTML.
- **Componentes · `HistoryList`:** `action` (texto del botón) y `onBackup` opcional.

### Cambiado
- **Estado:** cada pantalla lee del almacén solo lo que usa (selectores de zustand), en lugar de todo el estado.

### Quitado
- Botones ‹ › del carrusel, el respaldo JSON del historial y el historial local (`history` en el almacén); `Guardar en Neon` manual.

## [0.8.0] — 2026-11-07 · sistema de diseño v20

### Agregado
- **Componentes · `BarChart`:** prop `horizontal`, una fila por estación con el nombre completo. Se usa en «FPY y Final Yield por estación».
- **Componentes · `ChartCarousel`:** la gráfica entra del lado al que se navega, las barras crecen y las líneas se dibujan; flechas ← → del teclado. Nada con `prefers-reduced-motion`.
- **Pantallas · Yield:** ▲/▼ también en RTY y «Recuperado en retest» (`change()` genérico).
- **Pantallas · Yield:** *Descargar reporte HTML*: un solo archivo con estilos, indicadores, carrusel de gráficas y buscador de estaciones; funciona sin internet.
- **Pantallas · Yield:** *Descargar PDF* (react-pdf): A4 de 2 páginas con resumen, estaciones a revisar, gráficas y tabla. Se carga solo al pedirlo.
- **Servidor (`server/`):** sirve la app y `/api/resumen` con Postgres/Neon (`pg`). Tabla `yield_resumen`: conteos por día × modelo × estación; la carga más reciente de cada combinación reemplaza a la anterior.
- **Pantallas · Validación:** *Guardar en Neon*. **Historial:** *Cargar histórico*, que entra como un TCQS y lo leen todas las pantallas.
- **Cálculo:** `daily()`, `fromDb()` y `toWatch()` en `src/lib/tcqs.ts`, con prueba de ida y vuelta.

### Cambiado
- **Render:** el sitio estático pasa a un servicio Node (`npm start`) con la variable `DATABASE_URL`.
- **Componentes · gráficas:** miden su ancho con `useEffect`, para poder dibujarse también a HTML estático.

## [0.7.0] — 2026-11-07

### Agregado
- **Pantallas · Yield:** selector *Periodo* (último día, semana o mes con datos, o *Todo el rango*). Los indicadores muestran ▲/▼ contra el periodo anterior; el retest que sube sale en rojo. Sin cambio si alguno de los dos periodos tiene menos de 10 entradas.
- **Cálculo:** `periodsOf` y `change` en `src/lib/tcqs.ts`, con prueba.
- **Pantallas · Datos:** el último archivo de cada tipo se guarda en el navegador (IndexedDB, `src/lib/saved.ts`) y vuelve al recargar. Se borra al salir.
- Este registro, [ERRORES.md](ERRORES.md) y [MEJORAS.md](MEJORAS.md).

### Cambiado
- **Pantallas · Historial:** el texto explica que el último archivo de cada tipo queda guardado hasta salir.

## [0.6.0] — 2026-11-07 · sistema de diseño v19

### Agregado
- **Componentes · `PipelineNav`:** prop `done` para marcar ✓ por estado real. Sin ella se comporta como antes.
- **Pantallas · Inicio:** las tarjetas de «Dónde mirar primero» abren `/yield#ESTACIÓN`, que resalta la fila (`aria-current`) y la lleva a la vista.

### Cambiado
- **Pantallas · Menú:** Carga se marca ✓ con el TCQS leído y Validación con filas válidas de Juliet, no por haber pasado por el paso.

## [0.5.0] — 2026-11-07 · sistema de diseño v17–18

### Agregado
- **Componentes · `LoginPanel`:** prop `backdrop` (ilustración detrás del formulario, oculta a lectores de pantalla).
- **Pantallas · Login:** ilustración animada (barras, línea de FPY, archivos que pasan a «Cargado»); una vez, quieta con `prefers-reduced-motion`.
- **Pantallas · Inicio:** landing con titular del FPY, indicadores, «Dónde mirar primero» y carrusel de gráficas.
- **Pantallas · Validación:** comprobaciones de la guía (fórmula 1, regla 2, fórmula 10).
- **Pantallas · Menú:** enlace a Inicio y chip de usuario con iniciales.

### Cambiado
- **Cálculo:** retest ponderado y nunca mayor que las primeras fallas, así FPY + Retest = Final Yield siempre (guía *YieldRateSFC y RetestRate*). Entradas 0 = sin dato («—»). Filas con entradas ≠ 1er pase + 1ra falla se apartan. «NDF» pasa a «Recuperado en retest» (fórmula 11).
- **Cálculo:** `MA016491/MA016492` del BOM cuentan como `SA016491/SA016492`: Juliet pasa de 192 a 208 filas.
- **Componentes · `PipelineNav`:** fijo arriba; en móvil los pasos van en una fila que se desliza.
- **Componentes · `.yc-login-hint`:** con fondo, para leerse sobre la ilustración.
- **Fundamentos · Movimiento:** la regla del sistema admite la ilustración del login; las pantallas de trabajo no se animan.

## [0.4.0] — 2026-11-07 · sistema de diseño v15–16

### Agregado
- **Cálculo:** lectura del TCQS, extracción de modelos del BOM, FPY, Final Yield, retest, RTY y diagnóstico (`src/lib/tcqs.ts`), verificados contra las tasas del propio archivo.
- **Pantallas:** Carga (TCQS + Excel de modelos), Validación (filas y modelos del proyecto), Yield (indicadores, tabla, tendencia día/semana/mes, Pareto), Gráficos con datos reales.

### Cambiado
- **Componentes · `ParetoChart`:** las etiquetas del eje X se espacian según la más larga.
- El flujo pasa a un solo archivo: Carga → Validación → Yield.

### Quitado
- Comparación y Match por columna llave (de 0.3.0) y los datos de ejemplo. DATA ANALYSIS y QM quedan pendientes, con llave serial + estación.

## [0.3.0] — 2026-11-07

### Agregado
- Validación y Match por una columna llave elegida entre las columnas en común (quitado en 0.4.0).

## [0.2.0] — 2026-11-07 · sistema de diseño v12–14

### Agregado
- **Componentes · `FileChip`:** zona de carga (`onFile`, `accept`, arrastrar y soltar).
- **Componentes · `LoginPanel`:** `children` para avisos debajo del formulario.
- Despliegue en Render (`render.yaml`): sitio estático con Node 22 y vistas previas por pull request.

## [0.1.0] — 2026-11-07

### Agregado
- Proyecto Vite + React 18 + TypeScript con los tokens (claro/oscuro) y los 15 componentes del sistema de diseño portados a TSX.
- Login con usuario de prueba, carga local de archivos (.xlsx/.csv), comparación inicial, gráficos e historial con respaldo.
