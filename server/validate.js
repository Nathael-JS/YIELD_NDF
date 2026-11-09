// Lo que llega del navegador no se confía: tipos, rangos y tamaños antes de tocar la base.
const MAX_FILAS = 20000;
const texto = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 80;
const entero = (v) => Number.isInteger(v) && v >= 0 && v <= 1e6;

export function validate(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.filas)) return { error: 'Se esperaba { archivo, filas: [...] }' };
  if (typeof b.archivo !== 'string' || b.archivo.length > 200) return { error: 'Nombre de archivo inválido' };
  if (!b.filas.length || b.filas.length > MAX_FILAS) return { error: `Entre 1 y ${MAX_FILAS} filas` };
  for (const [i, f] of b.filas.entries()) {
    const ok = f && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && !Number.isNaN(Date.parse(f.fecha)) && texto(f.modelo) && texto(f.estacion)
      && ['entradas', 'primer_pase', 'primera_falla', 'segundo_pase'].every((k) => entero(f[k]))
      && f.primer_pase + f.primera_falla === f.entradas
      && (f.ordenes == null || (typeof f.ordenes === 'string' && f.ordenes.length <= 4000));
    if (!ok) return { error: `Fila ${i + 1} inválida` };
  }
  return { archivo: b.archivo.trim().slice(0, 200), sesion: b.sesion, usuario: b.usuario, filas: b.filas };
}
