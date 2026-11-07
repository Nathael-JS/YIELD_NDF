# Plan de trabajo — Yield Control

App de yield para el proyecto **Juliet**, basada en el sistema de diseño **Yield Control** (artefacto `RqMowPxsmEFcuTiJy8Ntxu`). Todo corre en el navegador: los archivos no salen del equipo. Publicada en Render como sitio estático (`render.yaml`).

## Flujo

```
Login → Carga de datos → Validación → Yield        (+ Gráficos, Historial)
         TCQS + Excel BOM  filas y modelos  KPIs, estaciones, tendencia, Pareto
```

## Archivos

| Archivo | Qué trae | Cómo se usa |
| --- | --- | --- |
| **TCQS** (.csv/.xlsx) | Una fila por fecha × modelo × orden (MO) × estación (`GROUP_NAME`) × tester (`STATION_NAME`) con cantidades | Fuente de todos los cálculos. Columnas obligatorias en `src/lib/tcqs.ts` (`REQUIRED`) |
| **Modelos · Juliet** (.xlsx del build) | Hoja *BOM and MO* con los números de modelo dentro del texto | Se extraen los modelos (`920-9K33R-00MV-GS0`, `SA029400`…) y el TCQS se filtra a ellos |
| DATA ANALYSIS, QM | — | **Pendientes.** Se cruzarán con llave **serial + estación** |

## Cálculos

Verificados contra las tasas del propio TCQS (211/211 filas) y contra la *Guía de interpretación – YieldRateSFC y RetestRate* (el SFC es otro sistema, pero las operaciones aplican). Todo es **ponderado** (Σ ÷ Σ, fórmula 10 de la guía), nunca promedio de porcentajes de filas (fórmula 9, la que usa el SFC en su tendencia y que exagera filas con 1 unidad).

| Métrica | Fórmula | Guía |
| --- | --- | --- |
| Entradas | Σ INPUT_QTY; cada fila debe cumplir INPUT = FIRST_PASS + FIRST_FAIL (si no, se aparta) | 1 |
| FPY | Σ FIRST_PASS ÷ Σ INPUT | 2, 6 |
| A retest | min(Σ SECOND_PASS, Σ FIRST_FAIL) ÷ Σ INPUT | 3, 10 |
| Final Yield | FPY + Retest = (Σ FIRST_PASS + retest efectivo) ÷ Σ INPUT | 4 y regla de comprobación |
| Recuperado en retest | retest efectivo ÷ Σ FIRST_FAIL | 11 |
| RTY | producto del FPY de cada estación con entradas | — |
| Diagnóstico | sin entradas: Sin dato · < 10: Muestra insuficiente · FPY ≥ 95: OK · Final ≥ 95: Posible falsa falla · si no: Crítico | — |

Decisiones tomadas a partir de la guía:
- **Entradas 0 = sin dato** (regla 2): se muestra «—», no 0 %, y no entra a gráficas de porcentaje.
- **El retest nunca cuenta más que las primeras fallas** del mismo grupo. Así un retest de una unidad que entró antes del corte no infla el yield (caso SA016491 de la guía) y FPY + Retest = Final Yield siempre. Reproduce el ejemplo ponderado de la guía (1 ÷ 6 = 16.7 %).
- **MA y SA son el mismo número de parte** (MA016491 en el BOM = SA016491 en el TCQS).
- Pendientes de la guía que el TCQS no permite: horario de corte 08:00 (el TCQS solo trae fecha), Pareto por error code y recuperación por error (no trae códigos), retest en otro tester (no trae seriales).

## Fases

1. **Base (hecha).** Proyecto, sistema de diseño, login de prueba, Render.
2. **Lectura, filtro y cálculos (hecha).** TCQS + BOM, validación de filas y modelos, Yield con KPIs, tabla con diagnóstico, gráficas por día/semana/mes y por modelo.
3. **Guía SFC, diseño y menú (hecha).** Fórmulas de la guía, MA = SA, login animado, menú fijo, Inicio como landing con «Dónde mirar primero» y carrusel.
   - Por confirmar: meta (95 %) y mínimo de muestra (10).
   - Grupos para RTY (inspección, funcionales, liquid cooling) si se quieren por separado.
4. **Comparación entre periodos.** Delta de cada KPI contra el periodo anterior (`KpiTile delta`).
5. **Persistencia.** Guardar las filas en IndexedDB para que el historial reabra un archivo sin volver a cargarlo.
6. **DATA ANALYSIS y QM.** Validación y match por serial + estación; Pareto 2do nivel por error code (el TCQS no trae error codes; hoy se abre por tester).
7. **Cuentas reales** si llega un servidor (hoy: usuario de prueba).

## Sistema de diseño

- La app usa solo componentes del sistema (`src/components/`, portados de `bundle.js`) y tokens (`src/styles/tokens.css`).
- Cambios subidos al artefacto: `FileChip` como zona de carga, `LoginPanel` con avisos y `backdrop` animado, `ParetoChart` con etiquetas sin encimarse, `PipelineNav` fijo y en una fila en móvil.
- Pendiente en el sistema: que `PipelineNav` marque ✓ por estado real y no por posición; que «Dónde mirar primero» abra Yield con la estación resaltada.
- Mejora candidata: barras horizontales para estaciones con nombres largos (hoy el eje X muestra una de cada n etiquetas; la tabla las lista todas).

## Verificación

- `npm test`: lector de CSV, escalas de gráficas, lectura del TCQS, extracción de modelos del BOM, fórmulas, diagnóstico y semanas ISO.
- Navegador con los archivos reales: 211 filas, 21 modelos, 208 filas de Juliet (con los manifolds); Entradas 755, FPY 91.0 %, Retest 7.3 %, Final Yield 98.3 % (iguales a un cálculo independiente). Login animado y con movimiento reducido; claro, oscuro y móvil sin scroll horizontal.
