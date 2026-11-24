# Pallets

Arma las tarimas de embarque desde el listado de entregas, captura sus seriales e imprime la etiqueta de 4×6 in. Página **Pallets** (riel izquierdo). Versiones en [CHANGELOG.md](CHANGELOG.md) (0.28.0 diseño, 0.29.0 funcional).

## Función

| Archivo (Carga) | Qué trae | Para qué |
| --- | --- | --- |
| **Listado de entregas** (`download`, SAP) | Una fila por DN: `DN_NO`, `SO_NUMBER`, `TO_NO`, `MODEL_NAME`, `SHIPPING_QTY`, `CUST_PO`, cliente, destino, pesos | Cada entrega crea una tarima con esos datos ya puestos |
| **Tarimas** (CSV exportado desde Pallets) | La tabla limpia de tarimas | Volver a cargar tarimas editadas en Excel |

- El código vive en `src/lib/pallets.ts` (con pruebas en `pallets.test.ts`) y la página en `src/pages/Pallets.tsx`.
- Al elegir una entrega se llenan SO, T/O (sin ceros a la izquierda), PO, modelo, piezas, cliente, destino y pesos. **El FXNN DN y el NVIDIA DN se escriben a mano**; el DN del listado se ve como guía dentro del campo. Cargar estos datos desde un archivo o una imagen está pendiente de definir.
- El listado de entregas (y el WIP) acepta **uno o varios archivos**: se unen por nombre de columna y una entrega repetida queda una sola vez.
- **El shipping report ya no se carga (0.34):** sus campos siguen en el formulario, que se ve completo aunque no haya archivo. HTS, COO, nota de batería, medidas, Incoterm y Carrier se toman de otra tarima del mismo número de parte, si la hay. Se propone el siguiente Internal Ref (`FGNS-AAAAMMDD-NNN`).
- El formulario va por áreas, igual que el reporte: **Shipping**, **Fulfillment** e **ITC**. Cada una muestra su avance y marca los campos que vienen «del listado».
- Las filas del reporte sin Internal Ref pertenecen al embarque de arriba. Las filas sin Pallet # (por ejemplo, el embarque de 154 piezas) se cuentan, pero no se listan.

## Validación

La tarima queda **Lista para imprimir** solo cuando:

- Están todos los obligatorios: Pallet #, Internal Ref, DN, NVIDIA DN, Part number, Piezas, Cajas, Peso neto y bruto, Medidas, HTS, COO y Fecha de envío.
- El peso neto no es mayor que el bruto.
- El Pallet # tiene el formato `PAL…` + números (por ejemplo `PALFX98195`) y **no se repite** en las tarimas del equipo ni en la base. Su propio número no cuenta, para poder reimprimir.
- Los seriales capturados cuadran con las piezas. Un serial duplicado no entra.

Estados: **Incompleta** → **Lista para imprimir** → **Impresa** (con fecha). Cualquier cambio después de imprimir la regresa a «Lista».

## Cruce con el WIP (extra)

Si hay un WIP cargado, cada serial se busca en él. **Solo avisa, no bloquea la impresión:**

- **Aún en línea:** el serial está en una estación de proceso (por ejemplo `WC_PRESSURE`).
- **No aparece en el WIP cargado.**
- Los seriales en STOCKIN, FG, PACK_CTN o PACK_PALT cuentan como listos, porque es lo esperado al armar una tarima.

## Etiqueta

- **4×6 in**, negro sobre blanco para impresora térmica, en cualquier tema de la app.
- **Code128** (juego B) con el Pallet #, para los escáneres de muelle. El codificador es propio: `src/lib/code128.ts`, con prueba.
- **QR** (nivel M: aguanta ~15 % de daño) con todos los datos, una línea por dato, y los seriales al final, solo en ASCII:

  ```
  PALLET:PALFX98195
  REF:FGNS-20260805-001
  DN:5276000000 · SO · PO · TO · PN · QTY · CTN · NW · GW · DIM · COO · HTS · DATE
  SN:MT262770000T,MT262770000L,…
  ```

  Lo genera `qrcode-generator` (MIT, sin dependencias). Una tarima de 21 piezas da unos 500 caracteres; el QR admite más de 2,000.
- Jerarquía de la etiqueta:
  1. Cliente y destino (el cliente se corta con «…»; el destino siempre se ve completo).
  2. Pallet # en grande con su código de barras.
  3. Datos en dos columnas.
  4. Nota de batería en recuadro.
  5. QR.
  6. «Tarima 1 de N».
- Hay dos variantes en pantalla: **QR grande** o **Más texto**.
- **Comprobado:** ambos códigos se leen con zxing desde el PDF a 300 y a 203 dpi, que es la resolución de una térmica común.

## QR y escáner

- **Descargar QR (PNG):** el QR de la tarima como imagen, con fondo blanco y su margen.
- **Cargar QR:** lee el QR de una foto o captura (jsQR, solo se descarga al usarlo) y abre esa tarima: la guardada, si ya está en el equipo, o una nueva.
- **Escáner:** conecta un escáner USB en modo teclado (HID) con sufijo Enter y escanea en «Seriales de la tarima». Cada lectura dice si vino del **escáner** (menos de ~35 ms por carácter, por ejemplo «8 ms por carácter») o del **teclado**: así se comprueba que el escáner está bien configurado. Si escaneas el QR de una etiqueta en ese campo, no lo toma como serial y avisa.
- **Modo prueba ×9:** cada lectura entra 9 veces (la escaneada más 8 copias) para llenar el QR como una tarima de 9 piezas. Pone las piezas en 9 y la etiqueta sale marcada **PRUEBA**, también impresa; el QR lleva `TEST:1`. Apagado, los duplicados se siguen rechazando.

## Tarimas

- Se guardan **en este equipo** como un archivo más (IndexedDB, tipo `TARIMAS`), con la **misma tabla** del CSV. No hay dos formatos.
- Se guardan también **en la base** (`pallet_tarimas`). La página **Tarimas** las lista por día, con hora de subida, quién la subió, estado y «Abrir»; las que solo están en este equipo llevan la marca «Solo en este equipo».
- Desde ahí se edita y se reimprime. «Guardar cambios» reemplaza la tarima por su Pallet # original.

## Exportar

- **Exportar tarimas (CSV)**: `tarimas-AAAA-MM-DD.csv`, una fila por tarima. Los números largos (seriales de 14 dígitos) van como `="…"` para que Excel no los convierta en 6.2E+13. Tiene encabezados en español, codificación UTF-8 con BOM (Excel abre bien los acentos), comillas donde hace falta y los seriales separados por espacio.
- Se edita en Excel y **se vuelve a cargar** en Carga → *Tarimas*. La tabla cargada reemplaza a la del equipo: es la «nueva carga».

## Sistema de diseño

En el artefacto *Yield Control* (versión 39):

- **`PalletLabel`**: la etiqueta. Props `d` (datos), `qr` (texto del QR), `variant` (`qr` | `text`) y `sample` (sello «MUESTRA», para ejemplos; no se imprime).
- **`Qr`** y **`Barcode`**: los códigos sueltos.
- **`SerialInput`**: captura con escáner o teclado, contador «5 / 7», un duplicado no entra y tiembla, y cada serial tiene su «×».

Se compilan con esbuild desde `src/components/label.tsx` y `ui.tsx`: una sola fuente para la app y el sistema de diseño. Los estilos están en `src/styles/yc.css` (bloque «Etiqueta de tarima»).

## Impresión del PDF

1. **Descargar PDF**: `etiqueta-PALFX….pdf`, una página de 288×432 pt (4×6 in). La tarima queda «Impresa».
2. Ábrelo e imprime con la impresora de etiquetas, en **tamaño real / 100 %**, nunca «Ajustar a la página», y con papel **4×6 in**.
3. **Zebra:** en el controlador, Preferencias → Papel 4.00 × 6.00 in. El botón «Imprimir» de la página también sirve (`@page` de 4×6 in, una hoja), pero el PDF da el tamaño más confiable.
4. **Prueba:** escanea el QR con el celular; debe mostrar todos los datos y los seriales.

## Riesgos

- **Tarimas guardadas sin conexión:** quedan solo en el navegador y se borran al cerrar sesión. **Exporta el CSV antes de salir** si viste el aviso.
- **Datos sensibles:** la base guarda solo los campos de la etiqueta y los seriales; el shipping report (direcciones, pedimentos, precios) ya no se carga.
- **Pallet # repetido:** la base lo rechaza (409). Sin conexión, solo se revisa contra este equipo.
- **Sin probar en impresora real:** haz la prueba del paso 4 de la impresión antes de usarlo en piso.
- **Fechas del reporte en 3 formatos** (ISO, `20/08/2026`, `23/10/2026 10:30 AM`): se muestran tal cual, sin convertir.
- **El número HDG4** perdió dígitos en el Excel (notación científica); no se usa.

### Endpoints (revisados el 26 nov)

Una prueba de humo recorre la API en 20 casos:
- `/api/salud` responde 200.
- Sin sesión, `/api/me`, `/api/cargas` y `/api/resumen` responden 401.
- Un POST sin JSON responde 415 y un método incorrecto, 405.
- El login funciona en sus dos pasos (contraseña y código MFA).
- Con sesión, `/api/me`, `/api/cargas`, `/api/resumen`, `/api/modelos`, `/api/usuarios`, `/api/base`, `/api/respaldos` y `/api/comentarios` responden 200.
- Al salir, el acceso vuelve a dar 401.

Los endpoints de Pallets están abajo. La sesión es un token firmado: salir borra la cookie, pero el servidor no lo invalida; conviene revisarlo al agregar los endpoints de tarimas.

### Base de datos (0.34)

- `pallet_cargas`: cada listado de entregas cargado (archivo, quién, cuántas entregas, las entregas y la fecha y hora de subida). Se guarda solo al cargarlo en Carga. En **Historial** se ve la lista y «Usar este listado» lo vuelve a cargar sin el archivo.
- `pallet_tarimas`: una fila por tarima. El **Pallet # es único en toda la base**: una tarima nueva con un Pallet # que ya existe responde 409. Editar la misma tarima la actualiza, y renombrarla a un Pallet # ocupado también da 409 y se deshace todo.
- `GET/POST /api/pallets/cargas` (`?id=` trae las entregas) y `GET/POST /api/pallets/tarimas` (`antes` = edición), con validación en el servidor (`validateEntregas`, `validateTarima`).
- **Sin conexión:** las tarimas se guardan en el equipo con aviso. Las de la base se muestran junto con las del equipo en Etiquetas y en la página **Tarimas** (por fecha y hora de subida).

### Próximo: base de datos

- **WIP** y **Yield por área** con el mismo patrón: tabla + endpoint + validación + línea en `npm run check`.
- **Permisos por área** (el administrador asigna WIP, YIELD o PALLETS a cada cuenta) y validarlos en cada endpoint.
- **Cerrar sesión en el servidor** (hoy el token sigue válido hasta vencer).
- Cargar DN y NVIDIA DN desde un archivo (pendiente de definir).
