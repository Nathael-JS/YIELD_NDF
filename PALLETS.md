# Pallets · nueva infraestructura (plan)

Pallets se rehace en el frontend. La versión anterior (0.28–0.34: etiqueta armada a mano, listado de entregas, tarimas en la base) sigue en el código y en el historial de git hasta que la reemplace cada fase. **El backend de Pallets queda en pausa** mientras se valida este plan.

> Los archivos de ejemplo se analizaron en un directorio aislado y se borraron. Este documento solo guarda la **estructura** (columnas y formas), nunca datos reales.

## Flujo nuevo

1. **Carga → «Nuevo Pallet / Shipping Order»**: crea un item dentro de PALLETS, con una animación de una caja que se arma para el embarque (React Three).
2. Al elegirlo **se pide el archivo SFC** (export de SFC, una fila por serial).
3. El item se identifica por su **DN** y su **fecha**.
4. Del SFC se llenan los campos del reporte (tabla de abajo). **Customer PO** y **Customer DN** se escriben a mano, con validación.
5. La página **Pallets** (antes «Etiquetas») muestra cada item por separado: DN, fecha de creación, hora (más adelante, hora de edición) y quién lo trabajó (el usuario de la sesión).
6. **Ampliar un item** muestra todos los datos llenados desde el SFC.
7. Los items se ven como **cuadrícula de 5 × 3** (15 por página).
8. Si el SFC ya trae seriales con caja y tarima, se muestran así; se pueden **corregir con el escáner** (en pruebas, igual que validar por Pallet ID).
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
| Shipped day | No está en el SFC; la hoja de instrucciones dice «Por definir» | ❓ ¿Fecha de embarque manual? `KANBAN_OUT_TIME` no es la de embarque |
| PO | SFC `CUST_PO` | ✅ |
| Sales Order | **No está en el SFC** (`SO_LINE` es la línea) | ❓ Viene del listado de entregas (`SO_NUMBER`) o es manual |
| Project | No está en el SFC; en el ejemplo siempre es `NVIDIA` | 🔧 Plantilla por modelo |
| Model | No está en el SFC (nombre comercial) | 🔧 Plantilla por modelo |
| delivery | SFC `DN` | ✅ |
| hazmat | No está en el SFC; texto fijo de batería («Same info always») | 🔧 Plantilla por modelo |
| partnumber | **El reporte usa el PN NVIDIA (`692-…`); el SFC trae el FXNN (`920-…`)** | ❓ Plantilla `920-…` → `692-…` por modelo |
| qty | 1 por serial (fila del reporte); total = número de seriales | ✅ Calculado |
| Serial | SFC `SERIAL_NUMBER1` | ✅ |
| Carton | SFC `MCARTON_NO` | ✅ Si está vacío: «sin caja» |
| Pallet ID | SFC `IMEI` | ✅ Si es `N/A`: «sin tarima» |
| COO | No está en el SFC; en el ejemplo, `MX` | 🔧 Plantilla (por omisión `MX`) |
| Unit price USD | No está en el SFC («MPM») | 🔧 Plantilla por modelo · **dato sensible** |
| Total price USD | Unit price × qty | ✅ Calculado |
| Customer PO | Manual (NVIDIA PO: 8 dígitos en el reporte actual) | ✍️ Validar `^\d{8}$` |
| Customer DN | Manual (NVIDIA DN: 8 dígitos en el reporte actual) | ✍️ Validar `^\d{8}$` |

✅ sale del SFC · 🔧 dato fijo por modelo (se llena una vez) · ✍️ manual · ❓ **por confirmar**

### Validaciones

- **Al cargar el SFC:** la hoja `data` y las columnas `DN`, `SERIAL_NUMBER1`, `MCARTON_NO` e `IMEI` son obligatorias. Un serial repetido se rechaza.
- **Un archivo con varios DN** crea un item por DN (la muestra trae 10). *Por confirmar.*
- **El mismo DN cargado otra vez:** se avisa y se actualiza el item. No se duplica.
- **Seriales sin tarima o sin caja:** se muestran aparte y no cuentan como listos.
- **Estado del serial:** `STOCKIN` = listo; cualquier otro `WIP_GROUP` = «en línea» (aviso).
- **Customer PO y DN:** 8 dígitos; el item queda «incompleto» sin ellos.
- **Precios:** solo en este equipo, nunca en la base ni en datos de prueba. Lo mismo para direcciones, cuentas y pedimentos.

## Plan de desarrollo (frontend)

| Fase | Qué | Archivos |
| --- | --- | --- |
| **F0** | Pausar el backend de Pallets (una constante en `db.ts`; tablas y endpoints se quedan) | `src/lib/db.ts` |
| **F1** | `readSfc()`: un item por DN con sus seriales, cajas y tarimas; validaciones; prueba con **datos inventados** | `src/lib/sfc.ts`, `sfc.test.ts` |
| **F2** | Carga: opción «Nuevo Pallet / Shipping Order» que pide el SFC y crea el item (guardado en el equipo, como los demás archivos) | `src/pages/Carga.tsx`, `src/store.ts` |
| **F3** | Página **Pallets**: cuadrícula 5 × 3 de items (DN, fecha, hora, quién), con paginación y búsqueda | `src/areas/pallets/Pallets.tsx`, `app.css` |
| **F4** | **Ampliar item**: los 17 campos, seriales por tarima y caja, campos manuales y plantilla por modelo | `src/areas/pallets/Item.tsx` |
| **F5** | **Animación** de la caja (React Three), cargada solo al crear un item para no pesar en la carga inicial | `src/components/BoxBuild.tsx` |
| **F6** | Escáner para corregir serial, caja o tarima (en pruebas) | Reusa `SerialInput` |
| **F7** | Exportar el **Shipping report CTO** (una fila por serial; los campos «Por definir» vacíos) | `src/lib/sfc.ts` |
| **F8** | Etiquetas como opción «en desarrollo»; revisión de diseño y sistema de diseño | `src/areas.ts`, artefacto |
| **F9** | Reactivar el backend con el modelo nuevo (`pallet_items`) | `server/` |

### Archivos de Pallets hoy

- **Diseño:** `src/areas/pallets/Pallets.tsx`, `Tarimas.tsx`, `Historial.tsx`; `src/components/label.tsx`; `src/styles/app.css` (`.app-pal-*`, `.app-tar-*`); `src/styles/yc.css` (etiqueta).
- **Función:** `src/lib/pallets.ts` (+ prueba), `src/lib/db.ts`, `server/index.js` (`pallets()`), `server/validate.js`.
- **Compartidos:** `src/areas.ts`, `src/main.tsx`, `src/pages/Carga.tsx`, `Validacion.tsx`, `Descargas.tsx`.

## Riesgos

- **React Three pesa** (~150 kB comprimido con `three`). Va en un chunk aparte que solo se descarga al crear un item; la carga inicial no cambia.
- **Datos solo en el navegador** mientras el backend esté en pausa: se borran al cerrar sesión y otro equipo no los ve.
- **PN NVIDIA ≠ PN del SFC:** sin la plantilla, el reporte saldría con el número de parte equivocado.
- **El serial tiene 2 formas** en el SFC (`MT…` con letra final y 12 dígitos): las dos se aceptan.
