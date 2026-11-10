# Errores encontrados y cómo se corrigieron

Cada entrada dice qué pasaba, cómo se detectó, la causa, la corrección y con qué se comprobó. Lo más reciente arriba. La versión indica dónde quedó corregido ([CHANGELOG.md](CHANGELOG.md)).

**Cómo se detectan:** pruebas con `node --test` (`npm test`), recorridos en el navegador con Playwright sobre los archivos reales (capturas en claro, oscuro, móvil y con movimiento reducido), revisión de código (*ponytail-review*), revisión de diseño (*design-review*) y comparación contra un cálculo independiente de los mismos archivos.

## Cálculo y datos

| # | Versión | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- | --- |
| E1 | 0.5.0 | Filas con 0 entradas se mostraban como 0 % de yield | División entre cero devuelta como 0 | Entradas 0 = sin dato (`NaN` → «—»); no entran a gráficas de porcentaje (guía, regla 2) | Prueba en `tcqs.test.ts`; 29 filas del TCQS real |
| E2 | 0.5.0 | En 17 filas FPY + Retest ≠ Final Yield; un retest de una unidad que entró antes del corte subía el yield | Se sumaban todos los segundos pases y solo se recortaba el Final a 100 % | Retest efectivo = min(Σ segundos pases, Σ primeras fallas) del grupo | Reproduce el ejemplo de la guía (1 ÷ 6 = 16.7 %); prueba `over.fpy + over.retest === over.final` |
| E3 | 0.5.0 | Los manifolds `SA016491/SA016492` quedaban fuera de Juliet | El BOM los nombra `MA016491/MA016492` | `modelKey` iguala MA y SA del mismo número de 6 dígitos; Validación muestra «en el BOM como MA…» | Prueba `modelKey`; 192 → 208 filas confirmadas con cálculo independiente |
| E4 | 0.5.0 | La comprobación «retests sin su 1ra falla» daba 0 sobre el periodo completo, donde se compensan | Se medía sobre el total y no por estación | Se cuenta por estación, como se leen las tablas | Recorrido en el navegador |
| E5 | 0.1.0 | Seriales como `00123` llegaban como `123` | `papaparse` con `dynamicTyping` convertía texto a número | El CSV se lee como texto; las cantidades se convierten al calcular | Prueba `parseFile … conserva ceros a la izquierda` |
| E6 | 0.1.0 | Un archivo con error dejaba activo el anterior y la comparación usaba datos viejos sin avisar | `setError` no quitaba el archivo previo | El error reemplaza al archivo (y desde 0.7.0 lo borra de lo guardado) | Recorrido: archivo .pdf en un espacio con archivo previo |
| E7 | 0.1.0 | Un CSV vacío mostraba un error de papaparse en inglés | Se mostraba el mensaje de la librería | Se ignoran los avisos de papaparse y se reporta «El archivo no tiene filas» | Prueba con archivo vacío |

## Interfaz y diseño

| # | Versión | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- | --- |
| E8 | 0.6.0 | El menú marcaba ✓ en pasos no hechos (p. ej. Carga sin archivos) | `PipelineNav` marcaba ✓ por posición | Prop `done` con el estado real | Recorrido: sin archivos no hay ✓; con archivos sí |
| E9 | 0.5.0 | La línea de la ilustración del login pasaba detrás del texto del usuario de prueba | Gráfica alta y aviso sin fondo | Gráfica al 34 % de alto y `.yc-login-hint` con fondo | *design-review* sobre capturas |
| E10 | 0.5.0 | Mientras se «leían» archivos en el login aparecía «En comparación» | Se usaba el estado `comparing` de `FileChip` | Estado `empty` → `loaded` | Captura a mitad de la animación |
| E11 | 0.5.0 | Las iniciales de «Usuario de prueba» salían «UD» | Se tomaban todas las palabras, incluida «de» | Se ignoran palabras de 2 letras o menos | Captura del menú |
| E12 | 0.5.0 | Insignias de Validación estiradas a todo el ancho de la columna | `grid` estira a sus hijos | `justify-self: start` | Captura |
| E13 | 0.4.0 | Nombres largos (LEAKAGE_CHECK_AVI, testers) se enciman en el eje del Pareto | `ParetoChart` usaba un ancho fijo de 48 px por etiqueta | Espaciado según la etiqueta más larga, como `BarChart` (también en el artefacto) | Capturas de Gráficos |
| E14 | 0.4.0 | «Comparar» del historial llevaba a una página que ya no existe | Se quitó Comparación | Lleva a Carga | Revisión de código |

## Dependencias y entorno

| # | Versión | Qué pasaba | Causa | Corrección |
| --- | --- | --- | --- | --- |
| E15 | 0.1.0 | `npm audit`: avisos en react-router 6 (redirección abierta) y en esbuild/tinypool | Versiones con vulnerabilidades conocidas | react-router-dom 7, Vite 7; 0 vulnerabilidades |
| E16 | 0.1.0 | `npm install` fallaba con vitest 4 (`Cannot read properties of null (reading 'edgesOut')`) | Error interno de npm al resolver dependencias de vitest | Se quitó vitest y se usa el probador de Node (`node --test`): una dependencia menos |
| E17 | 0.1.0 | No se pudo instalar SheetJS (`xlsx`) | Su descarga oficial está bloqueada en este entorno y la versión de npm (0.18.5) es vieja y con vulnerabilidades | `read-excel-file` (.xlsx) + `papaparse` (.csv), mantenidas y sin vulnerabilidades |

## 0.8.0

| # | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- |
| E18 | En el HTML descargado el título del carrusel y cada gráfica usaban la misma marca `data-title` | Mismo atributo para dos cosas; funcionaba solo por el orden del archivo | Marcas propias `data-show-title`/`data-show-kind` | Playwright sobre el archivo abierto con `file://` |
| E19 | Aviso de React «useLayoutEffect does nothing on the server» al generar el HTML | Las gráficas medían su ancho con `useLayoutEffect` | `useEffect` (en la app y en el artefacto) | Consola sin errores |
| E20 | El PDF partía con guion nombres como `WC_WASH_DRAIN_NI-TRO_FILL` | react-pdf separa palabras largas | `Font.registerHyphenationCallback` sin cortes y columna más ancha | PDF convertido a imagen con `pdftoppm` |
| E21 | El buscador del HTML no encontraba «critico» sin acento | Comparaba el texto tal cual | Compara sin mayúsculas ni acentos | Recorrido del HTML |
| E22 | `node --test server/` se quedaba colgado | Ejecutaba también `index.js`, que arranca el servidor | `npm test` corre solo `server/*.test.js` | `npm test` |

## 0.9.0

| # | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- |
| E23 | Cada recarga con los archivos guardados volvería a guardar la misma carga en Neon | El guardado automático no sabía qué ya se había guardado | `savedKey` (archivo + hora + BOM) guardado en el navegador; solo se guarda una vez | Recarga en Playwright: 1 fila en `yield_cargas` |
| E24 | El texto de Carga decía que nada se enviaba a un servidor | Desde 0.8.0 el resumen va a Neon | Texto corregido | Revisión |

## 0.10.0

| # | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- |
| E25 | Cualquiera con la dirección podía leer y escribir en `/api/resumen` y `/api/cargas` | La API no tenía cuentas | Sesión obligatoria (cookie firmada) | `curl` sin cookie → 401; cookie alterada → 401 |
| E26 | El navegador decía qué usuario y sesión guardaban cada carga | Venían en el cuerpo del POST | Los toma el servidor de la sesión | Revisión y recorrido |
| E27 | Cualquier `/api/…` desconocido se trataba como `/api/resumen` | Faltaba comprobar la ruta | 404 | `curl /api/otra` |

## 0.11.2

| # | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- |
| E28 | El botón Entrar podía no hacer nada sin mostrar error | Si el servidor respondía HTML con 200 (sitio estático), la respuesta se tomaba como éxito vacío | Se exige respuesta JSON; si no, mensaje claro | Playwright con respuesta HTML simulada |
| E29 | Con la base inaccesible al arrancar, el servidor se caía | Promesa rechazada sin manejar en Node 22 | Se registra el error y el servidor sigue; `/api/salud` lo explica | Servidor con contraseña de base errónea |

## 0.13.0

| # | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- |
| E30 | Las acciones de Cuentas rompían las filas de la tabla | `display: flex` puesto en la celda (`td`) | El flex va en un `div` dentro de la celda | Captura |
| E31 | «Cargas registradas» mostraba 0 con cargas guardadas | `n_live_tup` de Postgres se actualiza con retraso | Conteo exacto por tabla | Consulta directa |

## 0.15.0

| # | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- |
| E32 | La imagen descargada dejaba un hueco abajo | Filtrar botones y formulario no quitaba su espacio | Se ocultan con una clase mientras se toma la imagen | PNG revisado |
| E33 | 56 avisos de CSP al crear la imagen | `base-uri 'none'` bloqueaba el documento temporal de `html-to-image` | `base-uri 'self'` | Consola sin errores |

## 0.15.1

| # | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- |
| E34 | «Entradas» no mostraba las órdenes en Yield | Solo se cambió Inicio | También en Yield (HTML y PDF salen de ahí) | Playwright |
| E35 | Tampoco en Inicio con datos abiertos desde la base | La base no guardaba MO_NUMBER | Columna `ordenes` en `yield_resumen` | Prueba de ida y vuelta + Playwright (755 / 11 desde archivo y desde la base) |

## 0.19.0

| # | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- |
| E36 | El historial quedaba vacío si no se había subido el BOM | El guardado esperaba la lista de modelos | Se guarda con todos los modelos si no hay lista | Playwright sin `yield_modelos` |
| E37 | «Todo cuadra» en un día sin ejemplos guardados aunque el archivo tenía diferencias | Solo se guardan 10 ejemplos por columna | Siempre se muestran los totales del archivo; los ejemplos, si hay | Playwright 2 y 5 nov |

## 0.19.1 (revisión de código)

| # | Qué pasaba | Causa | Corrección | Comprobación |
| --- | --- | --- | --- | --- |
| E38 | Cada recarga agregaba 2 cargas al historial, una con modelos de otros proyectos | `modelos` era `null` tanto «cargando» como «sin lista» | `modelosListos` | Playwright: 2 recargas → 1 carga, 0 filas fuera de Juliet |
| E39 | Borrar una carga borraba datos de otra con el mismo nombre | Se borraba por rango + nombre de archivo | Columna `carga` en el resumen | Dos cargas `yield_tcqs.csv`: borrar la vieja deja las 27 filas de la nueva |
| E40 | El servidor no arrancaba (durante el desarrollo) | `purge` usada antes de declararse | Declarada antes | Arranque local |

## Abiertos

- **Ejemplos de lo que no cuadra:** se guardan 10 por columna para todo el archivo; para otros días se ven los totales, no las filas.
- **Respaldos:** vencen a los 7 días y se purgan al consultar Historial o los respaldos (no hay tarea programada); los guardados antes de 0.19.0 no existen.

- **Fondo 3D del login:** si se cambia entre tema claro y oscuro con el login abierto, la escena conserva los colores con los que cargó hasta recargar la página. No medido en un equipo real de planta (solo 60 fps en Chromium con CPU 4× más lento).

- **Comentarios:** no se editan ni se borran desde la app (sí desde la base).

- **Etiquetas inclinadas muy largas en muy poco ancho:** la primera puede salirse por la izquierda de la tarjeta. En el celular no pasa porque la gráfica de estaciones usa barras acostadas; si otra gráfica lo necesita, dar más margen izquierdo.

- **Un código MFA se puede reusar dentro de sus 30 s** (no se guarda el último usado). Riesgo bajo: también hace falta la contraseña.
- **Cambiar la contraseña no cierra las otras sesiones** (desactivar la cuenta sí).
- **`ADMIN_PASSWORD` en Render** ya no se usa cuando la cuenta principal existe: borrarla después del primer inicio.

- **El límite de intentos** vive en la memoria del servidor: se reinicia al reiniciar y no se comparte si hubiera varias instancias.
- **Cerrar sesión** borra la cookie del navegador, pero una cookie copiada sigue valiendo hasta que vence (12 h), salvo que se desactive la cuenta (desde 0.11.0 corta el acceso al instante).

- **Lo abierto desde Neon no trae testers** (se guarda día × modelo × estación): faltan el Pareto 2do nivel y el histograma por tester (5 gráficas en vez de 6).

- **Plan gratis de Render:** el servicio se duerme y el primer acceso tarda cerca de un minuto.

- La regla MA = SA podría confundir dos partes distintas que compartan número. Confirmar con el BOM si aparece un caso.
- Un enlace guardado `/yield#ESTACIÓN` no resalta nada si la estación cambia de nombre en otro TCQS.
- No verificado en Safari.
