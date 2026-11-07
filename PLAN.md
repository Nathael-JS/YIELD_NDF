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

## Cálculos (verificados contra las tasas del propio TCQS: 211/211 filas)

| Métrica | Fórmula |
| --- | --- |
| FPY | Σ FIRST_PASS_QTY ÷ Σ INPUT_QTY |
| Final Yield | (Σ FIRST_PASS + Σ SECOND_PASS) ÷ Σ INPUT, tope 100 % |
| A retest | Σ SECOND_PASS ÷ Σ INPUT |
| NDF | min(Σ SECOND_PASS, Σ FIRST_FAIL) ÷ Σ FIRST_FAIL — **confirmar con el piso** |
| RTY | producto del FPY de cada estación |
| Diagnóstico | < 10 entradas: Muestra insuficiente · FPY ≥ 95: OK · Final ≥ 95: Posible falso fallo (NDF) · si no: Crítico |

## Fases

1. **Base (hecha).** Proyecto, sistema de diseño, login de prueba, Render.
2. **Lectura, filtro y cálculos (hecha).** TCQS + BOM, validación de filas y modelos, Yield con KPIs, tabla con diagnóstico, gráficas por día/semana/mes y por modelo.
3. **Siguiente: decisiones del piso.**
   - `SA016491/SA016492` del TCQS vs `MA016491/MA016492` del BOM: ¿son el mismo manifold? Hoy quedan fuera del proyecto.
   - Confirmar la fórmula de NDF, la meta (95 %) y el mínimo de muestra (10).
   - Grupos para RTY (inspección, funcionales, liquid cooling) si se quieren por separado.
4. **Comparación entre periodos.** Delta de cada KPI contra el periodo anterior (`KpiTile delta`).
5. **Persistencia.** Guardar las filas en IndexedDB para que el historial reabra un archivo sin volver a cargarlo.
6. **DATA ANALYSIS y QM.** Validación y match por serial + estación; Pareto 2do nivel por error code (el TCQS no trae error codes; hoy se abre por tester).
7. **Cuentas reales** si llega un servidor (hoy: usuario de prueba).

## Sistema de diseño

- La app usa solo componentes del sistema (`src/components/`, portados de `bundle.js`) y tokens (`src/styles/tokens.css`).
- Cambios subidos al artefacto: `FileChip` como zona de carga, `LoginPanel` con avisos, `ParetoChart` con etiquetas sin encimarse.
- Mejora candidata: barras horizontales para estaciones con nombres largos (hoy el eje X muestra una de cada n etiquetas; la tabla las lista todas).

## Verificación

- `npm test`: lector de CSV, escalas de gráficas, lectura del TCQS, extracción de modelos del BOM, fórmulas, diagnóstico y semanas ISO.
- Navegador con los archivos reales: 211 filas, 21 modelos, 192 filas de Juliet; Entradas 723, FPY 90.6 %, Final Yield 98.2 % (iguales a un cálculo independiente). Claro, oscuro y móvil sin scroll horizontal.
