import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultsFor, desdeEntrega, fromQr, qrText, readEntregas, readShipping, readTarimas, revisar, tarimasFile, toCsv, vacia } from './pallets.ts';

test('readEntregas: una por DN, T/O sin ceros a la izquierda; sin columnas clave no se lee', () => {
  const H = ['TO_NO', 'DN_NO', 'SO_NUMBER', 'MODEL_NAME', 'MODEL_DESC', 'SHIPPING_QTY', 'CUST_PO', 'CUST_NAME', 'CITY1', 'COUNTRY', 'UNIT_NW', 'UNIT_GW'];
  const { entregas } = readEntregas({ headers: H, rows: [['0001687795', '5278000047', '2683000058', 'SA029400', 'JULIET', 36, '73593605', 'NVIDIA', 'Israel', 'IL', 360, 360]] });
  assert.deepEqual([entregas[0].to, entregas[0].qty, entregas[0].destination], ['1687795', 36, 'Israel · IL']);
  assert.deepEqual(readEntregas({ headers: ['DN_NO'], rows: [] }).missing, ['SO_NUMBER', 'TO_NO', 'MODEL_NAME', 'SHIPPING_QTY', 'CUST_PO']);
});

test('readShipping: renglón de áreas, filas del mismo embarque sin Internal Ref, seriales por renglón y FIN', () => {
  const areas = ['SHIPPING', 'ITC', null, 'FULLFILMENT', null, null, null, null];
  const campos = ['Internal Ref', 'Date & hour of receive (ITC)', 'FXNN DN', 'Part\nNumber FXNN', 'Quantity (PCS)', 'Serial#', 'Pallet #', 'HTS CODE'];
  const r = readShipping({ headers: areas.map(String), rows: [campos,
    ['FGNS-1', new Date('2026-08-05'), 5276000000, 'PN-A', 7, 'MT1\r\nMT2', 'PALFX98195', '8517.62.0090'],
    [null, null, 5276000000, 'PN-A', 2, 'MT3\r\nMT4', 'PALFX98196', '8517.62.0090'],
    [null, null, 5276000009, 'PN-B', 9, 'MT5', null, null],
    ['FIN', 'FIN', null, null, null, null, null, null], ['FGNS-9', null, 1, 'X', 1, 'MT9', 'PALFX1', null]] });
  assert.deepEqual(r.tarimas.map((t) => [t.pallet, t.ref, t.dn, t.serials]), [['PALFX98195', 'FGNS-1', '5276000000', 'MT1 MT2'], ['PALFX98196', 'FGNS-1', '5276000000', 'MT3 MT4']]);
  assert.equal(r.sinPallet, 1);
  assert.deepEqual(defaultsFor('PN-A', r.tarimas).hts, '8517.62.0090');
});

test('revisar: obligatorios, pesos, formato y repetido de Pallet #, seriales contra piezas y aviso del WIP', () => {
  const t = { ...vacia(), pallet: 'PALFX98195', ref: 'R', dn: 'D', nvdn: 'N', pn: 'P', qty: '2', cartons: '2', nw: '10', gw: '12', dims: '1x1x1', hts: 'H', coo: 'MX', shipDate: '2026-11-25', serials: 'A B' };
  assert.equal(revisar(t, new Set()).listo, true);
  assert.equal(revisar({ ...t, nw: '20' }, new Set()).pesoMal, true);
  assert.equal(revisar(t, new Set(['PALFX98195'])).repetido, true);
  assert.equal(revisar({ ...t, pallet: 'X-1' }, new Set()).formato, true);
  assert.equal(revisar({ ...t, serials: 'A' }, new Set()).listo, false);
  const w = revisar(t, new Set(), new Map([['A', 'PACK_CTN'], ['Z', 'FT']]));
  assert.deepEqual([w.fueraWip, w.sinStock, w.listo], [['B'], [], true]); // el WIP solo avisa
});

test('tarimas: archivo ↔ tabla ida y vuelta, CSV con comillas y QR solo ASCII', () => {
  const t = { ...desdeEntrega({ dn: '5278000047', so: 'S', to: '1', po: 'P', model: 'SA029400', desc: 'Switch, 1U', qty: 2, customer: 'NVIDIA', destination: 'Israel · IL', loose: '', nw: '', gw: '' }), pallet: 'PALFX1', serials: 'A B' };
  const back = readTarimas(tarimasFile([t])).tarimas[0];
  assert.deepEqual(back, t);
  assert.match(toCsv(tarimasFile([t])), /"Switch, 1U"/);
  // un serial de 14 dígitos va como ="…" (Excel no lo convierte) y vuelve igual
  const csv = toCsv(tarimasFile([{ ...t, desc: 'Switch', serials: '62061000920002' }]));
  assert.match(csv, /="62061000920002"/);
  const rows = csv.slice(1).split('\r\n').map((l) => l.split(','));
  assert.equal(readTarimas({ headers: rows[0], rows: rows.slice(1) }).tarimas[0].serials, '62061000920002');
  assert.match(qrText({ ...t, dims: '120 × 80' }), /^PALLET:PALFX1\n[\s\S]*DIM:120  80\n[\s\S]*SN:A,B$/);
});

test('fromQr: el QR de una etiqueta vuelve a ser la tarima (incluye prueba ×9); otro texto no', () => {
  const t = { ...vacia(), pallet: 'PALFX1', ref: 'R', dn: '5276000000', nvdn: '87728644', so: 'S', qty: '9', serials: Array(9).fill('MT1').join(' '), prueba: 'sí', shipDate: '2026-11-25' };
  const back = fromQr(qrText(t))!;
  assert.deepEqual([back.pallet, back.dn, back.nvdn, back.qty, back.prueba, back.serials.split(' ').length], ['PALFX1', '5276000000', '87728644', '9', 'sí', 9]);
  assert.equal(fromQr('https://example.com'), null);
});
