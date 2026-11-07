// Estado de la app. Sesión e historial en localStorage; el último archivo de cada tipo en IndexedDB (lib/saved.ts).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryItem, Period } from './components/ui.tsx';
import { useMemo } from 'react';
import type { ParsedFile } from './lib/files.ts';
import { dropAll, dropFile, loadFiles, saveFile } from './lib/saved.ts';
import { modelKey, modelsFrom, readTcqs } from './lib/tcqs.ts';

// MODELOS = Excel del proyecto (BOM) con los números de modelo válidos. DATA ANALYSIS y QM: pendientes.
export const FILE_TYPES = ['TCQS', 'MODELOS'] as const;
export type FileType = (typeof FILE_TYPES)[number];

export interface LoadedFile extends ParsedFile { name: string; loadedAt: string }

// shortcut: usuario de prueba fijo y sin backend; cambiar por la autenticación real cuando exista servidor.
export const TEST_USER = { user: 'demo', password: 'yield2026', name: 'Usuario de prueba' };

interface State {
  user: string | null;
  period: Period;
  history: HistoryItem[];
  requests: string[];
  files: Partial<Record<FileType, LoadedFile>>;
  errors: Partial<Record<FileType, string>>;
  login: (user: string, password: string) => boolean;
  logout: () => void;
  requestAccount: (user: string) => void;
  setPeriod: (p: Period) => void;
  setFile: (t: FileType, f: LoadedFile) => void;
  setError: (t: FileType, msg: string) => void;
}

export const shortDate = (d: Date) =>
  d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', '');

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      period: 'semana',
      history: [],
      requests: [],
      files: {},
      errors: {},
      login: (user, password) => {
        const ok = user.trim().toLowerCase() === TEST_USER.user && password === TEST_USER.password;
        if (ok) set({ user: TEST_USER.name });
        return ok;
      },
      // al salir se borran también los archivos guardados: el equipo puede ser compartido
      logout: () => { dropAll().catch(() => {}); set({ user: null, files: {}, errors: {} }); },
      requestAccount: (user) => set({ requests: [...get().requests, user.trim()] }),
      setPeriod: (period) => set({ period }),
      setFile: (t, f) => { saveFile(t, f).catch(() => {}); set((s) => ({
        files: { ...s.files, [t]: f },
        errors: { ...s.errors, [t]: undefined },
        history: [{ type: t, name: f.name, period: `${f.rows.length.toLocaleString('es-MX')} filas`, date: f.loadedAt }, ...s.history],
      })); },
      // un archivo con error reemplaza al anterior: no comparar con datos viejos sin avisar
      setError: (t, msg) => { dropFile(t).catch(() => {}); set((s) => ({ errors: { ...s.errors, [t]: msg }, files: { ...s.files, [t]: undefined } })); },
    }),
    { name: 'yield-control', partialize: ({ user, period, history, requests }) => ({ user, period, history, requests }) },
  ),
);

// Recupera los archivos guardados al abrir la app (sin pisar uno que se haya cargado mientras tanto).
// Fallar aquí solo significa volver a cargarlos.
if (typeof indexedDB !== 'undefined') {
  loadFiles().then((saved) => {
    if (useApp.getState().user) useApp.setState((s) => ({ files: { ...saved, ...s.files } }));
  }).catch(() => {});
}

/** Filas del TCQS ya filtradas a los modelos del proyecto (si se cargó el BOM). */
export function useData() {
  const { TCQS, MODELOS } = useApp((s) => s.files);
  return useMemo(() => {
    const read = TCQS ? readTcqs(TCQS) : null;
    const bom = MODELOS ? modelsFrom(MODELOS) : [];
    const models = MODELOS ? new Set(bom.map(modelKey)) : null;
    const all = read?.records ?? [];
    const records = models ? all.filter((r) => models.has(modelKey(r.model))) : all;
    const dates = records.map((r) => r.date).sort();
    return { read, bom, models, all, records, from: dates[0], to: dates.at(-1) };
  }, [TCQS, MODELOS]);
}
