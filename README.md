# Yield Control

App web para cargar, comparar, validar y cruzar los archivos de prueba de producción (TCQS, DATA ANALYSIS, QM) y ver yield, WIP, unidades y Pareto de fallas. Corre en local: los archivos se leen en el navegador y no se envían a ningún servidor.

## Uso

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:5173 y entra con el usuario de prueba: **demo** / **yield2026**.

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
  lib/                   lectura de archivos y escalas de gráficas, con sus pruebas
  pages/                 una página por ruta
  store.ts               sesión, archivos e historial
  data/demo.ts           datos de ejemplo hasta definir los cálculos reales
```

El plan de trabajo está en [PLAN.md](PLAN.md).
