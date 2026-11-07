// Datos de ejemplo tomados de las pantallas del sistema de diseño; se usan hasta definir el cálculo con archivos reales.
import type { ParetoDatum, ScatterSeries, Series } from '../components/charts.tsx';

export const fails: ParetoDatum[] = [
  { label: 'FT', value: 42 }, { label: 'SSD', value: 31 }, { label: 'JTAG', value: 18 },
  { label: 'LED', value: 9 }, { label: 'CUST', value: 6 }, { label: 'ICT', value: 4 },
];
export const ftErrors: ParetoDatum[] = [
  { label: 'E104', value: 17 }, { label: 'E221', value: 11 }, { label: 'E305', value: 8 }, { label: 'E019', value: 4 }, { label: 'NDF', value: 2 },
];
export const stations = ['SSD', 'LED', 'JTAG', 'FT', 'CUST', 'ICT'];
export const results: Series[] = [
  { name: 'First Pass', tone: 'pass', values: [412, 398, 405, 371, 360, 402] },
  { name: 'Second Pass', tone: 'second', values: [9, 4, 12, 28, 6, 3] },
  { name: 'First Fail', tone: 'fail', values: [14, 6, 18, 42, 9, 4] },
];
export const weeks = ['Sem 38', 'Sem 39', 'Sem 40', 'Sem 41', 'Sem 42', 'Sem 43'];
export const trendLines: Series[] = [
  { name: 'FPY %', tone: 'pass', values: [93.1, 94.0, 92.4, 95.2, 96.2, 97.4] },
];
export const lc245Hours = [2.1, 3.4, 4.0, 4.2, 5.1, 5.5, 5.8, 6.0, 6.2, 6.4, 6.9, 7.1, 7.3, 7.5, 7.8, 8.0, 8.1, 8.2, 8.4, 8.5, 8.6, 8.8, 9.0, 9.1, 9.3, 9.4, 9.6, 9.8, 10.0, 10.2, 10.3, 10.5, 10.8, 11.0, 11.2, 11.5, 11.9, 12.2, 12.6, 13.0, 13.4, 13.9, 14.5, 15.2, 16.0, 17.1, 18.4, 20.2, 22.5, 26.0, 7.7, 8.3, 8.9, 9.2, 9.7, 10.1, 10.6, 11.4, 12.0, 6.6];
export const scatter: ScatterSeries[] = [
  { name: 'TCQS', tone: 'pass', points: [{ label: 'SSD', x: 421, y: 14 }, { label: 'LED', x: 402, y: 6 }, { label: 'JTAG', x: 417, y: 18 }, { label: 'FT', x: 399, y: 42 }, { label: 'CUST', x: 366, y: 9 }] },
  { name: 'DATA ANALYSIS', tone: 'second', points: [{ label: 'SSD', x: 415, y: 16 }, { label: 'LED', x: 398, y: 6 }, { label: 'JTAG', x: 410, y: 21 }, { label: 'FT', x: 390, y: 47 }, { label: 'CUST', x: 362, y: 9 }] },
  { name: 'QM', tone: 'fail', points: [{ label: 'SSD', x: 380, y: 11 }, { label: 'LED', x: 371, y: 5 }, { label: 'JTAG', x: 388, y: 15 }, { label: 'FT', x: 352, y: 38 }, { label: 'CUST', x: 340, y: 7 }] },
];
