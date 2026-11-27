# Registro de versiones

Todas las versiones de **Yield Control**: la app (este repositorio) y su **sistema de diseño** (artefacto *Yield Control*). Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/): mientras sea `0.x`, una versión menor puede cambiar comportamiento.

Cada cambio dice en qué capa cae, en el orden en que se publica (de abajo hacia arriba):
**Fundamentos** (tokens) → **Componentes** (sistema de diseño) → **Cálculo** (`src/lib`) → **Pantallas** (`src/pages`).
Un cambio de componente se publica primero en el artefacto y después se copia a `src/components` y `src/styles/yc.css`.

Los errores encontrados y cómo se corrigieron están en [ERRORES.md](ERRORES.md); las mejoras y cómo se hicieron, en [MEJORAS.md](MEJORAS.md).

## [0.43.0] — 2026-11-26

### Agregado
- **Historial de WIP en la base:**
  - Cada WIP que se carga guarda su **corte** con un resumen por estación × modelo: piezas en proceso, bloqueadas y horas promedio y máxima. **No guarda seriales.**
  - El mismo archivo con el mismo corte no se duplica.
  - Si no hay conexión, el WIP se sigue usando en el equipo, con aviso.
- **Página Historial de WIP:**
  - Muestra los cortes por día, con las piezas en proceso, el **cambio contra el corte anterior**, las terminadas, el archivo y quién lo subió.
  - **Ver** abre el resumen por estación × modelo.
  - Ya no dice «se activa al conectar la base de datos».
- Tabla `wip_cortes` y `GET/POST /api/wip/cortes`, con validación y prueba. `npm run check` revisa la tabla.

## [0.42.0] — 2026-11-26

### Cambiado
- **Etiquetas muestra todos los DN**, no solo los completos.
  - Los que faltan se ven como **vista previa**: sus etiquetas llevan el sello MUESTRA, dicen qué les falta y se pueden **editar**.
  - El PDF sigue saliendo solo cuando el DN está completo y con sus datos llenos.
  - El item ampliado tiene el enlace «Vista previa de etiqueta».
- **Una sola regla para «lista para imprimir»** (`paraImprimir`): pallets completos o liberados y datos llenos. La usan la lista de Etiquetas, la página y el enlace del item; antes la lista decía «completo» y la página «vista previa».
- **El sello MUESTRA va arriba del QR,** sin taparlo, para poder escanear la vista previa. El sistema de diseño se actualizó a la versión 41.

## [0.41.0] — 2026-11-26

### Agregado
- **PISO vs SISTEMA (T2)** en la Tabla de Pallets:
  - Cada renglón escaneado dice al instante si **cuadra**, si la pieza está **movida** (en otro pallet o DN, y cuál), si el **carton** es otro, si **sobra** o si está **repetida**.
  - Hay un resumen con los conteos y las vistas **Diferencias** (con «Ir» al renglón) y **Faltan en piso**.
  - Busca por el serial MT… o por el SN, entre todos los DN.

### Corregido
- La 0.40 (Tabla de Pallets, liberar pallet y edición de piezas) no había entrado a `main`: el PR 31 se fusionó antes de que llegara ese commit. Se recuperó aquí.

## [0.40.0] — 2026-11-26

### Agregado
- **Tabla de Pallets (T1)** (botón en el riel de Pallets):
  - Muestra la tabla de piso por DN: un bloque por pallet con 9 renglones, File (sistema) junto a Physical y Carton ID (piso), y el Pallet ID de piso en el encabezado.
  - **Captura:** escáner o teclado (Enter avanza), pegar columnas desde Excel, cargar xlsx o CSV, y exportar CSV.
  - Se guarda en la base dentro de cada item, y otro equipo ve la misma tabla.
- **Liberar pallet:** permite que un pallet (por ejemplo, el último de la DN) vaya con menos de 9 piezas.
- **Edición de piezas:**
  - Cada pieza se puede editar: SN, Carton ID, Pallet ID y **DN**. Cambiar el DN mueve la pieza, y si el DN no existe, se crea.
  - Cada pallet se puede **renombrar**.
- El servidor valida `liberados` y `piso`, con prueba.

## [0.39.0] — 2026-11-26

### Cambiado
- **Pallets por grupos de 9 (G1):** la regla pasa de «9 piezas por DN» a **9 por pallet**, como en la hoja de piso (una DN de 154 = 17 pallets de 9 + 1 de 1).
  - El item ampliado muestra sus piezas **en bloques por Pallet ID**, cada uno con su avance (x / 9) y su estado: Completo, n de 9, «N de más» o «Sin Pallet ID».
  - **Un DN está listo para etiqueta** cuando todas sus piezas tienen carton y Pallet ID y ningún pallet pasa de 9. Etiquetas da una por pallet.
  - Las tarjetas de Pallets muestran piezas con pallet (x / total), cuántos pallets y cuántos están completos.
  - La marca dice qué falta: «N sin pallet o carton» o «Pallet con más de 9».
  - Al cargar el SFC se informa cuántos pallets hay y cuáles tienen más de 9.
- **Regla confirmada: un DN tiene varios Pallet ID y cada pallet lleva 9 seriales y 9 cartons distintos.**
  - Un pallet con menos de 9, con más de 9, sin carton o con un carton repetido queda «por completar».
  - El DN pasa a Etiquetas solo con todos sus pallets completos.
- **Conexión con WIP** también lista los pallets por completar («PALFX…: faltan 2», «1 de más», «carton repetido»).

### Corregido (revisión de código)
- El escáner tomaba «N/A» como un Pallet ID o un carton real.
- La tarjeta decía «3 pallets · 2 de 9»; ahora dice «2/3 pallets completos».
- Un item sin piezas decía «Faltan datos».
- Las etiquetas usan la misma agrupación que el item (`grupos`).
- Conexión con WIP y Etiquetas no traían los items de la base en una sesión nueva u otro equipo; ahora sí.

## [0.38.0] — 2026-11-26

### Agregado
- **Etiqueta 4×6 in de Pallets:**
  - Hay una etiqueta por Pallet ID de cada DN completo, con vista previa en Etiquetas y **Descargar PDF** (una página por pallet).
  - Lleva Project y Model, el Pallet ID con su Code128, DN, Customer DN, PO, Customer PO, Sales Order, Shipped day, el Part number NVIDIA y el del SFC, Qty, Cartons, hazmat, COO y «Pallet i de N».
  - El QR lleva los datos y los seriales.
  - No lleva precios.
  - El PDF se descarga cuando el DN no tiene datos pendientes.
  - El código de barras y el QR se leen desde el PDF a 300 y 203 dpi.
- **Historial de Pallets:** los items de la base por día, con quién los creó y quién los editó al último. Antes la página decía «se activa al conectar la base de datos».

### Cambiado
- `PalletLabel` usa los datos del modelo nuevo y ya no tiene variantes; el sistema de diseño se actualizó a la versión 40.
- `GET /api/pallets/items` también trae quién editó cada item al último.

### Quitado
- `src/lib/pallets.ts` (el modelo anterior de tarimas) y sus llamadas a la API, que estaban en pausa.

## [0.37.0] — 2026-11-26

### Agregado
- **Conexión con WIP** (Pallets):
  - Muestra las piezas pendientes (sin Carton ID o Pallet ID) y los DN con piezas faltantes.
  - Cada pieza trae su estado en línea según el WIP cargado (en línea, hold, reparación, empaque o terminada), su estación y cuánto lleva ahí.
  - Una vigencia (hora, día, semana o mes) dice si el WIP está actualizado o desactualizado.
- **Etiquetas habilitada:**
  - Muestra los DN completos (9 piezas con serial, carton y Pallet ID) con los datos de su etiqueta, y tiene **Editar**.
  - El item completo tiene el enlace «Ver etiqueta».
  - La etiqueta 4×6 in se diseña después.
- **SN** (`SERIAL_NUMBER` del SFC) en cada pieza: es la llave para cruzar con el WIP.
- **El escáner (en pruebas) también toma el Pallet ID:** serial → carton → Pallet ID.
- `FALLOS.md`, para anotar los fallos de las pruebas.

### Cambiado
- **Una pieza cuenta como completa con serial, carton y Pallet ID** (antes bastaba el carton).
- Pallets ya no muestra el estado de WIP de cada pieza; ahora está en Conexión con WIP.
- Un DN con piezas de más dice «N de más».

### Quitado
- El constructor de etiquetas anterior y sus estilos (`.app-pal-*`).
- Descargas y Validación de Pallets ya no apuntan al flujo de tarimas: Descargas avisa que ahí irá el Shipping report CTO, y Validación lleva a Conexión con WIP.

### Corregido (revisión de código)
- **Sincronización:** al abrir Pallets se volvían a subir todos los items nunca editados, y la base anotaba como editor a quien solo los vio.
- **Etiquetas:** si al editar un DN quedaba incompleto, el diálogo saltaba a otro DN.
- **Al cerrar sesión** se perdían los items que no se habían podido subir; ahora se suben antes de salir.
- **Servidor:**
  - Un DN repetido en la misma petición daba 500; ahora da 400.
  - Quien creó el item lo pone el servidor; el navegador ya no puede cambiarlo.
- **Conexión con WIP:** un WIP sin fecha decía «Infinity días».

## [0.36.0] — 2026-11-26

### Agregado
- **Los items de Pallets se guardan en la base** (tabla `pallet_items`, un DN por fila):
  - Se guardan al cargar el SFC y al cerrar un item ampliado.
  - Otro equipo ve los mismos items, con lo escrito a mano.
  - Volver a cargar el SFC conserva lo escrito a mano aunque venga de otro equipo.
  - Sin conexión se trabaja en el equipo con aviso, y se sube al volver a abrir Pallets.
  - `GET/POST /api/pallets/items`, con validación y prueba.
  - `npm run check` revisa la tabla.
- **El Unit price no va a la base:** el servidor lo descarta y se queda en el navegador de quien lo escribió.

### Cambiado
- Los items se ordenan igual en todos los equipos: los más nuevos primero y luego por DN.

## [0.35.0] — 2026-11-25

### Cambiado
- **Pallets, nueva estructura** (plan en [PALLETS.md](PALLETS.md)):
  - **Carga → «Nuevo Pallet / Shipping Order»:** se carga el export de SFC y cada DN se vuelve un item. Un DN que ya existe se actualiza y conserva lo escrito a mano.
  - **Pallets** muestra los items en una cuadrícula de 5 × 3: DN, avance de piezas (9 por DN), Pallet IDs, quién lo creó y la fecha y hora. Tiene búsqueda (DN, PO, serial, carton, Pallet ID), un filtro (todos, incompletos, listos) y páginas.
  - **Ampliar un item:** muestra lo que llenó el SFC y los campos a mano (Sales Order, PN NVIDIA, Shipped day, Customer PO y DN de 8 dígitos). Los datos del modelo (Project, Model, Hazmat, COO, Unit price) se copian al siguiente item del mismo PN. El Total price se calcula.
  - **Piezas:** las faltantes se marcan en la tabla. El escáner (en pruebas) agrega un serial o corrige su carton.
  - **Etiquetas** pasa a otra opción, **en desarrollo** (la versión anterior).
- **Backend de Pallets en pausa** (`PALLETS_DB` en `src/lib/db.ts`): no se borran tablas ni endpoints. Los items viven en el navegador y se borran al cerrar sesión.

### Quitado
- Las páginas Tarimas e Historial de Pallets (dependían de la base). El listado de entregas y el CSV de tarimas ya no se cargan en Pallets.

## [0.34.0] — 2026-11-27

### Agregado
- **Pallets en la base de datos** (primer paso de la conexión):
  - Tablas `pallet_cargas` (cada listado de entregas, con fecha y hora de subida) y `pallet_tarimas` (Pallet # único en toda la base).
  - Endpoints `/api/pallets/cargas` y `/api/pallets/tarimas`, con validación y pruebas. Un Pallet # nuevo y repetido responde 409; renombrar una tarima a un Pallet # que ya existe también da 409 y se deshace todo.
  - `npm run check` revisa las tablas nuevas.
- **Carga:** cada listado de entregas se guarda solo en el histórico de la base.
- **Historial de Pallets:** los listados guardados, con «Usar este listado».
- **Página Tarimas** (botón en Pallets y en el riel): todas las tarimas por fecha y hora de subida, quién las subió, su estado y «Abrir». También las que solo están en este equipo.
- **Tarimas:** se guardan en la base y en el equipo; sin conexión, solo en el equipo, con aviso. Nueva columna «Creada» (fecha y hora).

### Cambiado
- **Pallets siempre muestra todas las casillas**, aunque no haya archivo cargado («Tarima en blanco»).
- **Ya no se carga el shipping report:** todo se llena desde el listado. Solo el DN y el NVIDIA DN se escriben a mano (marcados «a mano»); otra forma de cargarlos queda en desarrollo.
- La marca «del listado» es una etiqueta discreta, en lugar de un distintivo azul en cada campo.
- Sin Pallet # la etiqueta ya no muestra el aviso del código de barras.

## [0.33.0] — 2026-11-27

### Cambiado (optimización)
- **Carga inicial sin cambios de tamaño** (279.6 kB): `text()` vive en `tcqs.ts`. Si estuviera en `files.ts`, el arranque cargaría las librerías de Excel y CSV (unos 290 kB).
- **Una sola librería de QR:** el QR del MFA (Seguridad) usa `qrcode-generator`, la misma de las etiquetas, y se carga solo al configurarlo. Se desinstalan `qrcode` y `@types/qrcode`.
- **Helpers repetidos unificados:** `text()` (antes 3 copias) y el formato de enteros `num` (antes 4 copias).
- **Código muerto quitado:**
  - El menú anterior (`PipelineNav`, `STEPS`) y sus estilos; sigue disponible en el sistema de diseño.
  - Una variable sin usar en Yield.
  - Tres clases CSS sin uso y dos reglas que otra posterior anulaba.
- **`tsconfig`:** `noUnusedLocals` y `noUnusedParameters` activados. El build falla si queda una variable o un parámetro sin usar.

### Corregido
- La validación de Pallets ya no dice que el DN viene del listado (se escribe a mano).

## [0.32.0] — 2026-11-26

### Agregado
- **`npm run check`:** verificación de solo lectura.
  - **Base:** tablas, columnas, índice, filas, respaldos vencidos y cuentas, incluidos los administradores sin MFA.
  - **API** (opcional, con `--api <url>`): salud, 401 sin sesión, 405 y 415.
  - Se puede correr en el Shell de Render.
- El QR de la etiqueta lleva también el cliente, el destino y la nota de batería (CUST, DEST, BATT).

### Corregido
- Una tarima con seriales repetidos fuera del modo prueba ya no queda «Lista para imprimir».
- Al apagar el modo ×9, las piezas vuelven a la cantidad de la entrega.
- WIP general y por orden cargados juntos: las piezas del reporte por orden ya no salen con 0 h.
- Una tarima abierta con «Cargar QR» completa lo que falte desde el shipping report o el listado. Cliente y destino son obligatorios para imprimir.
- La medición escáner/teclado se reinicia al borrar lo escrito o al pegar.

## [0.31.0] — 2026-11-26

### Agregado
- **Pallets:**
  - El **FXNN DN** y el **NVIDIA DN** se escriben a mano. El DN del listado se ve como guía dentro del campo. El NVIDIA DN va en la etiqueta, el QR, el CSV y el PDF; el T/O pasa a la variante «Más texto».
  - **Uno o varios archivos** en Carga para el listado de entregas y el WIP. Se unen por nombre de columna y una entrega repetida queda una sola vez.
  - **QR:** «Descargar QR (PNG)» y «Cargar QR», que lee la imagen de una etiqueta (jsQR) y abre esa tarima.
  - **Escáner:** cada lectura dice si vino del escáner (con los ms por carácter) o del teclado. Si escaneas el QR de una etiqueta en el campo de seriales, avisa.
  - **Modo prueba ×9:** cada lectura entra 9 veces y la etiqueta sale marcada **PRUEBA**, también impresa. El QR lleva `TEST:1`.
- Endpoints de la API revisados con una prueba de humo (20 casos: sin sesión, login con MFA, cada endpoint con sesión, salir).

### Corregido
- Guardar una tarima con un Pallet # repetido ya no reemplaza a la otra.
- El CSV de tarimas escribe los números largos como `="…"`: Excel ya no los convierte en 6.20610E+13.
- Las descargas de Pallets solo imprimen las etiquetas completas.
- El Internal Ref sugerido continúa la numeración del shipping report.
- El Pallet # repetido se detecta aunque traiga espacios.

## [0.30.0] — 2026-11-25

### Agregado
- **Áreas: WIP, YIELD y PALLETS.**
  - El inicio (`/`) es un **menú giratorio** (`AreaWheel`): tarjetas en carrusel 3D que se manejan con ← →, clic o Enter, y recuerda la última área.
  - En la barra superior, un botón con el área actual regresa al menú.
  - Cada área tiene sus rieles, su **Carga** (solo sus archivos), su **Validación**, su **Historial** y sus **Descargas**, en rutas `/área/…`.
  - Las direcciones anteriores (`/carga`, `/graficos`…) redirigen a YIELD.
- **Validación de Pallets:** entregas leídas, tarimas del shipping report y filas sin Pallet #, y tarimas del equipo.
- **Descargas de Pallets:** CSV de tarimas y todas sus etiquetas en un PDF, una por página.
- Código separado por carpeta: `src/areas/{yield,wip,pallets}`. Las áreas se definen en `src/areas.ts` y las poses del menú en `src/lib/wheel.ts`, con pruebas.

### Pendiente
- Historial de WIP y Pallets: se activa con la base de datos.
- Permisos por área: por ahora todos los usuarios ven las tres.

## [0.29.0] — 2026-11-25

### Agregado
- **Pallets · fase B (funcional):** se cargan en Carga el **listado de entregas** (SAP), el **shipping report** (FINISH GOOD) y un **CSV de tarimas**.
  - Al elegir una entrega, la tarima se llena con el DN, SO, T/O, PO, modelo, piezas, cliente, destino y pesos.
  - Del shipping report salen el HTS, COO, batería, medidas, Incoterm y Carrier de ese número de parte. Se propone el siguiente Internal Ref (FGNS-AAAAMMDD-NNN).
- **Validaciones:**
  - Campos obligatorios.
  - El peso neto no puede ser mayor que el bruto.
  - Formato del Pallet # (PALFX…) y que no esté repetido en las tarimas del equipo ni en el shipping report.
  - Seriales = piezas.
  - Cruce con el WIP como aviso: seriales que siguen en línea o que no aparecen en el WIP. Terminadas y empaque (FG, PACK) cuentan como listas.
- **Etiqueta con códigos reales:**
  - QR (nivel M) con todos los datos y los seriales.
  - Code128 propio con el Pallet #.
  - **PDF de 4×6 in** (288×432 pt). Ambos códigos se leen desde el PDF a 203 dpi.
- **Tarimas guardadas en este equipo** con su estado (guardada, impresa y fecha). Se pueden reimprimir y editar, también las que vienen del shipping report. **Exportar tarimas (CSV)** da un archivo limpio y editable que se vuelve a cargar en Carga.
- Dependencia `qrcode-generator` 2.0.4 (MIT, sin dependencias).

### Corregido
- Las secciones de la tarima ya no se cierran solas al llenar sus campos obligatorios.

## [0.28.0] — 2026-11-24

### Agregado
- **Pallets · fase A (diseño, datos de ejemplo):** página nueva en el riel izquierdo. Tiene tres columnas:
  - Entregas del listado, con buscador.
  - La tarima por áreas del shipping report (Shipping, Fulfillment, ITC), con avance y campos «del listado» llenos de antemano.
  - Vista previa de la etiqueta en vivo.
- Estados de la tarima: incompleta, lista para imprimir e impresa. Validación de pesos (el neto no puede ser mayor que el bruto) y de seriales (deben cuadrar con las piezas).
- **Etiqueta 4×6 in** (`PalletLabel`): blanco y negro para impresora térmica, con dos variantes (QR grande o más texto). Al imprimir sale una sola hoja de 4×6 in exactas. El QR y el Code128 son de muestra; los reales entran en la fase B.
- **`SerialInput`:** captura con escáner o teclado (Enter o pegar varios), contador contra las piezas, el duplicado no entra y tiembla.

## [0.27.0] — 2026-11-23

### Agregado
- **WIP por orden:** se lee también el reporte del MES de una sola orden (sin HOUR). Las horas en la estación se cuentan hasta la **hora de carga** del archivo y se muestran el corte y el **último movimiento**. Con GROUP_NAME → WIP_GROUP se deduce la ruta: las estaciones se ordenan ruta por ruta (subensambles primero) en la tabla, la línea de tiempo y los reportes.
- **Línea de tiempo del WIP** (Motion, solo en la página WIP): una fila por estación en el orden del flujo; cada punto junta las piezas con un tiempo parecido en la estación (escala logarítmica, de minutos a meses), con zonas verde/naranja/roja y las urgentes latiendo. Botón «Mostrar/Ocultar línea de tiempo»; clic en una estación abre sus piezas. Respeta «reducir movimiento».
- **Vista por orden** en WIP (en proceso por estado, terminadas, la más antigua; «Ver flujo» filtra esa orden) y «Quitar filtros».
- **Descargas** (riel derecho): Yield en HTML y PDF (antes en la página Yield) y **WIP en HTML y PDF**: resumen y semáforo, flujo por estación, urgentes y bloqueadas, y por orden.
- **Validación del WIP** aparte del TCQS: filas repetidas e inválidas, formato, hasta qué hora se cuenta el tiempo. «Validar datos» se activa con el TCQS o con el WIP.
- Dependencia `motion` 14.10.1 (≈ 50 kB comprimidos, solo en la página WIP).

### Corregido
- Las correcciones de la revisión de 0.26 (horas con coma decimal, horas de Excel al segundo, filtros que se reinician, sección por mayoría, TARGET_QTY opcional) y la carga de páginas al visitarlas llegaron después del merge del PR #20; quedan en esta versión.

## [0.26.0] — 2026-11-19

### Agregado
- **WIP** (riel izquierdo, paso 4): se carga el reporte WIP del MES por pieza (`wip_total.xlsx`). Se quitan las filas repetidas del MES y se cuentan solo las piezas en proceso: las terminadas (STOCKIN) y las de empaque (FG, PACK_CTN, PACK_PALT) no se muestran. Filtros por modelo, orden, serial y por llegada a la estación (última hora, turno, día, semana).
- **Flujo por estación** agrupado por sección (SMT → … → SI): piezas, barra por tiempo en la estación (verde < 2 h, naranja < 20 h, rojo desde 20 h), la más antigua, FPY de la estación según el TCQS y avisos de hold, reparación, bonpile, bloqueadas (ERROR_FLAG) y **cuello de botella** (FPY bajo meta con 10 o más piezas). Las piezas de más de 100 h laten como urgentes. «Ver piezas» abre las piezas de esa estación, las más antiguas primero.
- Cruce con el TCQS: órdenes con piezas en proceso sin TCQS y órdenes del TCQS sin piezas en proceso.
- Tokens `--sem-ok`, `--sem-warn`, `--sem-bad` (semáforo, claro y oscuro).

- **App más ligera al abrir:** cada página se descarga al visitarla; la carga inicial bajó de 427 kB a 289 kB (141 → 97 kB comprimido).
- WIP: horas con coma decimal («20,5») en CSV; horas de Excel redondeadas al segundo (también en primeras fallas); los filtros se reinician al cargar otro archivo; la estación va en la sección de la mayoría de sus piezas; TARGET_QTY ya no se exige.
- Terminadas y empaque se cuentan con los mismos filtros de la página; la barra de tiempo se anuncia en lectores de pantalla; secciones nuevas del MES quedan juntas.

### Cambiado
- **Carga:** se quitan la tarjeta de modelos de Juliet y QM; la lista de modelos se actualiza solo en Base de datos («Actualizar modelos»).

## [0.25.0] — 2026-11-18

### Cambiado
- **Menú nuevo:** barra superior solo con Cuentas, Base de datos (administrador) y el perfil. A la izquierda un **riel** con el flujo (Carga, Validación, Yield, con ✓ en los pasos hechos); a la derecha otro con las consultas (Inicio, Gráficos, Comparativas, NDF, Historial). Cada riel muestra solo íconos (56 px) y se desliza a 216 px sobre el contenido al pasar el mouse o con el teclado; los dos son independientes y no se empujan. En móvil son dos franjas horizontales.
- **Gráficos:** una gráfica a la vez en un carrusel a la escala de la pantalla; «Ampliar» sigue abriendo datos y comentarios.
- **Nombres de las gráficas en vertical** (estaciones, códigos de error) cuando no caben derechos; al pasar por la gráfica se desenfocan y queda nítido el de la barra señalada. Aplica a Pareto y barras/líneas en todo el proyecto.
- Entrada suave de las secciones y tarjetas con relieve al pasar el mouse (CSS; respeta «reducir movimiento»).

### Agregado
- **Inicio por modelo:** selector «Modelo» que filtra el FPY, las tarjetas y el carrusel.

### Corregido
- El contador del carrusel («2 / 6») se partía en dos líneas en móvil.
- Revisión de código: el desenfoque solo actúa al señalar una barra y solo en nombres de categoría (los ejes de histograma y dispersión ya no se desenfocan); el ✓ de los pasos se anuncia como «hecho» en lectores de pantalla; sin enlaces de administración no queda un menú vacío; el título del eje X ya no se encima con los nombres verticales.

## [0.24.0] — 2026-11-18 · sistema de diseño v28

### Agregado
- **Tarjeta NDF** junto a las de yield (Yield, HTML y PDF): NDF y su % de las primeras fallas, sumado por estación igual que en la página NDF.
- **PDF · página 3 NDF:** resumen (NDF de las primeras fallas, % recuperado, SPY, barra NDF / real / pendiente), las 15 estaciones con más NDF, Pareto de los 10 códigos principales (% acumulado sobre todos) y los códigos del 80 % con descripción y testers principales. **Anexo** con los seriales de los códigos del 80 % (filas compactas). En la tabla de estaciones de la página 2, columna NDF. Tarjetas 4 por fila.
- **HTML · sección NDF nueva:** resumen con la barra de reparto junto a las estaciones (cuadro compacto) y la **estación con más NDF** de cada modelo con su Pareto de códigos, el 2do nivel y sus seriales en un desplegable. El archivo bajó de ~680 KB a ~510 KB.
- Sistema de diseño: **`SplitBar`** (reparto de un total) y **`Segmented`** (opciones excluyentes a la vista), usados en la página NDF y el HTML.

## [0.23.0] — 2026-11-18

### Cambiado
- **NDF con panel a la derecha:** las gráficas ocupan el ancho y apiladas (1er nivel, unidades del código elegido, 2do nivel). El panel fijo de la derecha reúne el resumen (NDF grande, % que se recupera, SPY y una barra NDF / real / pendiente), los filtros Modelo, Estación y Tester con «Quitar filtros», el selector del 2do nivel y el aviso de cuadre con el TCQS. En pantallas de menos de 1100 px el panel va arriba.
- **Lista de códigos guardada** en un desplegable («Todos los códigos (N)»): las gráficas ya muestran los principales; la lista queda para buscar uno y como acceso con teclado.
- 2do nivel por tester también limitado a 20 barras.

### Corregido
- Con códigos de ICT de cientos de letras, la tabla de códigos se ensanchaba y las demás columnas quedaban fuera de la vista. La celda del código se corta con «…» (completo al pasar el mouse).

## [0.22.0] — 2026-11-18

### Cambiado
- **NDF · gráficas primero:** el orden es filtros → KPIs → gráficas y códigos → estaciones. La lista de estaciones va en un contenedor compacto (320 px, desplazamiento propio con encabezado fijo).
- **Gráficas que se animan:** en NDF, cada cambio de modelo, estación, tester o vista vuelve a dibujar las barras (crecen) y la línea acumulada, como en el carrusel; con «reducir movimiento» no hay animación.
- **2do nivel con dos vistas:** «Testers de los códigos del 80 %» (como el Excel) y «Códigos de los testers del 80 %» (al revés: los testers que suman el 80 % de las fallas y qué códigos les salen). Clic en una barra abre sus unidades.
- Ancho máximo de las páginas: 1920 px (antes 1600) para monitores anchos; probado sin desplazamiento horizontal de 390 a 2560 px.

## [0.21.0] — 2026-11-18 · sistema de diseño v27

### Agregado
- **NDF interactivo:** clic en una barra del Pareto (o «Ver unidades» en la tabla) abre las unidades de ese código: serial, fecha, estación, tester, orden, modelo y estado (NDF, NDF probable con su %, real, pendiente). El tooltip trae la descripción del error y el NDF estimado; clic en un tester del 2do nivel filtra por ese tester.
- **Filtros desplegables:** Modelo, Estación y Tester (todos o uno). Cada filtro reinicia los de abajo. KPIs, tablas y Paretos siguen la selección.
- **NDF por modelo** (general o por separado).
- **HTML descargable · sección NDF** en cada modelo: estaciones, Pareto de códigos y, por código, sus seriales en un desplegable (funciona sin internet). Mismo periodo y modelo que el resto del reporte.

### Cambiado
- `ParetoChart`: `onPick`/`picked` (clic en barra), `limit` (solo las primeras N barras; el % acumulado sigue sobre el total) y `hint` en el tooltip. Las etiquetas del eje se cortan a 24 letras (también en `BarChart`): un código de ICT de cientos de letras hacía la gráfica de 14 000 px de alto.
- Pareto de códigos limitado a 20 barras (todas en la tabla).

### Corregido (revisión de código)
- SPY total de NDF sin las entradas de estaciones sin fallas (salía 1.3 % en vez de 1.1 %).
- El HTML clasificaba las fallas contra todo el rango y no contra el periodo del reporte.
- El archivo del TCQS se leía dos veces en NDF y Yield; el NDF estimado por código recorría todas las fallas una vez por código.
- Un resumen largo en el HTML ensanchaba la columna y con ella las gráficas (carrusel de 4 000 px).

## [0.20.0] — 2026-11-17

### Agregado
- **NDF** (menú): primeras fallas, NDF, reales y pendientes por estación con el método validado contra el Excel «Yield TE – NDF»: NDF = 2do pase del TCQS (falló y pasó al re-probar sin reparación), real = FAIL_QTY, pendiente = lo que falta re-probar. El Excel contaba como NDF las pendientes (FT wk44: 11 en vez de 7).
- **Primeras fallas** en Carga (reporte FirstFail, .csv o .xlsx): códigos de error por unidad. Pareto por código (marca de 80 %) y por tester, filtrados por estación (el Excel no filtraba el 2do nivel). «NDF estimado» por código: el TCQS dice cuántas pasaron al re-probar por orden × estación, no cuáles.
- Al cargarlo se comprueba que cuadre con FIRST_FAIL_QTY por día × orden × estación × tester (con los archivos reales del 9–14 nov: 101 de 105 grupos; las 4 diferencias son de WC_KIT_PRESSURE).

### Corregido
- CSV con comillas escapadas como `\"` (reporte FirstFail): se corrían columnas en las descripciones de varias líneas de ICT; ahora se leen las 257 filas.

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
