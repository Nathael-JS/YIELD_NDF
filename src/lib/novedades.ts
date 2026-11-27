// Novedades: las últimas versiones del CHANGELOG.md, con el título de cada cambio (lo de **negritas** o la primera frase).

export interface Novedad { version: string; fecha: string; cambios: string[] }

/** «0.49.0» > «0.48.2» */
export const mayor = (a: string, b: string) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

const limpio = (s: string) => s.replace(/\*\*|`|\[([^\]]+)\]\([^)]*\)/g, (_m, link) => link ?? '').replace(/\s+/g, ' ').trim();

/** Secciones «## [x.y.z] — fecha»; de cada una, sus viñetas de primer nivel (sin sub-viñetas ni notas técnicas). */
export function novedades(md: string, max = 8): Novedad[] {
  const out: Novedad[] = [];
  for (const parte of md.split(/^## /m).slice(1)) {
    const m = parte.match(/^\[(\d+\.\d+\.\d+)\]\s*[—-]\s*(\S+)/);
    if (!m) continue;
    // sin las notas técnicas: viñetas con código (`tendencia()`, `GET /api/…`) que no traen un título en negritas
    const cambios = parte.split('\n').filter((l) => /^- /.test(l) && (/^- \*\*/.test(l) || !l.includes('`'))).map((l) => {
      const t = limpio(l.slice(2)), negrita = l.match(/^- \*\*(.+?)\*\*/);
      return negrita ? limpio(negrita[1]).replace(/[:.]$/, '') : t.length > 140 ? `${t.slice(0, 139)}…` : t;
    });
    out.push({ version: m[1], fecha: m[2], cambios });
    if (out.length >= max) break;
  }
  return out;
}
