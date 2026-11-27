# Base de datos PostgreSQL: despliegue

Cómo crear desde cero la base de Yield Control en PostgreSQL, conectarla y dejarla lista: en tu máquina, en Neon con Render, o en un servidor propio. También cómo comprobarla, respaldarla y dejarla limpia otra vez.

> Los valores de esta guía son de ejemplo. Las contraseñas y la cadena de conexión reales van **solo** en las variables del servidor (Render → Environment, o el archivo de entorno del servicio), nunca en el repositorio ni en un chat.

## Índice

1. [Cómo se conecta la app a la base](#1-cómo-se-conecta-la-app-a-la-base)
2. [Requisitos](#2-requisitos)
3. [Crear la base](#3-crear-la-base)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Compilar y arrancar](#5-compilar-y-arrancar)
6. [Cuenta principal y MFA](#6-cuenta-principal-y-mfa)
7. [Tablas](#7-tablas)
8. [Despliegue en Render con Neon](#8-despliegue-en-render-con-neon)
9. [Respaldos y restauración](#9-respaldos-y-restauración)
10. [Entorno limpio](#10-entorno-limpio)
11. [Comprobaciones](#11-comprobaciones)
12. [Problemas comunes](#12-problemas-comunes)

---

## 1. Cómo se conecta la app a la base

```
Navegador ──► server/index.js ──► PostgreSQL
 (lee los         │  (API con sesión; DATABASE_URL vive solo aquí)
  archivos)       ▼
               dist/ (la app compilada)
```

- **Solo `server/index.js`** habla con PostgreSQL, con `pg` y una sola variable: `DATABASE_URL`. El navegador nunca ve la conexión.
- Los Excel y CSV **se leen en el navegador**. A la base solo llega lo que hace falta guardar: el resumen de Yield, los cortes de WIP, la estructura de flujo, los pallets y las cuentas.
- **Al arrancar, el servidor crea las tablas** que falten y agrega las columnas nuevas (`create table if not exists` y `alter table … add column if not exists`). No hay migraciones que correr a mano.
- **Sin `DATABASE_URL`, la app funciona igual** con lo que carga cada equipo, y los botones que guardan en la base avisan que no hay conexión.
- **Si la base no responde al arrancar,** el servidor sigue en pie y `/api/salud` dice qué pasa.

## 2. Requisitos

| Qué | Versión |
|---|---|
| Node.js | 22 o más nuevo (Render usa `NODE_VERSION=22`) |
| PostgreSQL | 13 o más nuevo (Neon, Render Postgres, Supabase, RDS o uno propio) |
| npm | el que trae Node |

```bash
git clone https://github.com/Nathael-JS/YIELD_NDF.git
```
```bash
cd YIELD_NDF
```
```bash
npm ci
```

## 3. Crear la base

Como usuario `postgres`, una sola vez. Usa un usuario **solo para la app**, no el dueño del servidor, y cambia `CAMBIAR` por una contraseña larga:

```bash
sudo -u postgres psql -c "create role yield_app login password 'CAMBIAR'" -c "create database yield owner yield_app"
```

- La app crea las tablas sola en el paso 5; no hace falta ningún script SQL.
- Si al conectar sale `Peer authentication failed` o `password authentication failed`: en `pg_hba.conf`, cambia el método de las líneas `local` y `host 127.0.0.1/32` a `scram-sha-256` y reinicia:
  ```bash
  sudo systemctl restart postgresql
  ```

## 4. Variables de entorno

| Variable | Para qué | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Conexión: `postgres://USUARIO:CLAVE@SERVIDOR:PUERTO/BASE`. Fuera de la red del servidor, agrega `?sslmode=require` | `postgres://yield_app:CAMBIAR@localhost:5432/yield` |
| `ADMIN_USER` | Usuario de la **cuenta principal** (super administrador). Ningún otro administrador puede desactivarla ni quitarle el rol | `nombre.apellido@empresa.com` |
| `ADMIN_PASSWORD` | Contraseña **temporal** para crear la cuenta principal la primera vez. Después se borra | una clave larga |
| `SESSION_SECRET` | Firma las sesiones. Sin ella, las sesiones se pierden al reiniciar. En Render se genera sola | 64 caracteres al azar |
| `PORT` | Puerto (Render lo pone solo) | `3000` |
| `NODE_ENV` | Con `production` (o en Render), las cookies van solo por HTTPS | `production` |

**Caracteres especiales en la contraseña de la base.** En `DATABASE_URL` hay que codificar `@ # / : % ? &`; por ejemplo, `Clave@2026#` se escribe `Clave%402026%23`. Para codificarla sin que quede en el historial:

```bash
read -rs CLAVE; node -e 'console.log(encodeURIComponent(process.argv[1]))' "$CLAVE"; unset CLAVE
```

Para generar un `SESSION_SECRET`:

```bash
node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
```

## 5. Compilar y arrancar

```bash
npm run build
```
```bash
DATABASE_URL='postgres://yield_app:CAMBIAR@localhost:5432/yield' ADMIN_USER=admin ADMIN_PASSWORD='Clave-Temporal-Larga' SESSION_SECRET='…' npm start
```

Abre `http://localhost:3000`. En el log debe salir:

```
Yield Control en el puerto 3000 con base de datos
Cuenta principal: admin creada; pedirá cambiar la contraseña y configurar el MFA
```

> Las variables escritas antes de `npm start` quedan en el historial de la terminal. En una máquina compartida, ponlas en un archivo con permisos `600` y arranca con `node --env-file=.env server/index.js`. El archivo `.env` no se sube al repositorio.

## 6. Cuenta principal y MFA

**Cómo nace la cuenta principal.** En cada arranque:

- si la cuenta `ADMIN_USER` **no existe** y hay `ADMIN_PASSWORD`, se crea como administradora y con la contraseña marcada como temporal;
- si **ya existe** (por ejemplo, creada desde «Crear cuenta»), se activa como administradora y **conserva su contraseña**;
- sin `ADMIN_USER`, el log avisa «falta ADMIN_USER».

**Primer inicio de sesión:**

1. Entra con `ADMIN_USER` y la contraseña temporal.
2. La app pide cambiar la contraseña.
3. Luego pide vincular la app autenticadora (Google o Microsoft Authenticator) con el QR. El secreto **se guarda solo cuando el primer código de 6 dígitos es correcto**.
4. Borra `ADMIN_PASSWORD` del entorno: ya no hace falta.

**Las demás cuentas** se piden desde el login («Crear cuenta») y un administrador las activa en **Cuentas**. Los administradores siempre usan MFA.

**Dónde queda el MFA.** En la tabla `usuarios`, columna `mfa` (el secreto confirmado) y `mfa_nuevo` (uno en configuración). El MFA es **por base**: tu base local y la de Render tienen cada una su registro, y en el teléfono quedan dos entradas (conviene renombrarlas, por ejemplo «Yield local» y «Yield Render»).

> La columna `mfa` es tan sensible como una contraseña: con ella se generan códigos válidos. No la copies ni la compartas.

**Reiniciar el MFA (teléfono perdido o cambiado):**

- **Cualquier cuenta:** un administrador, en **Cuentas → Reiniciar MFA**. En el siguiente inicio de sesión vuelve a salir el QR.
- **La cuenta principal, si nadie más puede entrar:** directo en la base.
  ```bash
  psql "$DATABASE_URL" -c "update usuarios set mfa = null, mfa_nuevo = null where usuario = 'correo-de-la-cuenta-principal'"
  ```

**Para ver quién tiene MFA**, sin mostrar los secretos:

```bash
psql "$DATABASE_URL" -c "select usuario, activo, admin, mfa is not null as mfa from usuarios order by admin desc, usuario"
```

**Cuenta de prueba.** El servidor mantiene activa la cuenta `demo` con una contraseña pública. Quítala antes de entregar a producción con usuarios reales: en `server/index.js`, junto a la creación de la cuenta principal.

**Límite de intentos:** 5 contraseñas incorrectas desde la misma dirección en 15 minutos bloquean el login de esa dirección durante 15 minutos.

## 7. Tablas

El servidor las crea al arrancar; `npm run check` revisa que estén todas con sus columnas.

| Tabla | Qué guarda |
|---|---|
| `usuarios` | Cuentas: usuario, nombre, contraseña cifrada, activo, administrador, contraseña temporal y MFA |
| `yield_resumen` | Resumen de Yield por día × modelo × estación (entradas, primer pase, primera falla, segundo pase y órdenes) |
| `yield_cargas` | Cada carga de Yield: quién, cuándo, el rango de fechas, los totales y la congruencia |
| `yield_respaldos` | Respaldos de 7 días antes de reemplazar datos; se borran solos al vencer |
| `yield_modelos` | Modelos de Juliet (BOM) |
| `yield_comentarios` | Comentarios en las gráficas |
| `wip_cortes` | Cada WIP cargado: el resumen por estación × modelo y las piezas en proceso (`detalle`) |
| `wip_flujo` | Estructura de flujo (Process Stage → Board → Model → Station) del reporte de yield; vale la más reciente |
| `pallet_cargas` | Cada SFC de embarque cargado (sin precios) |
| `pallet_tarimas` | Tarimas, con la fecha en que se imprimió la etiqueta |
| `pallet_items` | Un registro por DN, con sus piezas (sin precios) |

**Qué no se guarda nunca:** precios unitarios, direcciones de clientes, pedimentos ni cuentas. Esos datos se quedan en el navegador de quien carga el archivo.

## 8. Despliegue en Render con Neon

1. En [Neon](https://neon.tech), crea un proyecto y copia su *connection string* (`postgres://…?sslmode=require`).
2. En Render: **New → Blueprint** con este repositorio, rama `main`. Lee `render.yaml` y crea el **Web Service** `yield-control` (Node). No uses un *Static Site*: no tiene servidor y la API respondería con la página.
3. En **Environment** del servicio:
   - `DATABASE_URL`: la cadena de Neon;
   - `ADMIN_USER`: el correo de la cuenta principal;
   - `ADMIN_PASSWORD`: una contraseña temporal;
   - `SESSION_SECRET`: Render la genera sola.
4. Espera el deploy («Live») y abre `https://<servicio>.onrender.com/api/salud`. Debe responder JSON con `"base": true`.
5. Entra con la cuenta principal, cambia la contraseña y vincula el MFA. Luego **borra `ADMIN_PASSWORD`** en Render.

**Con PostgreSQL propio en lugar de Neon:** crea la base como en el paso 3 y pon su cadena en `DATABASE_URL`. Para pasar los datos desde Neon (una vez):

```bash
pg_dump --no-owner --no-acl "$NEON_URL" | psql "$NUEVA_URL"
```

## 9. Respaldos y restauración

**Respaldo** (diario, con cron del servidor o un Cron Job de Render):

```bash
pg_dump -Fc "$DATABASE_URL" -f yield-$(date +%F).dump
```

**Restaurar:**

```bash
pg_restore --clean --no-owner -d "$DATABASE_URL" yield-AAAA-MM-DD.dump
```

- El respaldo incluye la columna `mfa`: guárdalo cifrado o en un lugar con acceso restringido.
- Al restaurar en otra base, el MFA viaja con él y sirve la misma entrada del teléfono.
- Aparte, la app guarda **respaldos de 7 días** en `yield_respaldos` antes de reemplazar datos de Yield (Base de datos → Respaldos). No sustituyen a `pg_dump`.

## 10. Entorno limpio

**Opción A: vaciar los datos y conservar las cuentas.** Es la recomendada para volver a probar. Primero saca un respaldo (paso 9); después:

```bash
psql "$DATABASE_URL" -c "truncate yield_resumen, yield_cargas, yield_respaldos, yield_modelos, yield_comentarios, wip_cortes, wip_flujo, pallet_cargas, pallet_tarimas, pallet_items restart identity"
```

**Opción B: borrar la base completa.** Se pierde todo, incluidas las cuentas y el MFA:

```bash
sudo -u postgres psql -c "drop database yield" -c "create database yield owner yield_app"
```

Al arrancar, la app vuelve a crear las tablas y la cuenta principal (paso 5).

**Pruebas:** `npm test` no toca la base; usa datos inventados. Para probar la app completa en local, usa **otra** base (por ejemplo `yield_pruebas`) y bórrala al terminar. Nunca dejes en ella datos reales de producción.

## 11. Comprobaciones

| Qué | Cómo | Resultado esperado |
|---|---|---|
| La app responde | `curl -s http://localhost:3000/api/salud` | `{"servidor":true,"base":true,…}` |
| Tablas, columnas, índice y cuentas | `DATABASE_URL=… npm run check` | todo `OK` (es **solo lectura**; sale con código 1 si algo falla) |
| La API pide sesión | `npm run check -- --api https://<servicio>.onrender.com` | `/api/salud` abierto, lo demás 401, y los rechazos 405 y 415 |
| Tablas creadas | `psql "$DATABASE_URL" -c "\dt"` | las 11 tablas |
| Los datos se guardan | cargar un WIP, reiniciar el servidor y abrir el Dashboard | el corte sigue ahí |

En Render: *Shell* del servicio → `npm run check` (ya tiene `DATABASE_URL`).

> `npm run check` no prueba contraseñas, para no activar el límite de intentos.

## 12. Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| `TypeError: Invalid URL` al arrancar | La contraseña de `DATABASE_URL` tiene `@ # / : % ? &` | Codifícala (paso 4) |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL no está corriendo | `sudo systemctl start postgresql` |
| `password authentication failed` | Usuario o clave mal, o `pg_hba.conf` en `peer` | Paso 3 |
| `database "…" does not exist` | No se creó la base | Paso 3 |
| `no pg_hba.conf entry … SSL off` o `connection is insecure` | La base pide SSL | Agrega `?sslmode=require` a `DATABASE_URL` |
| «El servidor respondió una página y no la API» | En Render el servicio es un Static Site | Crea el Web Service con el Blueprint (paso 8) y borra el sitio estático |
| `/api/salud` dice `"base": false` | Falta `DATABASE_URL` o la base no respondió al arrancar | Revisa la variable y el log («No se pudo preparar la base: …») |
| «Cuenta principal: … no existe» en el log | Falta `ADMIN_PASSWORD` la primera vez | Ponla, reinicia, entra y luego bórrala |
| Todos salen de su sesión al reiniciar | Falta `SESSION_SECRET` | Ponla en el entorno (Render la genera) |
| El código de 6 dígitos no pasa | Hora desfasada, o la entrada del teléfono es de otra base | Revisa `timedatectl` (`System clock synchronized: yes`) y la hora automática del teléfono; o reinicia el MFA (paso 6) |
| «Demasiados intentos. Espera 15 minutos.» | 5 contraseñas incorrectas desde la misma dirección | Espera 15 min o reinicia el servidor |
| La página sale en blanco | Falta compilar | `npm run build` |
| «Archivo demasiado grande (máx. 5 MB)» al guardar | El cuerpo de la petición pasa de 5 MB | Un WIP guarda hasta 25,000 piezas por corte |
