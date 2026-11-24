// Reporte PDF (react-pdf). Se carga solo al pulsar «Descargar PDF» (import dinámico): react-pdf pesa ~1.5 MB.
// Colores = tokens del tema claro; letras Helvetica/Courier (incluidas en el PDF, sin descargar fuentes).
import { Document, Font, G, Line, Page, pdf, Polyline, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { ACTION, diagnose, META_FPY, pctText, type Totals } from '../lib/tcqs.ts';
import type { byLabel, Estado, Marked, ndfStations } from '../lib/fails.ts';
import { code128 } from '../lib/code128.ts';
import { qrModules, type PalletLabelData } from '../components/label.tsx';

const C = {
  ink: '#18201c', muted: '#535d57', line: '#d2d6cc', strong: '#8a9389', sunk: '#e6e8e2', brand: '#0d6157',
  pass: '#0d6157', second: '#4f75ab', fail: '#cf6a10',
  ok: ['#dcefe9', '#0b5a4f'], warn: ['#fbecd2', '#7a4a05'], bad: ['#fbe0d6', '#9a3412'], neutral: ['#e6e8e2', '#535d57'],
} as const;
const W = 523; // ancho útil de A4 (595 pt − márgenes)
Font.registerHyphenationCallback((word) => [word]); // no partir con guion nombres como WC_WASH_DRAIN_NITRO_FILL

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 9, color: C.ink },
  eyebrow: { fontSize: 7, letterSpacing: 0.6, color: C.brand, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  sub: { color: C.muted, marginTop: 2, marginBottom: 14 },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 6 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kpi: { width: (W - 18) / 4, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 8 },
  kLabel: { fontSize: 6.5, letterSpacing: 0.6, color: C.muted, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  kValue: { fontSize: 18, fontFamily: 'Courier', marginTop: 2 },
  kDelta: { fontSize: 7, marginTop: 2 },
  watch: { flexDirection: 'row', gap: 6 },
  card: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 8, gap: 3 },
  mono: { fontFamily: 'Courier' },
  badge: { alignSelf: 'flex-start', fontSize: 7, paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3 },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderColor: C.line, paddingVertical: 4, alignItems: 'center' },
  th: { flexDirection: 'row', backgroundColor: C.sunk, paddingVertical: 4, fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase' },
  foot: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: C.muted },
});
const COLS = [140, 50, 50, 45, 45, 45, 40, 108]; // estación, entradas, 1ra falla, FPY, final, retest, NDF, diagnóstico
const num = { textAlign: 'right' as const, fontFamily: 'Courier', paddingRight: 6 };

export interface Kpi { label: string; value: string; unit?: string; delta?: number; deltaUnit: string; good: boolean }
export type Station = Totals & { name: string };
export interface PdfData {
  title: string; sub: string; kpis: Kpi[]; stations: Station[]; watch: (Station & { dx: [string, string] })[];
  pareto: { label: string; value: number }[]; trend: { label: string; fpy: number; final: number }[];
  /** Página 3 y anexo (si hay TCQS con 2do pase; códigos y seriales solo si se cargó el reporte de primeras fallas). */
  ndf?: { stations: ReturnType<typeof ndfStations>; codes: ReturnType<typeof byLabel>; units: Marked[]; input: number };
}

const Badge = ({ text, tone }: { text: string; tone: string }) => {
  const [bg, fg] = C[tone as 'ok'] ?? C.neutral;
  return <Text style={[s.badge, { backgroundColor: bg, color: fg }]}>{text}</Text>;
};

/** FPY y Final Yield por estación, en barras horizontales con la meta punteada. */
function Stations({ st }: { st: Station[] }) {
  const L = 130, row = 16, H = st.length * row + 16, x = (v: number) => L + (v / 100) * (W - L - 10);
  return (
    <Svg width={W} height={H}>
      {[0, 25, 50, 75, 100].map((v) => <Line key={v} x1={x(v)} x2={x(v)} y1={0} y2={H - 14} stroke={v ? C.line : C.strong} strokeWidth={0.5} />)}
      {[0, 50, 100].map((v) => <Text key={v} x={x(v)} y={H - 4} style={{ fontSize: 6.5, fontFamily: 'Courier' }} fill={C.muted} textAnchor="middle">{`${v}%`}</Text>)}
      {st.map((r, i) => (
        <G key={r.name}>
          <Text x={L - 6} y={i * row + 10} style={{ fontSize: 7, fontFamily: 'Courier' }} fill={C.ink} textAnchor="end">{r.name.slice(0, 24)}</Text>
          <Rect x={L} y={i * row + 3} width={Math.max(0, x(r.fpy || 0) - L)} height={5} fill={C.pass} />
          <Rect x={L} y={i * row + 8.5} width={Math.max(0, x(r.final || 0) - L)} height={5} fill={C.second} />
        </G>
      ))}
      <Line x1={x(META_FPY)} x2={x(META_FPY)} y1={0} y2={H - 14} stroke={C.muted} strokeWidth={0.8} strokeDasharray="3 3" />
    </Svg>
  );
}

/** Pareto de primeras fallas: barras de mayor a menor y línea acumulada, con el 80 %. */
/** `total`: base del % acumulado cuando solo se dibujan las primeras barras. */
function Pareto({ data, total: base }: { data: PdfData['pareto']; total?: number }) {
  const d = [...data].sort((a, b) => b.value - a.value), total = base || d.reduce((t, x) => t + x.value, 0) || 1, max = d[0]?.value || 1;
  const L = 24, R = 28, T = 8, H = 170, B = 40, ih = H - T - B, bw = (W - L - R) / Math.max(d.length, 1);
  let cum = 0;
  const pts = d.map((x, i) => { cum += x.value; return `${L + i * bw + bw / 2},${T + ih - (cum / total) * ih}`; }).join(' ');
  return (
    <Svg width={W} height={H}>
      <Line x1={L} x2={W - R} y1={T + ih} y2={T + ih} stroke={C.strong} strokeWidth={0.5} />
      <Line x1={L} x2={W - R} y1={T + ih * 0.2} y2={T + ih * 0.2} stroke={C.muted} strokeWidth={0.6} strokeDasharray="3 3" />
      <Text x={W - R + 4} y={T + ih * 0.2 + 3} style={{ fontSize: 6.5 }} fill={C.muted}>80%</Text>
      <Text x={L - 4} y={T + 6} style={{ fontSize: 6.5, fontFamily: 'Courier' }} fill={C.muted} textAnchor="end">{String(max)}</Text>
      {d.map((x, i) => (
        <G key={x.label}>
          <Rect x={L + i * bw + bw * 0.15} y={T + ih - (x.value / max) * ih} width={bw * 0.7} height={(x.value / max) * ih} fill={C.fail} />
          <Text x={L + i * bw + bw / 2} y={T + ih + 10} style={{ fontSize: 5.5, fontFamily: 'Courier' }} fill={C.muted} textAnchor="middle">{x.label.slice(0, Math.max(3, Math.floor(bw / 3.5)))}</Text>
        </G>
      ))}
      <Polyline points={pts} stroke={C.ink} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

/** Evolución de FPY y Final Yield por periodo, contra la meta. */
function Trend({ data }: { data: PdfData['trend'] }) {
  const L = 28, R = 24, T = 8, H = 150, B = 20, ih = H - T - B, step = (W - L - R) / Math.max(data.length - 1, 1);
  const y = (v: number) => T + ih - (v / 100) * ih, x = (i: number) => L + (data.length > 1 ? i * step : (W - L - R) / 2);
  const line = (k: 'fpy' | 'final') => data.map((p, i) => `${x(i)},${y(p[k])}`).join(' ');
  return (
    <Svg width={W} height={H}>
      {[0, 50, 100].map((v) => (
        <G key={v}>
          <Line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v ? C.line : C.strong} strokeWidth={0.5} />
          <Text x={L - 4} y={y(v) + 2} style={{ fontSize: 6.5, fontFamily: 'Courier' }} fill={C.muted} textAnchor="end">{`${v}%`}</Text>
        </G>
      ))}
      <Line x1={L} x2={W - R} y1={y(META_FPY)} y2={y(META_FPY)} stroke={C.muted} strokeWidth={0.6} strokeDasharray="3 3" />
      <Polyline points={line('fpy')} stroke={C.pass} strokeWidth={1.5} fill="none" />
      <Polyline points={line('final')} stroke={C.second} strokeWidth={1.5} fill="none" />
      {data.map((p, i) => <Text key={p.label} x={x(i)} y={H - 6} style={{ fontSize: 6.5, fontFamily: 'Courier' }} fill={C.muted} textAnchor="middle">{p.label}</Text>)}
    </Svg>
  );
}

const Legend = ({ items }: { items: [string, string][] }) => (
  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
    {items.map(([name, color]) => (
      <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <View style={{ width: 6, height: 6, backgroundColor: color }} /><Text style={{ fontSize: 7, color: C.muted }}>{name}</Text>
      </View>
    ))}
  </View>
);

const cutTo = (t: string, k: number) => (t.length > k ? `${t.slice(0, k - 1)}…` : t);
const ESTADO: Record<Estado, [string, string]> = { NDF: ['NDF', 'ok'], Mezcla: ['NDF probable', 'neutral'], Real: ['Real', 'bad'], Pendiente: ['Pendiente', 'warn'], 'Sin TCQS': ['Sin TCQS', 'neutral'] };

/** Tabla simple: encabezado que se repite en cada hoja y filas que no se parten. */
/** `dense`: letra y filas más chicas (anexo de seriales). */
function Table({ cols, head, rows, dense }: { cols: number[]; head: string[]; rows: (string | number)[][]; dense?: boolean }) {
  const isNum = (v: string | number) => typeof v === 'number';
  return (
    <View>
      <View style={s.th} fixed>{head.map((h, i) => <Text key={h} style={[{ width: cols[i], paddingLeft: 4 }, isNum(rows[0]?.[i]) ? num : {}]}>{h}</Text>)}</View>
      {rows.map((r, k) => (
        <View key={k} style={[s.tr, dense ? { paddingVertical: 1.5, fontSize: 7 } : {}]} wrap={false}>
          {r.map((v, i) => <Text key={i} style={[{ width: cols[i], paddingLeft: 4 }, isNum(v) ? num : i === 0 ? s.mono : {}]}>{isNum(v) ? (v as number).toLocaleString('es-MX', { maximumFractionDigits: 1 }) : v}</Text>)}
        </View>
      ))}
    </View>
  );
}

/** Página 3 (NDF) y anexo con los seriales de los códigos del 80 %. */
function NdfPages({ stations, codes, units, input, date }: NonNullable<PdfData['ndf']> & { date: string }) {
  const sum = (k: 'ff' | 'ndf' | 'real' | 'pend') => stations.reduce((a, x) => a + x[k], 0);
  const [ff, nd, real, pend] = [sum('ff'), sum('ndf'), sum('real'), sum('pend')];
  let cum = 0;
  const all = codes.reduce((a, c) => a + c.total, 0);
  const top = codes.filter((c, i) => { cum += c.total; return i === 0 || cum / all <= 0.8 + 1e-9; }), topSet = new Set(top.map((c) => c.name));
  const annex = units.filter((u) => topSet.has(u.code)).sort((a, b) => a.code.localeCompare(b.code) || a.group.localeCompare(b.group));
  const testersOf = (code: string) => [...units.filter((u) => u.code === code).reduce((m, u) => m.set(u.tester, (m.get(u.tester) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, k]) => `${t} (${k})`).join(', ');
  const bar = [[nd, C.second], [real, C.fail], [pend, C.strong]] as const, tot = bar.reduce((a, [v]) => a + (Number.isFinite(v) ? v : 0), 0) || 1;
  let x = 0;
  return (
    <>
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>NDF · no defect found</Text>
        <Text style={s.h1}>{`${nd.toLocaleString('es-MX')} NDF de ${ff.toLocaleString('es-MX')} primeras fallas`}</Text>
        <Text style={s.sub}>{`${pctText((nd / ff) * 100)} % pasó al re-probar sin reparación (2do pase del TCQS) · SPY ${pctText((nd / input) * 100)} % de las entradas`}</Text>
        <Svg width={W} height={12}>
          {bar.map(([v, col], i) => { const w = Number.isFinite(v) ? (v / tot) * W : 0, r = <Rect key={i} x={x} y={0} width={Math.max(0, w - 1)} height={10} fill={col} />; x += w; return r; })}
        </Svg>
        <Legend items={[[`NDF ${nd}`, C.second], [`Real (a reparación) ${Number.isFinite(real) ? real : '—'}`, C.fail], [`Pendiente de re-probar ${Number.isFinite(pend) ? pend : '—'}`, C.strong]]} />
        <Text style={s.h2}>NDF por estación</Text>
        <Table cols={[170, 60, 60, 55, 55, 55, 68]} head={['Estación', 'Entradas', '1ra falla', 'NDF', 'Real', 'Pendiente', 'SPY %']}
          rows={stations.slice(0, 15).map((r) => [r.name, r.input, r.ff, r.ndf, r.real, r.pend, Math.round((r.ndf / r.input) * 1000) / 10])} />
        {stations.length > 15 && <Text style={{ color: C.muted, fontSize: 7, marginTop: 3 }}>{`Las 15 con más NDF de ${stations.length}; todas en la app y en el HTML.`}</Text>}
        {codes.length > 0 && (
          <>
            <Text style={s.h2}>{`Pareto · primeras fallas por código (10 de ${codes.length})`}</Text>
            <Pareto data={codes.slice(0, 10).map((c) => ({ label: c.name, value: c.total }))} total={all} />
            <Text style={s.h2}>{`Códigos del 80 % (${Math.min(15, top.length)} de ${top.length})`}</Text>
            <Table cols={[80, 205, 45, 48, 145]} head={['Código', 'Descripción', 'Unidades', 'NDF est.', 'Testers principales']}
              rows={top.slice(0, 15).map((c) => [cutTo(c.name, 14), cutTo(c.desc, 44), c.total, c.est, cutTo(testersOf(c.name), 36)])} />
          </>
        )}
        <Foot date={date} />
      </Page>
      {annex.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.eyebrow}>Anexo</Text>
          <Text style={[s.h2, { marginTop: 4 }]}>{`Seriales de los códigos del 80 % (${annex.length})`}</Text>
          <Text style={{ color: C.muted, fontSize: 7.5, marginBottom: 6 }}>Estado según el TCQS de su orden × estación: NDF probable = el grupo tuvo NDF y reales y no se sabe cuál es esta unidad.</Text>
          <Table dense cols={[80, 150, 40, 90, 95, 68]} head={['Código', 'Serial', 'Fecha', 'Estación', 'Tester', 'Estado']}
            rows={annex.map((u) => [cutTo(u.code, 14), cutTo(u.serial, 30), u.date.slice(5), cutTo(u.group, 18), cutTo(u.tester, 18), ESTADO[u.estado][0]])} />
          <Foot date={date} />
        </Page>
      )}
    </>
  );
}

const Foot = ({ date }: { date: string }) => (
  <View style={s.foot} fixed>
    <Text>{`Yield Control · generado el ${date} · fórmulas de la guía YieldRateSFC y RetestRate`}</Text>
    <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>
);

function Report({ title, sub, kpis, stations, watch, pareto, trend, ndf }: PdfData) {
  const date = new Date().toLocaleString('es-MX');
  return (
    <Document title={title} author="Yield Control" subject="Reporte de yield del proyecto Juliet">
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>Yield Control · Proyecto Juliet</Text>
        <Text style={s.h1}>{title}</Text>
        <Text style={s.sub}>{sub}</Text>
        <View style={s.kpis}>
          {kpis.map((k) => (
            <View key={k.label} style={s.kpi}>
              <Text style={s.kLabel}>{k.label}</Text>
              <Text style={s.kValue}>{k.value}<Text style={{ fontSize: 10, color: C.muted }}>{k.unit ? ` ${k.unit}` : ''}</Text></Text>
              {k.delta != null && <Text style={[s.kDelta, { color: k.good ? C.ok[1] : C.bad[1] }]}>{`${k.delta > 0 ? '+' : ''}${k.delta}${k.deltaUnit} vs. periodo anterior`}</Text>}
            </View>
          ))}
        </View>
        {watch.length > 0 && <Text style={s.h2}>Dónde mirar primero</Text>}
        <View style={s.watch}>
          {watch.map((w) => (
            <View key={w.name} style={s.card}>
              <Text style={s.mono}>{w.name}</Text>
              <Badge text={w.dx[0]} tone={w.dx[1]} />
              <Text style={{ fontFamily: 'Courier', fontSize: 14 }}>{pctText(w.fpy)}<Text style={{ fontSize: 8, color: C.muted }}> % FPY</Text></Text>
              <Text style={{ color: C.muted, fontSize: 7.5 }}>{`${w.ff} primeras fallas de ${w.input} entradas · Final ${pctText(w.final)} %`}</Text>
              <Text style={{ color: C.muted, fontSize: 7.5 }}>{ACTION[w.dx[1] as 'bad']}</Text>
            </View>
          ))}
        </View>
        <Text style={s.h2}>FPY y Final Yield por estación</Text>
        <Legend items={[['FPY', C.pass], ['Final Yield', C.second], [`Meta FPY ${META_FPY} % (punteada)`, C.muted]]} />
        <Stations st={stations.filter((x) => x.input > 0)} />
        <Foot date={date} />
      </Page>
      <Page size="A4" style={s.page}>
        {pareto.length > 0 && <><Text style={s.h2}>Pareto · primeras fallas por estación</Text><Pareto data={pareto} /></>}
        {trend.length > 1 && <><Text style={s.h2}>Evolución del yield</Text><Legend items={[['FPY', C.pass], ['Final Yield', C.second]]} /><Trend data={trend} /></>}
        <Text style={s.h2}>Estaciones</Text>
        <View style={s.th} fixed>
          {['Estación', 'Entradas', '1ra falla', 'FPY', 'Final', 'Retest', 'NDF', 'Diagnóstico'].map((h, i) => <Text key={h} style={[{ width: COLS[i], paddingLeft: 4 }, i && i < 7 ? num : {}]}>{h}</Text>)}
        </View>
        {stations.map((r) => {
          const [text, tone] = diagnose(r);
          return (
            <View key={r.name} style={s.tr} wrap={false}>
              <Text style={[s.mono, { width: COLS[0], paddingLeft: 4 }]}>{r.name}</Text>
              <Text style={[num, { width: COLS[1] }]}>{r.input}</Text>
              <Text style={[num, { width: COLS[2] }]}>{r.ff}</Text>
              <Text style={[num, { width: COLS[3] }]}>{pctText(r.fpy)}</Text>
              <Text style={[num, { width: COLS[4] }]}>{pctText(r.final)}</Text>
              <Text style={[num, { width: COLS[5] }]}>{pctText(r.retest)}</Text>
              <Text style={[num, { width: COLS[6] }]}>{r.sp}</Text>
              <View style={{ width: COLS[7], paddingLeft: 4 }}><Badge text={text} tone={tone} /></View>
            </View>
          );
        })}
        <Foot date={date} />
      </Page>
      {ndf && ndf.stations.length > 0 && <NdfPages {...ndf} date={date} />}
    </Document>
  );
}

export const reportPdf = (d: PdfData) => pdf(<Report {...d} />).toBlob();

// ── Reporte WIP ──
const SEM = { ok: '#1f8a4c', warn: '#e07b00', bad: '#d0342c' }; // tokens sem-* del tema claro
type WipSt = { name: string; section: string; n: number; ok: number; warn: number; bad: number; urgent: number; blocked: number; max: number; fpy: number; estado: string; cuello: boolean };
export interface WipPdfData {
  title: string; sub: string; kpis: { label: string; value: number }[]; stations: WipSt[];
  criticas: { serial: string; mo: string; station: string; at: string; hours: number; blocked: boolean }[];
  ordenes: { mo: string; model: string; n: number; linea: number; hold: number; rep: number; blocked: number; terminadas: number; max: number }[];
  nota: string;
}
const hrs = (h: number) => (h < 48 ? `${h.toFixed(1)} h` : `${Math.floor(Math.round(h) / 24)} d ${Math.round(h) % 24} h`);
const WCOLS = [150, 50, 165, 70, 48, 40];

function WipReport({ title, sub, kpis, stations, criticas, ordenes, nota }: WipPdfData) {
  const date = new Date().toLocaleString('es-MX'), top = Math.max(1, ...stations.map((x) => x.n));
  return (
    <Document title={title} author="Yield Control" subject="Reporte WIP">
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>Yield Control · reporte WIP</Text>
        <Text style={s.h1}>{title}</Text>
        <Text style={s.sub}>{sub}</Text>
        <View style={s.kpis}>
          {kpis.map((k) => <View key={k.label} style={[s.kpi, { width: (W - 24) / 5 }]}><Text style={s.kLabel}>{k.label}</Text><Text style={s.kValue}>{k.value.toLocaleString('es-MX')}</Text></View>)}
        </View>
        <Text style={s.h2}>Flujo por estación</Text>
        <Legend items={[['< 2 h', SEM.ok], ['< 20 h', SEM.warn], ['20 h o más', SEM.bad]]} />
        <View style={s.th} fixed>{['Estación', 'Piezas', 'Tiempo en la estación', 'Más antigua', 'FPY', 'Urg.'].map((h, i) => <Text key={h} style={[{ width: WCOLS[i], paddingLeft: 4 }, i === 1 || i > 2 ? num : {}]}>{h}</Text>)}</View>
        {stations.map((r, i) => (
          <View key={r.name} wrap={false}>
            {r.section !== stations[i - 1]?.section && <Text style={[s.eyebrow, { marginTop: 6, marginBottom: 2 }]}>{r.section}</Text>}
            <View style={s.tr}>
              <View style={{ width: WCOLS[0], paddingLeft: 4, gap: 2 }}>
                <Text style={s.mono}>{cutTo(r.name, 26)}</Text>
                {(r.estado !== 'Línea' || r.cuello || r.blocked > 0) && <Text style={{ fontSize: 6.5, color: C.bad[1] }}>{[r.estado !== 'Línea' && r.estado, r.cuello && 'Cuello de botella', r.blocked > 0 && `${r.blocked} bloqueadas`].filter(Boolean).join(' · ')}</Text>}
              </View>
              <Text style={[num, { width: WCOLS[1] }]}>{r.n}</Text>
              <View style={{ width: WCOLS[2], paddingLeft: 4 }}>
                <View style={{ flexDirection: 'row', width: Math.max(4, ((WCOLS[2] - 8) * r.n) / top), height: 7, borderRadius: 3, overflow: 'hidden' }}>
                  {(['ok', 'warn', 'bad'] as const).map((k) => r[k] > 0 && <View key={k} style={{ flexGrow: r[k], backgroundColor: SEM[k] }} />)}
                </View>
              </View>
              <Text style={[num, { width: WCOLS[3], color: r.max >= 20 ? SEM.bad : C.ink }]}>{hrs(r.max)}</Text>
              <Text style={[num, { width: WCOLS[4] }]}>{Number.isFinite(r.fpy) ? `${pctText(r.fpy)}` : '—'}</Text>
              <Text style={[num, { width: WCOLS[5] }]}>{r.urgent}</Text>
            </View>
          </View>
        ))}
        <Foot date={date} />
      </Page>
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>{`Urgentes (> 100 h) y bloqueadas · ${criticas.length}`}</Text>
        {criticas.length ? <Table dense cols={[130, 60, 150, 70, 65, 48]} head={['Serial', 'Orden', 'Estación', 'Llegó', 'En estación', '']}
          rows={criticas.slice(0, 300).map((p) => [cutTo(p.serial, 24), p.mo, cutTo(p.station, 26), p.at.slice(5, 16), hrs(p.hours), p.blocked ? 'Bloqueada' : ''])} /> : <Text style={{ color: C.muted }}>Ninguna.</Text>}
        {criticas.length > 300 && <Text style={{ color: C.muted, marginTop: 4 }}>{`Se muestran las 300 más antiguas de ${criticas.length}; el HTML las trae todas.`}</Text>}
        <Text style={s.h2}>Por orden</Text>
        <Table cols={[70, 110, 48, 40, 38, 45, 50, 58, 64]} head={['Orden', 'Modelo', 'Proceso', 'Línea', 'Hold', 'Rep.', 'Bloq.', 'Termin.', 'Más antigua']}
          rows={ordenes.map((o) => [o.mo, cutTo(o.model, 18), o.n, o.linea, o.hold, o.rep, o.blocked, o.terminadas, o.n ? hrs(o.max) : '—'])} />
        <Text style={{ color: C.muted, marginTop: 10 }}>{nota}</Text>
        <Foot date={date} />
      </Page>
    </Document>
  );
}

export const wipPdf = (d: WipPdfData) => pdf(<WipReport {...d} />).toBlob();

// ── Etiqueta de tarima 4×6 in (288 × 432 pt), negro sobre blanco: misma jerarquía que PalletLabel ──
const L = StyleSheet.create({
  page: { padding: 13, fontFamily: 'Helvetica', color: '#000' },
  k: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  v: { fontSize: 11, fontFamily: 'Courier-Bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
function LabelPage({ d, qr }: { d: PalletLabelData; qr: string }) {
  const m = qrModules(qr) ?? [], n = m.length, w = code128Safe(d.pallet), total = w.reduce((a, b) => a + b, 0) + 20;
  const F = ({ k, v, wide }: { k: string; v: string | number; wide?: boolean }) => (
    <View style={{ width: wide ? '100%' : '50%', marginBottom: 4 }}><Text style={L.k}>{k}</Text><Text style={L.v}>{String(v)}</Text></View>
  );
  let x = 10;
  return (
    <Page size={[288, 432]} style={L.page}>
      <View style={[L.row, { borderBottomWidth: 2, paddingBottom: 6 }]}>
        <View><Text style={L.k}>Cliente</Text><Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold' }}>{d.customer}</Text></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={L.k}>Destino</Text><Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold' }}>{d.destination}</Text></View>
      </View>
      <View style={{ borderBottomWidth: 1, paddingVertical: 7 }}>
        <Text style={L.k}>Pallet #</Text>
        <Text style={{ fontSize: 27, fontFamily: 'Courier-Bold', marginVertical: 2 }}>{d.pallet}</Text>
        {w.length > 0 && <Svg width={262} height={30} viewBox={`0 0 ${total} 40`} preserveAspectRatio="none">
          {w.map((bw, i) => { const r = i % 2 === 0 ? <Rect key={i} x={x} y={0} width={bw} height={40} fill="#000" /> : null; x += bw; return r; })}
        </Svg>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingTop: 7, flexGrow: 1 }}>
        <F k="Internal Ref" v={d.ref} wide /><F k="DN" v={d.dn} /><F k="NVIDIA DN" v={d.nvdn || '—'} /><F k="SO" v={d.so} /><F k="PO" v={d.po} />
        <F k="Part number" v={d.pn} wide /><F k="Piezas" v={d.qty} /><F k="Cajas" v={d.cartons} /><F k="Peso neto" v={`${d.nw} kg`} /><F k="Peso bruto" v={`${d.gw} kg`} />
      </View>
      <View style={[L.row, { borderTopWidth: 1, paddingTop: 7, alignItems: 'flex-end' }]}>
        <View style={{ flex: 1, paddingRight: 8, gap: 5 }}>
          {d.battery ? <Text style={{ borderWidth: 1.5, padding: 4, fontSize: 7, fontFamily: 'Helvetica-Bold' }}>{d.battery}</Text> : null}
          <Text style={{ fontSize: 7 }}>{`T/O ${d.to} · COO ${d.coo} · HTS ${d.hts} · ${d.dims} cm · ${d.shipDate}`}</Text>
          <Text style={{ fontSize: 10 }}>Tarima <Text style={{ fontFamily: 'Courier-Bold', fontSize: 16 }}>{d.index}</Text> de <Text style={{ fontFamily: 'Courier-Bold', fontSize: 16 }}>{d.total}</Text>{d.test ? '   PRUEBA' : ''}</Text>
        </View>
        {n > 0 && <Svg width={96} height={96} viewBox={`-4 -4 ${n + 8} ${n + 8}`}>
          {m.flatMap((r, yy) => r.map((on, xx) => (on ? <Rect key={`${xx}.${yy}`} x={xx} y={yy} width={1.02} height={1.02} fill="#000" /> : null)))}
        </Svg>}
      </View>
    </Page>
  );
}
const code128Safe = (t: string) => { try { return code128(t); } catch { return []; } };
/** Una página por etiqueta. */
export const labelsPdf = (labels: { d: PalletLabelData; qr: string }[]) =>
  pdf(<Document title={`Etiquetas ${labels.map((l) => l.d.pallet).join(', ')}`} author="Yield Control">{labels.map((l) => <LabelPage key={l.d.pallet} {...l} />)}</Document>).toBlob();
