import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escanear, faltan, plantilla, POR_DN, readSfc, type Item } from './sfc.ts';

// datos inventados con la forma del export de SFC
const H = ['TO_NO', 'DN', 'CUST_PO', 'SERIAL_NUMBER', 'MODEL_NAME', 'SERIAL_NUMBER1', 'MODEL_NAME1', 'MCARTON_NO', 'IMEI', 'WIP_GROUP', 'Column1'];
const fila = (dn: string, n: number, pallet = 'PALFX00001', carton = `FX00000${n}`) =>
  ['0000000123', dn, '11112222', `0000000000000${n}`, 'SA000000', `MT00000000${n}A`, '920-00000-00AA-AA0', carton, pallet, 'STOCKIN', null];

test('readSfc: un item por DN; N/A y vacíos quedan sin tarima o sin carton; serial repetido una vez', () => {
  const { items, missing, repetidos } = readSfc({ headers: H, rows: [fila('100', 1), fila('100', 2, 'N/A', ''), fila('200', 3), fila('100', 1)] });
  assert.deepEqual(missing, []);
  assert.equal(repetidos, 1);
  assert.deepEqual(items.map((x) => [x.dn, x.piezas.length, x.to, x.pnSfc]), [['100', 2, '123', '920-00000-00AA-AA0'], ['200', 1, '123', '920-00000-00AA-AA0']]);
  assert.deepEqual(items[0].piezas[1], { serial: 'MT000000002A', carton: '', pallet: '', estado: 'STOCKIN' });
  assert.deepEqual(readSfc({ headers: ['DN'], rows: [] }).missing, ['SERIAL_NUMBER1', 'MCARTON_NO', 'IMEI']);
});

test('faltan: piezas, manuales y Customer PO/DN de 8 dígitos', () => {
  const base = { ...readSfc({ headers: H, rows: Array.from({ length: POR_DN }, (_, i) => fila('100', i + 1)) }).items[0], archivo: '', usuario: '', creado: '' };
  const it: Item = { ...base, ...plantilla(base.pnSfc, []), so: '1', shipped: '2026-01-01', custPo: '12345678', custDn: '87654321', pnNvidia: '692-x' };
  assert.deepEqual(faltan(it), []);
  assert.deepEqual(faltan({ ...it, custDn: '123', so: '' }), ['Sales Order', 'Customer DN: 8 dígitos']);
  assert.deepEqual(faltan({ ...it, piezas: it.piezas.slice(1) }), ['1 de 9 piezas sin serial o carton']);
});

test('escanear: corrige el carton de un serial que ya está o agrega uno nuevo', () => {
  const p = [{ serial: 'MT1', carton: '', pallet: 'PAL1', estado: 'STOCKIN' }];
  assert.deepEqual(escanear(p, 'mt1', 'fx9'), [{ serial: 'MT1', carton: 'FX9', pallet: 'PAL1', estado: 'STOCKIN', manual: true }]);
  assert.equal(escanear(p, 'MT2', 'FX2').length, 2);
  assert.equal(escanear(p, ' ', 'FX2'), p);
});

test('plantilla: copia los datos fijos del último item del mismo PN', () => {
  assert.deepEqual([plantilla('920-x', []).project, plantilla('920-x', []).coo], ['NVIDIA', 'MX']);
  assert.equal(plantilla('920-x', [{ pnSfc: '920-x', price: '10', hazmat: 'h', model: 'm', project: 'P', coo: 'VN', pnNvidia: '692-x' } as Item]).price, '10');
});
