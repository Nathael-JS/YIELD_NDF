// Reporte PDF (react-pdf). Se carga solo al pulsar «Descargar PDF» (import dinámico): react-pdf pesa ~1.5 MB.
// Colores = tokens del tema claro; letras Helvetica/Courier (incluidas en el PDF, sin descargar fuentes).
import { Document, Font, G, Line, Page, pdf, Polyline, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { ACTION, diagnose, META_FPY, pctText, type Totals } from '../lib/tcqs.ts';

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
  kpi: { width: (W - 12) / 3, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 8 },
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
const COLS = [160, 50, 50, 50, 55, 50, 108]; // estación, entradas, 1ra falla, FPY, final, retest, diagnóstico
const num = { textAlign: 'right' as const, fontFamily: 'Courier', paddingRight: 6 };

export interface Kpi { label: string; value: string; unit?: string; delta?: number; deltaUnit: string; good: boolean }
export type Station = Totals & { name: string };
export interface PdfData {
  title: string; sub: string; kpis: Kpi[]; stations: Station[]; watch: (Station & { dx: [string, string] })[];
  pareto: { label: string; value: number }[]; trend: { label: string; fpy: number; final: number }[];
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
function Pareto({ data }: { data: PdfData['pareto'] }) {
  const d = [...data].sort((a, b) => b.value - a.value), total = d.reduce((t, x) => t + x.value, 0) || 1, max = d[0]?.value || 1;
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

const Foot = ({ date }: { date: string }) => (
  <View style={s.foot} fixed>
    <Text>{`Yield Control · generado el ${date} · fórmulas de la guía YieldRateSFC y RetestRate`}</Text>
    <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>
);

function Report({ title, sub, kpis, stations, watch, pareto, trend }: PdfData) {
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
          {['Estación', 'Entradas', '1ra falla', 'FPY', 'Final', 'Retest', 'Diagnóstico'].map((h, i) => <Text key={h} style={[{ width: COLS[i], paddingLeft: 4 }, i && i < 6 ? num : {}]}>{h}</Text>)}
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
              <View style={{ width: COLS[6], paddingLeft: 4 }}><Badge text={text} tone={tone} /></View>
            </View>
          );
        })}
        <Foot date={date} />
      </Page>
    </Document>
  );
}

export const reportPdf = (d: PdfData) => pdf(<Report {...d} />).toBlob();
