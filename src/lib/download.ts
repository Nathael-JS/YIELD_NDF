/** Descarga un archivo generado en el navegador (respaldo JSON, reporte HTML o PDF). */
export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
