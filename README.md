# Yield Control

App web para cargar, comparar, validar y cruzar los archivos de prueba de producción (TCQS, DATA ANALYSIS, QM) y ver yield, WIP, unidades y Pareto de fallas. Corre en local: los archivos se leen en el navegador y no se envían a ningún servidor.

## Uso

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:5173, entra con el usuario de prueba **demo** / **yield2026** y carga el TCQS (.csv o .xlsx) y el Excel del build con el BOM de Juliet.

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

- Plan de trabajo y fórmulas: [PLAN.md](PLAN.md)
- Versiones: [CHANGELOG.md](CHANGELOG.md)
- Errores encontrados y cómo se corrigieron: [ERRORES.md](ERRORES.md)
- Mejoras hechas, cómo y con qué; pendientes: [MEJORAS.md](MEJORAS.md)
