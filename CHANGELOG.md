# Registro de versiones

Todas las versiones de **Yield Control**: la app (este repositorio) y su **sistema de diseño** (artefacto *Yield Control*). Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/): mientras sea `0.x`, una versión menor puede cambiar comportamiento.

Cada cambio dice en qué capa cae, en el orden en que se publica (de abajo hacia arriba):
**Fundamentos** (tokens) → **Componentes** (sistema de diseño) → **Cálculo** (`src/lib`) → **Pantallas** (`src/pages`).
Un cambio de componente se publica primero en el artefacto y después se copia a `src/components` y `src/styles/yc.css`.

Los errores encontrados y cómo se corrigieron están en [ERRORES.md](ERRORES.md); las mejoras y cómo se hicieron, en [MEJORAS.md](MEJORAS.md).

## [0.19.1] — 2026-11-10 · revisión de código

### Corregido
- **Historial duplicado al recargar:** el guardado ahora espera a saber si hay lista de modelos; antes, al recargar, guardaba una vez con todos los modelos (metía filas de otros proyectos) y otra con Juliet.
- **Borrar un registro borraba datos de otra carga con el mismo nombre de archivo:** cada fila del resumen guarda qué carga la escribió (`yield_resumen.carga`) y borrar o respaldar toca solo esas filas.
- **Base de datos borraba sin respaldo:** borrar una carga va por el mismo camino que Historial (respaldo automático de 7 días) y borrar un rango del resumen también deja respaldo.
- **Respaldos sin límite:** máximo 20 manuales por usuario a la vez (la cuenta demo es pública).
- **Respaldos vencidos** se purgan también al arrancar el servidor y al ver Base de datos, no solo al abrir Historial.
- **Comparativas:** revisa la carga que cubre todo el rango elegido (no la más reciente que lo toque) y sigue al último día del archivo cargado.
- **Yield:** el aviso «Guardado en el historial» ya no se queda del archivo anterior.
- **Validación:** la congruencia se calcula una vez por archivo, no en cada pintada.

## [0.19.0] — 2026-11-10

### Agregado
- **Comparativas · Datos que no cuadran:** cuántas filas no cuadran por columna en todo el archivo y los ejemplos guardados del rango elegido (fila, fecha, estación, valor del archivo y de la fórmula). Sin revisión para ese rango, pide cargar el TCQS. La congruencia ahora guarda el detalle de cada ejemplo, no solo el n.º de fila.
- **Comparativas por semana:** lunes a sábado (sin domingo) contra la semana anterior; al elegirla aparece el aviso «En desarrollo».
- **Carga:** «Cambiar archivo» y «Borrar archivo» (quita el archivo de la app; lo del historial no se toca).
- **Historial · respaldos** (tabla `yield_respaldos`): «Crear respaldo» en cada registro y «Borrar» (administradores), que antes crea un respaldo automático. Los respaldos vencen a los 7 días; se pueden **descargar** (.json), **restaurar** y **cargar** de nuevo desde el archivo (el servidor lo valida como una carga nueva).

### Cambiado
- **Yield → historial:** la carga se guarda en el historial aunque no haya lista de modelos (antes se esperaba al BOM y no se guardaba nada); Yield muestra «Guardado en el historial» con enlace.
- `HistoryList` acepta `extra` (más acciones por fila).

## [0.18.0] — 2026-11-10

### Agregado
- **Congruencia del TCQS** (no se muestra): al guardar cada carga se compara fila por fila el archivo con las fórmulas —entradas = 1er pase + 1ra falla, FPRATE = 1er pase / entradas, RETESTRATE = 2do pase / entradas, FINAL_YIELD_RATE = (1er + 2do pase) / entradas topado a 100 %, 2da falla (REFAIL_QTY) = 1ra falla − 2do pase— y el resultado (filas que cuadran, que no y ejemplos) se guarda en `yield_cargas.congruencia`. El servidor lo anota en su registro si algo no cuadra (la 2da falla no cuenta: los retests de otro día la descuadran). Con el TCQS real: 179/179 filas de Juliet cuadran en FPY, retest, Final y entradas.
- **Validación · Estimado real:** FPY, retest y Final con las fórmulas de la guía junto a lo que reportan las columnas del archivo (ponderadas por entradas) y la diferencia en puntos.
- **Comparativas** (menú): un día contra el día anterior, los dos leídos de la base; KPIs con ▲/▼ y tabla por estación con el cambio de FPY y Final. Si falta alguno de los dos días (nunca se cargó o se borró), lo dice y lleva a Carga.

## [0.17.0] — 2026-11-10 · sistema de diseño v26

### Agregado
- **Fondo 3D en el login** (three.js): una línea de producción abstracta; las unidades pasan por cinco estaciones y se encienden en verde (pasa) o naranja (primera falla; se recuperan en la estación siguiente, como el retest). Reemplaza la gráfica de barras de la franja inferior; las tarjetas y el formulario no cambian.
- Sin costo para la app: three.js va en un archivo aparte (118 KB comprimido) que se descarga solo en /login y después de pintar el formulario; el arranque sigue en ~128 KB.
- Colores de los tokens (claro y oscuro), resolución máxima 1.5×, se pausa con la pestaña oculta y se quita al entrar. Con «reducir movimiento» o sin WebGL queda la ilustración 2D de antes (y three.js ni se descarga).

### Sistema de diseño
- `ChartCarousel` con el rebote y el gesto rápido de 0.16.0; README de `LoginPanel` con las reglas del fondo 3D.

## [0.16.0] — 2026-11-10

### Agregado
- **Ampliar con transición:** en Gráficos la tarjeta se convierte en el panel ampliado y regresa a su lugar al cerrar (botón o Esc), con View Transitions del navegador: 0 KB extra. Sin soporte o con «reducir movimiento», abre y cierra al instante como antes.
- **Carrusel con rebote:** un arrastre corto regresa a su lugar con un rebote suave (antes saltaba); un gesto rápido de 20 px o más cambia de gráfica aunque no llegue a 60 px.

## [0.15.1] — 2026-11-10 · sistema de diseño v25

### Corregido
- **Órdenes en «Entradas»:** también en **Yield** (y en el HTML y el PDF), no solo en Inicio.
- **Órdenes desde la base:** lo abierto desde Historial mostraba solo entradas porque la base no guardaba órdenes. Ahora `yield_resumen.ordenes` guarda las órdenes de cada día × modelo × estación y se cuentan sin repetir (`countOrders`). Las cargas guardadas antes de esta versión no las traen: vuelve a cargar el TCQS una vez para completarlas.

### Sistema de diseño
- `Badge` con `title` (explicación al pasar el mouse, subrayado punteado), en código, tipos, README y vista previa.

## [0.15.0] — 2026-11-09

### Agregado
- **Gráficos · Ampliar:** cada gráfica abre en pantalla dividida: la gráfica grande (fija al bajar), la tabla con los datos que dibuja (Pareto con % y % acumulado, estaciones, periodos, testers) y **comentarios** guardados en la base (tabla `yield_comentarios`, por gráfica y rango de fechas, firmados por el servidor). Se cierra con Esc o «Cerrar».
- **Descargar imagen (PNG):** el mismo panel —gráfica, resumen y comentarios, con el diseño y las fuentes— a doble resolución, sin botones ni formulario. `html-to-image`, cargado solo al descargar.
- **Inicio:** «Entradas / órdenes»: entradas y órdenes distintas (MO_NUMBER, sin repetir) del archivo. Lo abierto desde la base no trae órdenes y muestra solo entradas.

### Cambiado
- «Muestra insuficiente» → **«Datos insuficientes»**, subrayado punteado; al pasar el mouse explica que los datos del archivo no bastan para un muestreo completo (menos de 10 entradas). `Badge` acepta `title`.
- CSP: `base-uri 'self'` (antes `'none'`), necesario para incrustar las fuentes en la imagen.

## [0.14.0] — 2026-11-09 · sistema de diseño v24

### Agregado
- **Modelos de Juliet en la base** (tabla `yield_modelos`): un administrador sube el Excel del BOM una vez en **Base de datos** y la lista filtra el TCQS de todos. Ya no se carga en cada sesión; Carga solo pide el TCQS.
- **Reporte HTML con todos los modelos:** lista «Modelo» arriba; cada modelo trae sus KPIs, carrusel y tabla del mismo periodo. Abre con el modelo que se veía en pantalla.

### Cambiado
- **FPY y Final Yield por estación apaisada:** columnas a lo ancho en pantallas anchas; en el celular (≤ 760 px) barras acostadas con el nombre completo. Las páginas usan hasta 1600 px.
- Nombres largos del eje X (estaciones, testers) se inclinan en vez de saltarse (barras y Pareto).
- Los textos de la app dicen «la base» en vez de «Neon»: funciona con cualquier PostgreSQL.
- Menú en el celular: los enlaces no se parten en dos líneas.
- Sistema de diseño (v23–v24): BarChart y ParetoChart con etiquetas inclinadas, README de BarChart con el patrón apaisada/acostada, vista previa de la Pantalla de Yield responsiva y menú sin cortes. Vistas previas revisadas en el navegador a 1200 y 390 px.

## [0.13.0] — 2026-11-09 · sistema de diseño v22

### Agregado
- **MFA (TOTP):** códigos de 6 dígitos de una app autenticadora (RFC 6238, `node:crypto`, probado con los vectores del estándar). Obligatorio para administradores; opcional para los demás. Login en dos pasos con ticket de 5 min.
- **Seguridad** (`/seguridad`, desde el chip de usuario): cambiar contraseña (mínimo 12) y configurar MFA con QR o clave escrita. Con contraseña temporal o administrador sin MFA, la app y la API solo permiten esto.
- **Cuentas:** crear cuentas con contraseña temporal al azar, editar nombre, activar/desactivar, restablecer contraseña, quitar MFA; el **super administrador** (cuenta principal) además da o quita el rol de administrador y borra cuentas.
- **Base de datos** (`/base`, administradores): espacio usado y porcentaje del plan gratis de Neon, filas y espacio por tabla, exportar el resumen a CSV, historial de cargas; el super administrador borra cargas, borra un rango del resumen y aplica retención (90/180/365 días). Archivos guardados en este equipo, con opción de borrarlos.
- **Logo:** cuadro `brand` con tres barras ascendentes; favicon y marca del menú y del login.
- La cuenta principal creada desde `ADMIN_PASSWORD` nace con contraseña temporal: pide cambiarla y configurar MFA al primer inicio.

### Cambiado
- Login: «cuenta desactivada» en vez de «pendiente».

## [0.12.0] — 2026-11-08

### Cambiado
- **Login:** vuelve la cuenta de prueba **demo / yield2026**, siempre activa. Con servidor es una cuenta real (se crea al arrancar) y usa Neon; sin servidor (sitio estático, sin base o sin conexión) entra en modo local, sin Neon.

### Quitado
- «Crear cuenta» en el login y `POST /api/signup`. Las cuentas se manejan desde Cuentas (administradores) y la cuenta principal desde Render.

## [0.11.2] — 2026-11-08

### Agregado
- **Servidor · `/api/salud`:** diagnóstico sin secretos (¿hay base?, ¿conecta?, estado de la cuenta principal, ¿`SESSION_SECRET` fija?). Se abre en el navegador.
- **Servidor:** al arrancar escribe en los logs qué hizo con la cuenta principal (activada, creada o no existe).

### Corregido
- **Login:** si el servidor responde HTML (sitio estático, página de error) o no hay conexión, la app lo dice en lugar de quedarse sin hacer nada.
- **Servidor:** una base que no responde al arrancar ya no tumba el proceso.

## [0.11.1] — 2026-11-08

### Cambiado
- **Cuenta principal (super administrador):** la de `ADMIN_USER`. Si ya existe (creada desde «Crear cuenta»), al arrancar queda activa y administradora con su propia contraseña; si no, se crea con `ADMIN_PASSWORD`. Ningún otro administrador puede desactivarla ni quitarle el rol; en Cuentas aparece como «Principal».

## [0.11.0] — 2026-11-08

### Agregado
- **Pantallas · Cuentas** (solo administradores): activar o desactivar cuentas y dar o quitar el rol de administrador. Hecha con `yc-table`, `Badge` y `Button`, sin componentes nuevos.
- **Servidor:** `GET/POST /api/usuarios` solo para administradores; nadie cambia su propia cuenta (evita quedarse sin administradores).

### Cambiado
- **Servidor:** cada llamada protegida revisa en la base que la cuenta siga activa y su rol: desactivar o quitar el rol vale al instante, aunque la cookie siga vigente.

## [0.10.0] — 2026-11-08

### Agregado
- **Servidor · cuentas reales:** tabla `usuarios`; contraseñas con `scrypt` y sal; sesión en cookie firmada (HMAC) `HttpOnly`, `SameSite=Strict`, `Secure` en Render, 12 h. `POST /api/login`, `/api/logout`, `/api/signup`, `GET /api/me`.
- **Servidor:** toda la API de datos exige sesión; el usuario y la sesión de cada carga los pone el servidor (ya no el navegador).
- **Servidor:** 5 intentos fallidos por dirección en 15 min bloquean el login; los POST solo aceptan JSON (junto con `SameSite`, frena CSRF); `/api/…` desconocido da 404.
- **Servidor:** cabeceras de seguridad: CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS en Render.
- **Primer administrador** desde `ADMIN_USER` / `ADMIN_PASSWORD`; «Crear cuenta» deja la cuenta pendiente hasta que la active el encargado.
- **Pantallas · Login:** entra contra el servidor; al vencer la sesión la app vuelve al login.

### Quitado
- Usuario de prueba (`demo` / `yield2026`) y la lista local de solicitudes.

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
