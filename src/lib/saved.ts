// Último archivo de cada tipo guardado en este navegador (IndexedDB: aguanta archivos grandes y fechas de Excel,
// a diferencia de localStorage). Se borra al salir. Si el navegador no lo permite (modo privado), la app sigue en memoria.
const open = () => new Promise<IDBDatabase>((ok, ko) => {
  const r = indexedDB.open('yield-control', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('files');
  r.onsuccess = () => ok(r.result);
  r.onerror = () => ko(r.error);
});

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((ok, ko) => {
    const r = op(db.transaction('files', mode).objectStore('files'));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  }).finally(() => db.close());
}

export const saveFile = (type: string, file: unknown) => run('readwrite', (s) => s.put(file, type));
export const dropFile = (type: string) => run('readwrite', (s) => s.delete(type));
export const dropAll = () => run('readwrite', (s) => s.clear());

export async function loadFiles() {
  const [keys, values] = await Promise.all([run('readonly', (s) => s.getAllKeys()), run('readonly', (s) => s.getAll())]);
  return Object.fromEntries(keys.map((k, i) => [String(k), values[i]]));
}
