import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEtiqueta, escanear, etiquetas, faltan, grupos, plantilla, POR_PALLET, problema, readSfc, type Item } from './sfc.ts';

// datos inventados con la forma del export de SFC
const H = ['TO_NO', 'DN', 'CUST_PO', 'SERIAL_NUMBER', 'MODEL_NAME', 'SERIAL_NUMBER1', 'MODEL_NAME1', 'MCARTON_NO', 'IMEI', 'WIP_GROUP', 'Column1'];
const fila = (dn: string, n: number, pallet = 'PALFX00001', carton = `FX00000${n}`) =>
  ['0000000123', dn, '11112222', `0000000000000${n}`, 'SA000000', `MT00000000${n}A`, '920-00000-00AA-AA0', carton, pallet, 'STOCKIN', null];

test('readSfc: un item por DN; N/A y vacíos quedan sin tarima o sin carton; serial repetido una vez', () => {
  const { items, missing, repetidos } = readSfc({ headers: H, rows: [fila('100', 1), fila('100', 2, 'N/A', ''), fila('200', 3), fila('100', 1)] });
  assert.deepEqual(missing, []);
  assert.equal(repetidos, 1);
  assert.deepEqual(items.map((x) => [x.dn, x.piezas.length, x.to, x.pnSfc]), [['100', 2, '123', '920-00000-00AA-AA0'], ['200', 1, '123', '920-00000-00AA-AA0']]);
  assert.deepEqual(items[0].piezas[1], { serial: 'MT000000002A', sn: '00000000000002', carton: '', pallet: '', estado: 'STOCKIN' });
  assert.deepEqual(readSfc({ headers: ['DN'], rows: [] }).missing, ['SERIAL_NUMBER1', 'MCARTON_NO', 'IMEI']);
});

test('faltan: piezas, manuales y Customer PO/DN de 8 dígitos', () => {
  const base = { ...readSfc({ headers: H, rows: Array.from({ length: POR_PALLET }, (_, i) => fila('100', i + 1)) }).items[0], archivo: '', usuario: '', creado: '' };
  const it: Item = { ...base, ...plantilla(base.pnSfc, []), so: '1', shipped: '2026-01-01', custPo: '12345678', custDn: '87654321', pnNvidia: '692-x' };
  assert.deepEqual(faltan(it), []);
  assert.deepEqual(faltan({ ...it, custDn: '123', so: '' }), ['Sales Order', 'Customer DN: 8 dígitos']);
  assert.deepEqual(faltan({ ...it, piezas: it.piezas.map((p, i) => (i ? p : { ...p, carton: '' })) }), ['PALFX00001: sin carton']);
  assert.deepEqual(faltan({ ...it, piezas: [...it.piezas, { ...it.piezas[0], serial: 'MTX' }] }), ['PALFX00001: 1 de más']);
  assert.deepEqual(faltan({ ...it, piezas: it.piezas.map((p, i) => (i ? p : { ...p, pallet: '' })) }), ['PALFX00001: faltan 1', '1 pieza sin Pallet ID']);
});

test('escanear: corrige carton y Pallet ID de un serial que ya está o agrega uno nuevo', () => {
  const p = [{ serial: 'MT1', sn: '1', carton: '', pallet: 'PAL1', estado: 'STOCKIN' }];
  assert.deepEqual(escanear(p, 'mt1', 'fx9'), [{ serial: 'MT1', sn: '1', carton: 'FX9', pallet: 'PAL1', estado: 'STOCKIN', manual: true }]);
  assert.equal(escanear(p, 'MT3', 'n/a', 'N/A')[1].pallet, '');
  assert.deepEqual(escanear(p, 'MT2', 'FX2', 'pal2')[1], { serial: 'MT2', sn: '', carton: 'FX2', pallet: 'PAL2', estado: '', manual: true });
  assert.equal(escanear(p, ' ', 'FX2'), p);
});

test('plantilla: copia los datos fijos del último item del mismo PN', () => {
  assert.deepEqual([plantilla('920-x', []).project, plantilla('920-x', []).coo], ['NVIDIA', 'MX']);
  assert.equal(plantilla('920-x', [{ pnSfc: '920-x', price: '10', hazmat: 'h', model: 'm', project: 'P', coo: 'VN', pnNvidia: '692-x' } as Item]).price, '10');
});

test('grupos y conEtiqueta: un grupo por Pallet ID; cada pallet = 9 seriales con 9 cartons distintos', () => {
  const pz = (n: number, pallet: string) => Array.from({ length: n }, (_, i) => ({ serial: `MT${pallet}${i}`, sn: '', carton: `FX${pallet}${i}`, pallet, estado: '' }));
  const piezas = [...pz(9, 'PAL2'), ...pz(1, 'PAL1'), ...pz(2, ''), ...pz(9, 'PAL3')];
  assert.deepEqual(grupos({ piezas }).map((g) => [g.pallet, g.piezas.length, problema(g)]), [['PAL2', 9, ''], ['PAL1', 1, 'faltan 8'], ['PAL3', 9, ''], ['', 2, 'sin Pallet ID']]);
  assert.ok(!conEtiqueta({ piezas }));
  assert.ok(conEtiqueta({ piezas: [...pz(9, 'PAL2'), ...pz(9, 'PAL3')] }));
  assert.ok(!conEtiqueta({ piezas: [...pz(9, 'PAL1'), { ...pz(1, 'PAL1')[0], serial: 'MTX' }] }));
  assert.equal(problema({ pallet: 'P', piezas: pz(9, 'P').map((p, i) => (i ? p : { ...p, carton: 'FXP1' })) }), 'carton repetido');
  assert.ok(!conEtiqueta({ piezas: [] }));
});

test('etiquetas: una por Pallet ID, con sus piezas y cartons; QR solo ASCII y sin precio', () => {
  const piezas = [['MT1', 'FX1', 'PAL1'], ['MT2', 'FX1', 'PAL1'], ['MT3', 'FX3', 'PAL2'], ['MT4', 'FX4', '']].map(([serial, carton, pallet]) => ({ serial, sn: '', carton, pallet, estado: '' }));
  const it = { dn: '100', po: '1', to: '', pnSfc: '920-x', piezas, archivo: '', usuario: '', creado: '', so: '2', pnNvidia: '692-x', shipped: '2026-01-02',
    custPo: '12345678', custDn: '87654321', project: 'NVIDIA', model: 'Señal', hazmat: '', coo: 'MX', price: '999' } as Item;
  const ls = etiquetas(it);
  assert.deepEqual(ls.map((l) => [l.d.pallet, l.d.qty, l.d.cartons, l.d.index, l.d.total]), [['PAL1', 2, 1, 1, 2], ['PAL2', 1, 1, 2, 2]]);
  assert.match(ls[0].qr, /^PALLET:PAL1\nDN:100\n/);
  assert.match(ls[0].qr, /\nSN:MT1,MT2$/);
  assert.ok(!ls[0].qr.includes('999'));
  assert.ok(/^[\x20-\x7e\n]*$/.test(ls[0].qr));
});
