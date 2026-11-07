// Lectura local de archivos (nada sale del navegador): .xlsx con read-excel-file, .csv/.txt con papaparse.
// El CSV se deja como texto: los seriales con ceros a la izquierda (00123) deben cruzar tal cual.
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';

export type Cell = string | number | boolean | Date | null;
export interface ParsedFile { headers: string[]; rows: Cell[][] }

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  let table: Cell[][];
  if (ext === 'xlsx') {
    const [sheet] = await readXlsxFile(file);
    table = (sheet?.data ?? []) as Cell[][];
  } else if (ext === 'csv' || ext === 'txt') {
    // los avisos de papaparse (p. ej. delimitador en archivo de una columna) no impiden leer; vacío se reporta abajo
    table = Papa.parse<string[]>(await file.text(), { skipEmptyLines: true }).data;
  } else {
    throw new Error('Formato no soportado: usa .xlsx o .csv');
  }
  if (!table.length) throw new Error('El archivo no tiene filas');
  const [head, ...rows] = table;
  return { headers: head.map((h, i) => (h == null || h === '' ? `Columna ${i + 1}` : String(h).trim())), rows };
}
