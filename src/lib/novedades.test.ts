import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mayor, novedades } from './novedades.ts';

test('novedades: versión, fecha y el título de cada cambio (negritas o primera línea), sin sub-viñetas ni notas técnicas', () => {
  const md = `# Registro\n\n## [0.49.0] — 2026-11-27\n\n### Cambiado\n- **WIP · piezas (W6):** íconos\n  - sub\n- Un cambio con [enlace](x.md)\n- \`tendencia()\`, con prueba\n\n## [0.48.0] — 2026-11-26\n- **Histórico**\n`;
  assert.deepEqual(novedades(md), [
    { version: '0.49.0', fecha: '2026-11-27', cambios: ['WIP · piezas (W6)', 'Un cambio con enlace'] },
    { version: '0.48.0', fecha: '2026-11-26', cambios: ['Histórico'] },
  ]);
  assert.equal(novedades(md, 1).length, 1);
});

test('mayor: compara versiones por número, no por texto', () => {
  assert.ok(mayor('0.10.0', '0.9.9'));
  assert.ok(!mayor('0.49.0', '0.49.0'));
  assert.ok(mayor('1.0.0', '0.99.99'));
});
