# Pallets · nueva infraestructura (plan)

Pallets se rehace en el frontend. La versión anterior (0.28–0.34: etiqueta armada a mano, listado de entregas, tarimas en la base) sigue en el código y en el historial de git hasta que la reemplace cada fase. **El backend de Pallets queda en pausa** mientras se valida este plan.

> Los archivos de ejemplo se analizaron en un directorio aislado y se borraron. Este documento solo guarda la **estructura** (columnas y formas), nunca datos reales.

## Flujo nuevo

1. **Carga → «Nuevo Pallet / Shipping Order»**: crea un item dentro de PALLETS. (La animación con React Three se descartó.)
2. Al elegirlo **se pide el archivo SFC** (export de SFC, una fila por serial).
3. **Un item por DN**, con su fecha y hora de creación. Cada DN lleva **9 piezas** (serial + carton); si faltan, se piden con el escáner o a mano (en pruebas).
4. Del SFC se llenan los campos del reporte (tabla de abajo). **Sales Order, Part number NVIDIA, Shipped day, Customer PO y Customer DN** se escriben a mano.
5. La página **Pallets** (antes «Etiquetas») muestra cada item por separado: DN, fecha de creación, hora (más adelante, hora de edición) y quién lo trabajó (el usuario de la sesión).
6. **Ampliar un item** muestra todos los datos llenados desde el SFC.
7. Los items se ven como **cuadrícula de 5 × 3** (15 por página).
8. Si el SFC ya trae seriales con carton y Pallet ID, se muestran así; se pueden **corregir con el escáner** (en pruebas). La separación por Pallet ID va en Etiquetas.
9. **Etiquetas** pasa a ser otra opción, **en desarrollo**.

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

## Plan de desarrollo (frontend)

| Fase | Qué | Estado |
| --- | --- | --- |
| **F0** | Backend de Pallets en pausa: `PALLETS_DB = false` en `src/lib/db.ts` (tablas y endpoints se quedan) | ✅ 0.35 |
| **F1** | `readSfc()`, `faltan()`, `escanear()` y `plantilla()` en `src/lib/sfc.ts`, con prueba de datos inventados | ✅ 0.35 |
| **F2** | Carga: «Nuevo Pallet / Shipping Order» pide el SFC y crea o actualiza los items (`src/areas/pallets/Nuevo.tsx`) | ✅ 0.35 |
| **F3** | Página **Pallets**: cuadrícula 5 × 3, búsqueda, filtro y páginas (`Pallets.tsx`) | ✅ 0.35 |
| **F4** | **Ampliar item**: del SFC, a mano, datos del modelo, piezas y escáner en pruebas (`Item.tsx`) | ✅ 0.35 |
| **F5** | Exportar el **Shipping report CTO** (una fila por serial) | Pendiente |
| **F6** | **Etiquetas** por Pallet ID desde los items (hoy: la versión anterior, marcada «en desarrollo») | Pendiente |
| **F7** | Hora de edición por campo y validaciones con datos reales | Pendiente |
| **F8** | Reactivar el backend con el modelo nuevo (`pallet_items`) | Pendiente |

Los items viven en este navegador (`localStorage`, clave `yc-pallets`) y se borran al cerrar sesión.

### Archivos de Pallets hoy

- **Nuevo:** `src/lib/sfc.ts` (+ prueba), `src/areas/pallets/items.ts` (los items), `Nuevo.tsx` (Carga), `Pallets.tsx` (cuadrícula), `Item.tsx` (ampliado); estilos `.app-item*`, `.app-det*` en `src/styles/app.css`.
- **Etiquetas (en desarrollo, versión anterior):** `src/areas/pallets/Etiquetas.tsx`, `src/lib/pallets.ts`, `src/components/label.tsx`, `src/styles/yc.css`.
- **Backend en pausa:** `server/index.js` (`pallets()`), `server/validate.js`, funciones de Pallets en `src/lib/db.ts`.
- **Compartidos:** `src/areas.ts`, `src/main.tsx`, `src/pages/Carga.tsx`, `Validacion.tsx`, `Descargas.tsx`.

## Riesgos

- **Datos solo en el navegador** mientras el backend esté en pausa: se borran al cerrar sesión y otro equipo no los ve.
- **PN NVIDIA ≠ PN del SFC:** sin la plantilla, el reporte saldría con el número de parte equivocado.
- **Serial y carton:** en el SFC el serial (`SERIAL_NUMBER1`) es `MT…` y el carton (`MCARTON_NO`) es `FX…`, igual que en el reporte CTO.
- **Archivo SFC ancho:** trae miles de columnas vacías (`Column1…`); se lee todo el archivo, puede tardar unos segundos.
- **El serial tiene 2 formas** en el SFC (`MT…` con letra final y 12 dígitos): las dos se aceptan.
