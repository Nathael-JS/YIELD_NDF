# Carga inteligente · plan (PENDIENTE: en pausa desde el 27 nov, se retoma después de WIP)

**Objetivo:** subir **cualquier Excel o CSV** en un solo lugar y que la app diga **qué es** («esto es un WIP», «esto es un SFC de embarque») y **a dónde va**, sin que el usuario tenga que saber qué casilla usar.

## 1. Qué es el machine learning (ML), en corto

- **Programar normal:** una persona escribe las reglas. Por ejemplo: «si tiene la columna `WIP_GROUP`, es un WIP».
- **Machine learning:** la computadora **aprende las reglas a partir de ejemplos**. Le damos muchos archivos ya etiquetados («este es WIP», «este es TCQS») y encuentra por su cuenta qué los distingue.
- **Las tres piezas:**
  1. **Características (features):** lo que el modelo mira de cada archivo. Aquí: los nombres de las columnas y la **forma** de los valores. Por ejemplo, `MT262770000T` → `AA999999999A`, `PALFX98195` → `AAAAA99999` y `2026-11-23 10:15` → fecha.
  2. **Entrenamiento:** con los ejemplos, el modelo calcula cuánto «pesa» cada característica para cada tipo. Por ejemplo, `IMEI` casi siempre aparece en archivos SFC y casi nunca en un TCQS.
  3. **Predicción:** llega un archivo nuevo, se sacan sus características y el modelo da un **puntaje por tipo**. Por ejemplo, «WIP 94 %, FirstFail 4 %…».
- **Esto se llama clasificación supervisada:** «supervisada» porque aprende de ejemplos con su respuesta correcta, y «clasificación» porque la salida es una categoría.
- **El modelo que proponemos es Naive Bayes:**
  - Cuenta qué tan seguido aparece cada palabra de los encabezados en cada tipo de archivo, y multiplica esas probabilidades.
  - Es el mismo principio de los filtros de spam de correo: «oferta», «gratis» y «gana» → probable spam.
  - Es pequeño (unas 40 líneas), corre en el navegador, se entiende y **aprende con pocos ejemplos**.
- **Qué NO es:**
  - No es un chat ni una IA generativa.
  - No manda datos a ningún servicio externo.
  - No «entiende» el archivo: reconoce patrones que ya vio.
  - **Se puede equivocar**, así que el usuario siempre confirma antes de cargar.

## 2. Por qué empezar con reglas y luego aprender

Cada tipo de archivo de la app ya tiene una **firma** clara (las columnas obligatorias):

| Tipo | Va a | Firma (ya existe en el código) |
| --- | --- | --- |
| TCQS | Yield → Carga | `REQUIRED` (`WORK_DATE`, `STATION_NAME`, `FIRST_PASS_QTY`…) |
| Primeras fallas | Yield → Carga | `FAIL_REQUIRED` (`ERROR_CODE`, `ERROR_DESC`…) |
| WIP del MES | WIP → Carga | `WIP_REQUIRED` (`WIP_GROUP`, `SECTION_NAME`, `IN_STATION_TIME`…) |
| SFC de embarque | Pallets → Nuevo Pallet | `SFC_REQUIRED` (`DN`, `SERIAL_NUMBER1`, `MCARTON_NO`, `IMEI`) |
| Estructura de flujo (yield de producción) | Base de datos → Flujo WIP | `readFlujo` (Proces Stage, Board Name, Model, Station) |
| Modelos de Juliet (BOM) | Base de datos → Modelos | `modelsFrom` |
| Tabla de piso | Pallets → Tabla de Pallets | Physical, palet, # carton |

Con una **regla de puntaje** (qué porcentaje de la firma trae el archivo) se reconocen casi todos los archivos de hoy, **sin ML**. El ML entra para lo que las reglas no alcanzan:
- un **reporte con columnas renombradas** o en otro idioma;
- un **tipo nuevo** que todavía no tiene firma;
- archivos donde el encabezado no está en el primer renglón o la hoja útil no es la primera.

## 3. Cómo funciona de punta a punta

```
Archivo (.xlsx / .csv)
  └─ 1. Leer: todas las hojas; en cada una, buscar el renglón de encabezado (los primeros 15)
      └─ 2. Características: palabras de los encabezados + forma de 20 valores por columna (sin guardar los valores)
          └─ 3. Clasificar:
                a) Reglas: % de la firma de cada tipo   →  si ≥ 90 %, listo
                b) Naive Bayes con los ejemplos aprendidos →  puntaje por tipo
          └─ 4. Mostrar: «Parece un WIP del MES (94 %) · hoja "data" · 2,400 filas»  [Cargar en WIP]  [Es otro ▾]
              └─ 5. El usuario confirma o corrige
                  └─ 6. Aprender: se guarda el ejemplo (tipo + características, SIN datos) en la base
                      └─ 7. Cargar: el archivo va a su lector de siempre (readWip, readSfc, readFlujo…)
```

- **Privacidad:** a la base solo van las palabras de los encabezados y las formas (`AA999999999A`), **nunca los valores**, ni seriales, ni precios.
- **Ventaja de este diseño:** cada corrección del usuario hace que el modelo acierte más la siguiente vez, y lo aprendido sirve en todos los equipos.

## 4. Fases

| Fase | Qué | Archivos |
| --- | --- | --- |
| **ML0** | **Lector general:** todas las hojas del xlsx y el renglón de encabezado aunque no sea el primero (hoy solo se lee la primera hoja y el primer renglón) | `src/lib/files.ts` |
| **ML1** | **Detector por reglas:** `detectar(archivo)` → tipos con su puntaje, usando las firmas que ya existen; con prueba | `src/lib/detectar.ts` |
| **ML2** | **Carga inteligente:** una zona de carga única (en Áreas o en Carga de cada área) que muestra «Parece…», el botón «Cargar en…» y «Es otro»; el archivo va al lector de su tipo | `src/pages/Carga.tsx`, `Areas.tsx` |
| **ML3** | **Aprender:** tabla `ml_ejemplos` (tipo, palabras, formas, quién y cuándo) y `GET/POST /api/ml/ejemplos`; se guarda cada confirmación o corrección | `server/` |
| **ML4** | **Naive Bayes** en el navegador, entrenado con los ejemplos; se combina con las reglas. Con prueba: ejemplos inventados, archivo renombrado y tipo nuevo | `src/lib/detectar.ts` |
| **ML5** | **Calidad:** página en Base de datos con cuántos ejemplos hay por tipo, aciertos y errores (matriz de confusión) y botón para borrar un ejemplo malo | `src/pages/Base.tsx` |

**Sin dependencias nuevas:** Naive Bayes son unas 40 líneas. Si después hiciera falta algo más fuerte (por ejemplo, entender el contenido de las celdas), se evalúa en ese momento.

## 5. Riesgos

- **Confundir dos reportes parecidos.** El WIP y FirstFail comparten `SERIAL_NUMBER`, `MODEL_NAME` y `MO_NUMBER`. Lo resuelven las columnas que los distinguen (`WIP_GROUP` contra `ERROR_CODE`), y **siempre se confirma** antes de cargar.
- **Pocos ejemplos al inicio:** las reglas cubren lo de hoy y el ML mejora con el uso.
- **Ejemplos malos** (alguien confirma mal): ML5 permite verlos y borrarlos.
- **Archivos muy grandes:** para detectar solo se leen los primeros renglones de cada hoja.

## 6. Por confirmar

1. **¿Dónde va la zona de «carga inteligente»?** En la pantalla de Áreas (sube y te lleva al área correcta) o en Carga de cada área.
2. **¿Quién puede enseñarle?** Cualquier usuario, o solo un administrador confirma los ejemplos nuevos.
3. **Tipos nuevos:** cuando llegue un archivo que no es de ningún tipo conocido, ¿lo marcamos como «desconocido» o damos de alta el tipo?
