# Yield Control

App web para cargar, comparar, validar y cruzar los archivos de prueba de producción (TCQS, DATA ANALYSIS, QM) y ver yield, WIP, unidades y Pareto de fallas. Corre en local: los archivos se leen en el navegador y no se envían a ningún servidor.

## Uso

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:5173, entra con **demo** / **yield2026** (o tu cuenta) y carga el TCQS (.csv o .xlsx) y el Excel del build con el BOM de Juliet.

```bash
npm test
```

```bash
npm run build
```

## Estructura

```
src/
  components/ui.tsx      componentes del sistema de diseño (botones, menú, KPIs, login…)
  components/charts.tsx  gráficas SVG (Pareto, barras, tendencia, histograma, dispersión)
  styles/                tokens.css (claro/oscuro), yc.css (componentes), app.css (páginas)
  lib/                   lectura de archivos, cálculos del TCQS y escalas de gráficas, con sus pruebas
  pages/                 una página por ruta
  store.ts               sesión, archivos e historial
```

## Neon y Render

1. En [Neon](https://neon.tech) crea un proyecto y copia su *connection string* (`postgres://…`).
2. En Render: **New → Blueprint** con este repositorio. Lee `render.yaml` y crea el servicio `yield-control`. En **Environment** pon `DATABASE_URL` (la cadena de Neon), `ADMIN_USER` (la cuenta principal, super administrador: si ya la creaste desde «Crear cuenta», queda activa con tu contraseña) y `ADMIN_PASSWORD` (solo se usa si la cuenta no existe; mínimo 10 caracteres). `SESSION_SECRET` la genera Render.

**Cuentas:** la de prueba `demo` / `yield2026` siempre está activa (quitarla antes de producción). Los administradores manejan las demás en **Cuentas** (menú superior).
3. La tabla `yield_resumen` se crea sola al arrancar. Sin `DATABASE_URL` la app funciona igual y los botones de Neon avisan que falta.

En local, con un Postgres o la misma cadena de Neon:

```bash
DATABASE_URL=postgres://… ADMIN_USER=admin ADMIN_PASSWORD=una-clave-larga npm start
```

```bash
npm run dev
```

`npm run dev` reenvía `/api` al servidor del puerto 3000.

## Documentos

- Plan de trabajo y fórmulas: [PLAN.md](PLAN.md)
- Versiones: [CHANGELOG.md](CHANGELOG.md)
- Errores encontrados y cómo se corrigieron: [ERRORES.md](ERRORES.md)
- Mejoras hechas, cómo y con qué; pendientes: [MEJORAS.md](MEJORAS.md)
