# Pallets · nueva infraestructura (plan)

Pallets se rehace en el frontend. La versión anterior (0.28–0.34: etiqueta armada a mano, listado de entregas, tarimas en la base) sigue en el código y en el historial de git hasta que la reemplace cada fase. Los items por DN se guardan en la base desde la 0.36 (`pallet_items`).

> Los archivos de ejemplo se analizaron en un directorio aislado y se borraron. Este documento solo guarda la **estructura** (columnas y formas), nunca datos reales.

## Flujo

1. **Carga → «Nuevo Pallet / Shipping Order»:** se carga el export de SFC. Se reconoce por sus columnas, no por el nombre del archivo. **Cada DN se vuelve un item.**
2. **Pallets:** cuadrícula de 5 × 3 con los items. Cada uno muestra su DN, sus piezas (x / 9), sus Pallet IDs, quién lo creó y cuándo. **Ampliar** abre todos sus datos y los campos a mano.
3. **Conexión con WIP:** las piezas **pendientes** (sin Carton ID o Pallet ID) y **faltantes** (el DN aún no llega a 9), con su **estado en línea** según el WIP cargado en el área WIP.
   - El cruce es por SN (`SERIAL_NUMBER`), la misma columna en WIP y en SFC.
   - Una **vigencia** (hora, día, semana o mes) decide si el WIP está **actualizado** o **desactualizado**.
   - Qué tan actual es el WIP: el corte del reporte general, o el último movimiento del reporte por orden.
4. **Etiquetas:** los DN **completos**, es decir, 9 piezas con serial, carton y Pallet ID.
   - Muestran sus datos: Shipped day, PO, Sales Order, Project, Model, delivery, hazmat, partnumber, qty, Unit price y Total price.
   - Cada pieza lleva Serial, SN, Carton ID y Pallet ID.
   - Tienen **Editar**, y el item ampliado tiene el enlace «Ver etiqueta».
   - La estructura de la etiqueta 4×6 in se diseña después.
5. **Los datos de WIP se quedan en Conexión con WIP.** Pallets y Etiquetas solo muestran lo que trae el SFC. El estado `WIP_GROUP` del SFC se guarda, pero no se muestra.

### Verificación con el SFC real (26 nov)

- **La base coincide con el archivo:** 10 de 10 DN y 257 de 257 piezas (serial, SN, carton y Pallet ID). Una pieza con carton `N/A` se guarda vacía («sin carton»), a propósito.
- **El SFC real no trae 9 piezas por DN:** sus 10 DN tienen 1, 9, 10, 18, 21, 36, 36, 36, 36 y 54 seriales. Solo 1 DN queda listo para etiqueta. **Por confirmar** si un DN del SFC debe partirse en grupos de 9.
- **El shipping report (FINISH GOOD) no corresponde a este SFC por DN:**
  - Ninguno de sus DN, SO, PO ni T/O aparece en el SFC.
  - Sus filas (9 seriales cada una) traen seriales repartidos en 1 a 4 DN del SFC.
  - 143 de sus 172 seriales sí están en el SFC.
  - Solo 3 filas traen Carton # y Pallet #, y casi ninguno coincide con el SFC.
- **El WIP de ejemplo es de otra orden** (0 seriales en común, mismo formato de 14 dígitos). El cruce se probó con datos inventados.

## Archivos de referencia

| Archivo | Qué es | Papel |
| --- | --- | --- |
| **SFC** (`download_*.xlsx`, hoja `data`) | Una fila por serial; 20 columnas útiles (las `Column1…` vienen vacías) | **Entrada**: crea el item |
| **Shipping report CTO** (`shipping_report_automatizacion.xlsx`) | 43 columnas, una fila por serial; hoja «Instrucciones» con la fuente de cada campo | **Salida**: el formato a llegar |
| **Shipping report actual** (`SHIPPING_REPORT…IT_BARCODE.xlsx`, hoja FINISH GOOD) | 63 columnas por área (Shipping, ITC, Fulfillment); renglón 6 = fuente («*», «Same info always», «Total SN Scanned») | **Referencia** para validar |

### SFC: columnas

| Columna | Forma | Qué es |
| --- | --- | --- |
| `TO_NO` | 10 dígitos | T/O |
| `DN` | 10 dígitos | FXNN DN (**llave del item**) |
| `CUST_PO` | 8 dígitos | PO |
| `SO_LINE`, `DN_ITEM_NO` | 6 dígitos | Línea (no es el Sales Order) |
| `SERIAL_NUMBER` | 14 dígitos | Serial interno FXNN |
| `SERIAL_NUMBER1` | `MT…` 12 caracteres (2 formas) | **Serial del reporte** |
| `MODEL_NAME` | `SA…` | Modelo SFC interno |
| `MODEL_NAME1` | `920-…` | Part number FXNN |
| `MCARTON_NO` | `FX…` 9 caracteres; **vacío si aún no tiene caja** | Carton |
| `IMEI` | `PALFX…`; **`N/A` si aún no tiene tarima** | Pallet ID |
| `KANBAN_IN_TIME`, `KANBAN_OUT_TIME` | fecha y hora | Entrada y salida del kanban |
| `WIP_GROUP` | `STOCKIN` = listo; otros = sigue en línea | Estado |

Muestra analizada: 257 seriales, 10 DN, 20 tarimas; **93 seriales sin tarima** y **53 sin caja**. Un DN tiene de 1 a 54 seriales, y uno no tiene ninguna tarima todavía.

## Los 17 campos: de dónde salen

| Campo (reporte CTO) | Fuente | Estado |
| --- | --- | --- |
| Shipped day | No está en el SFC | ✍️ Manual (fecha) |
| PO | SFC `CUST_PO` | ✅ |
| Sales Order | No está en el SFC (`SO_LINE` es la línea) | ✍️ Manual, de momento |
| Project | No está en el SFC; en el ejemplo siempre es `NVIDIA` | 🔧 Plantilla por modelo |
| Model | No está en el SFC (nombre comercial) | 🔧 Plantilla por modelo |
| delivery | SFC `DN` | ✅ |
| hazmat | No está en el SFC; texto fijo de batería («Same info always») | 🔧 Plantilla por modelo |
| partnumber | Dos casillas: **PN SFC** (`MODEL_NAME1`, `920-…`) y **PN NVIDIA** (`692-…`, el del reporte) | ✅ SFC + ✍️ NVIDIA a mano (se copia al siguiente item del mismo PN) |
| qty | 1 por serial (fila del reporte); total = número de seriales | ✅ Calculado |
| Serial | SFC `SERIAL_NUMBER1` | ✅ |
| Carton | SFC `MCARTON_NO` | ✅ Si está vacío: «sin caja» |
| Pallet ID | SFC `IMEI` | ✅ Si es `N/A`: «sin tarima» |
| COO | No está en el SFC; en el ejemplo, `MX` | 🔧 Plantilla (por omisión `MX`) |
| Unit price USD | No está en el SFC («MPM») | 🔧 Plantilla por modelo · **dato sensible** |
| Total price USD | Unit price × qty | ✅ Calculado |
| Customer PO | Manual (NVIDIA PO: 8 dígitos en el reporte actual) | ✍️ Validar `^\d{8}$` |
| Customer DN | Manual (NVIDIA DN: 8 dígitos en el reporte actual) | ✍️ Validar `^\d{8}$` |

✅ sale del SFC · 🔧 dato del modelo: se escribe una vez y se copia al siguiente item del mismo PN SFC · ✍️ manual

### Validaciones

- **Al cargar el SFC:** la hoja `data` y las columnas `DN`, `SERIAL_NUMBER1`, `MCARTON_NO` e `IMEI` son obligatorias. Un serial repetido se rechaza.
- **Un archivo con varios DN** crea un item por DN.
- **El mismo DN cargado otra vez:** se avisa y se actualiza el item. No se duplica.
- **Seriales sin tarima o sin caja:** se muestran aparte y no cuentan como listos.
- **Estado del serial:** `STOCKIN` = listo; cualquier otro `WIP_GROUP` = «en línea» (aviso).
- **9 piezas por DN** (`POR_DN`): una pieza cuenta si tiene serial y carton. Con menos: «Faltan N piezas» y se completan con el escáner o a mano (en pruebas). Con más: aviso.
- **Campos a mano:** sin ellos el item dice «Faltan datos». Customer PO y DN: 8 dígitos.
- **Precios:** solo en este equipo, nunca en la base ni en datos de prueba. Lo mismo para direcciones, cuentas y pedimentos.

## Etiqueta 4×6 in (0.38)

- **Una por Pallet ID** de cada DN completo, en el orden en que aparecen en el SFC: «Pallet 1 de N».
- **Contenido:**
  - Encabezado: Project y Model.
  - **Pallet ID** en grande con su Code128.
  - Datos: Delivery (DN), Customer DN, PO, Customer PO, Sales Order, Shipped day, Part number (NVIDIA), PN SFC, Qty y Cartons (los de ese pallet).
  - Pie: hazmat en recuadro, COO, «Pallet i de N» y el QR.
- **El QR** lleva PALLET, DN, PO, SO, CPO, CDN, PN, QTY, DATE, COO, CTN (cartons) y SN (seriales del pallet). Está solo en ASCII y con nivel M.
- **Sin precios:** la etiqueta va pegada a la tarima. Unit price y Total price solo aparecen en la hoja de datos.
- **PDF** (`etiquetas-DN.pdf`): una página de 288×432 pt por Pallet ID. Solo se descarga cuando el DN no tiene datos pendientes.
- **Comprobado:** el Code128 y el QR se leen desde el PDF a 300 y 203 dpi (zxing). **Falta probarlo en una impresora real.**
- Componente: `PalletLabel` en `src/components/label.tsx` (sistema de diseño, versión 40). PDF: `labelsPdf` en `src/pages/pdf.tsx`. Datos: `etiquetas()` en `src/lib/sfc.ts`, con prueba.

## Historial (0.38)

- **Pallets → Historial:** los items de la base por día de creación, con hora, DN, piezas, estado, quién lo creó, quién lo editó al último (lo anota el servidor) y el archivo. **Abrir** lleva al item.
- El historial de WIP sigue pendiente: el WIP aún no se guarda en la base.

## Plan 0.39+ · Grupos de 9, Tabla de Pallets y PISO vs SISTEMA

### Qué muestra la hoja de referencia (piso)

- **Una DN de embarque** (FXNN SO + FXNN DN, PO line, PN, COO; 154 = total del embarque) se arma en **pallets de 9 piezas**, con 1 pallet por bloque.
- Cada renglón tiene 4 códigos:
  - **File**: el serial que dice el sistema (shipping report).
  - **Physical**: el serial que está físicamente en la tarima.
  - **palet**: el Pallet ID.
  - **# carton**: el carton.
- **File y Physical no son la misma pieza por renglón**: se comparan como conjunto. Esto coincide con la verificación del 26 nov: los 9 seriales de una DN del reporte vienen de varios DN del SFC.
- El **amarillo** marca el renglón 9 de cada bloque (cierre del pallet) y el **rojo**, un serial que no cuadra.

### Decisiones (26 nov)

1. **Grupos de 9:**
   - Un DN del SFC con más de 9 piezas se parte en **grupos de 9**, armados por **Pallet ID** en el orden del SFC.
   - Un grupo se puede **mover a un DN nuevo**, creado a mano o **cargado de otro archivo**. Al cargar se **valida** que los datos coincidan y se muestra una **vista previa** antes de aplicar.
2. **Pallet ID:** se escanea, se escribe o se carga.
3. **Tabla de Pallets** (botón y panel nuevos):
   - Es la tabla de piso (Physical, palet y # carton), unida a los DN ya cargados.
   - Los códigos se escanean o se escriben.
4. **PISO vs SISTEMA** (función nueva): compara la Tabla de Pallets (piso) con los DN y el SFC (sistema).

### Diseño de la Tabla de Pallets

- **Bloques por pallet** en vez de celdas combinadas:
  - Un encabezado fijo con SO · DN · PN · COO y el chip del Pallet ID.
  - Avance **9 / 9** del bloque y el estado del bloque.
- **4 columnas de código** en mono: Serial sistema · Serial piso · Pallet ID · Carton. El PN completo va en el encabezado, sin cortarse.
- **Captura rápida:**
  - La celda activa recibe el escáner (Enter baja a la siguiente).
  - Se puede pegar una columna desde Excel (varios renglones de una vez).
  - Las flechas y Tab mueven la celda, con el mismo `SerialInput` (escáner o teclado).
- **Estado por renglón con texto e ícono**, no solo color:
  - ✓ Cuadra.
  - ⚠ En otro pallet o DN.
  - ✗ No está en el sistema.
  - ○ Pendiente.
- **El renglón 9 cierra el bloque**; al llenarse, el bloque se marca completo.
- **Filtros:** Todos · Diferencias · Pendientes, y búsqueda por cualquier código.
- **Carga y exporta** el Excel con las columnas de la referencia (File, Physical, palet, # carton).

### PISO vs SISTEMA (reglas)

| Piso | Sistema | Resultado |
| --- | --- | --- |
| Serial en el pallet | En el mismo DN y Pallet ID | ✓ Cuadra |
| Serial en el pallet | En el sistema, pero en otro pallet o DN | ⚠ Movido (dice dónde) |
| Serial en el pallet | No está | ✗ Sobra en piso |
| — | Serial del DN sin escanear | ○ Falta en piso |
| Carton distinto al del SFC | | ⚠ Carton no cuadra |

### Fases

| Fase | Qué |
| --- | --- |
| **G1** | `grupos(it)`: partir en 9 por Pallet ID, con prueba. Ver los grupos en el item y en Etiquetas (una etiqueta por grupo/pallet). |
| **G2** | Mover un grupo a un DN nuevo (a mano), con vista previa. |
| **G3** | Cargar los DN nuevos desde el shipping report (FINISH GOOD: una fila = DN + 9 seriales), validar contra el SFC y mostrar la vista previa antes de aplicar. |
| **T1** | Tabla de Pallets: bloques, captura con escáner, pegar desde Excel y cargar/exportar xlsx. |
| **T2** | PISO vs SISTEMA: estados por renglón, resumen y filtros. |
| **T3** | Guardar la Tabla de Pallets en la base (`pallet_piso`), junto con los items. |

### Por confirmar

- **¿154 es el total de piezas de la DN de embarque?** ¿Y 9 / 1 son piezas por pallet / pallets por bloque?
- **El «otro archivo» para cargar DN nuevos, ¿es el shipping report (FINISH GOOD)?**
- **Al comparar, ¿«File» es siempre el sistema y «Physical» lo escaneado en piso?**

## Plan de desarrollo (frontend)

| Fase | Qué | Estado |
| --- | --- | --- |
| **F0** | Backend de Pallets en pausa: `PALLETS_DB = false` en `src/lib/db.ts` (tablas y endpoints se quedan) | ✅ 0.35 |
| **F1** | `readSfc()`, `faltan()`, `escanear()` y `plantilla()` en `src/lib/sfc.ts`, con prueba de datos inventados | ✅ 0.35 |
| **F2** | Carga: «Nuevo Pallet / Shipping Order» pide el SFC y crea o actualiza los items (`src/areas/pallets/Nuevo.tsx`) | ✅ 0.35 |
| **F3** | Página **Pallets**: cuadrícula 5 × 3, búsqueda, filtro y páginas (`Pallets.tsx`) | ✅ 0.35 |
| **F4** | **Ampliar item**: del SFC, a mano, datos del modelo, piezas y escáner en pruebas (`Item.tsx`) | ✅ 0.35 |
| **F5** | Exportar el **Shipping report CTO** (una fila por serial) | Pendiente |
| **F6** | **Etiquetas** de los DN completos (hoja de datos; la etiqueta 4×6 in después) y **Conexión con WIP** | ✅ 0.37 |
| **F6.1** | **Etiqueta 4×6 in** por Pallet ID (vista previa y PDF) e **Historial** de items desde la base | ✅ 0.38 |
| **F7** | Hora de edición por campo y validaciones con datos reales | Pendiente |
| **F8** | Backend con el modelo nuevo: tabla `pallet_items` y `GET/POST /api/pallets/items` | ✅ 0.36 |

### Base de datos (0.36)

- **`pallet_items`:** una fila por DN, con `datos` (el item y sus piezas), `usuario` (quién lo creó), `creado`, `edito` (quién lo editó al último) y `editado`.
- **`GET /api/pallets/items`** trae todos. **`POST /api/pallets/items`** `{ items: [...] }` crea o reemplaza por DN (de 1 a 500 por llamada), con validación en el servidor (`validateItems`).
- **El Unit price no se guarda en la base:** el servidor lo descarta y se queda solo en el navegador de quien lo escribió. Por eso el Total price solo se ve en ese equipo.
- **Cuándo se guarda:** al cargar el SFC (los DN del archivo) y al cerrar un item ampliado, si cambió algo. No se guarda en cada tecla.
- **Al abrir Pallets o Carga** se traen los de la base. De cada DN se queda la versión más reciente, y lo que solo estaba en este equipo (por ejemplo, guardado sin conexión) se sube.
- **Sin conexión:** se trabaja en el equipo con aviso, y se sube al volver a abrir Pallets.
- **Copia en el navegador** (`localStorage`, clave `yc-pallets`): se borra al cerrar sesión; la base conserva todo.
- Los endpoints del modelo anterior (`/api/pallets/cargas` y `/tarimas`) siguen en pausa (`PALLETS_DB = false`) y ya no los usa ninguna pantalla.

### Archivos de Pallets hoy

- **Nuevo:** `src/lib/sfc.ts` (+ prueba), `src/areas/pallets/items.ts` (los items), `Nuevo.tsx` (Carga), `Pallets.tsx` (cuadrícula), `Item.tsx` (ampliado); estilos `.app-item*`, `.app-det*` en `src/styles/app.css`.
- **Conexión con WIP:** `src/areas/pallets/Conexion.tsx` (lee el WIP del área WIP con `readWip`). **Etiquetas:** `src/areas/pallets/Etiquetas.tsx`; la etiqueta 4×6 in de antes sigue en `src/components/label.tsx` y `src/styles/yc.css`, para la siguiente fase.
- **Backend:** `server/index.js` (`pallets()`, tabla `pallet_items`), `server/validate.js` (`validateItems`), `src/lib/db.ts` (`loadItems`, `saveItems`), `server/check.js`.
- **Compartidos:** `src/areas.ts`, `src/main.tsx`, `src/pages/Carga.tsx`, `Validacion.tsx`, `Descargas.tsx`.

## Riesgos

- **Gana la última escritura por DN:** si dos personas editan el mismo DN a la vez, se queda lo último que se guardó.
- **Las horas de edición vienen de cada equipo:** si dos equipos tienen la hora distinta, puede quedarse la versión equivocada al sincronizar.
- **PN NVIDIA ≠ PN del SFC:** sin la plantilla, el reporte saldría con el número de parte equivocado.
- **Serial y carton:** en el SFC el serial (`SERIAL_NUMBER1`) es `MT…` y el carton (`MCARTON_NO`) es `FX…`, igual que en el reporte CTO.
- **Archivo SFC ancho:** trae miles de columnas vacías (`Column1…`); se lee todo el archivo, puede tardar unos segundos.
- **El serial tiene 2 formas** en el SFC (`MT…` con letra final y 12 dígitos): las dos se aceptan.
