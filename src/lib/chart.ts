// Escalas de las gráficas: ejes en pasos limpios (1, 2, 2.5, 5, 10…).

export function fmt(v: number) {
  return Number(v.toFixed(2)).toLocaleString('es-MX');
}

export function niceStep(v: number) {
  if (!(v > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}

/** Dominio del eje en pasos limpios (≤5 intervalos) que cubre [lo, hi]. */
export function niceRange(lo: number, hi: number) {
  const step = niceStep((hi - lo) / 5);
  const a = Math.floor(lo / step) * step;
  let b = Math.ceil(hi / step) * step;
  if (b <= a) b = a + step;
  return { lo: a, hi: b, step, n: Math.round((b - a) / step) };
}

/** Rangos de ancho limpio que empiezan en un múltiplo del ancho; k es aproximado. */
export function binCounts(vals: number[], k: number) {
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const w = niceStep((max - min) / k);
  const lo = Math.floor(min / w) * w;
  const n = Math.max(1, Math.ceil((max - lo) / w - 1e-9)); // el máximo justo en un borde va al último rango
  const counts = new Array<number>(n).fill(0);
  for (const v of vals) counts[Math.min(n - 1, Math.floor((v - lo) / w + 1e-9))]++;
  return { lo, w, counts };
}

/** Regla de Sturges. */
export function sturges(n: number) {
  return Math.max(1, Math.ceil(Math.log2(n || 1)) + 1);
}
